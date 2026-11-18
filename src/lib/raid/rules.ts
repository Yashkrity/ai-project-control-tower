/**
 * RAID governance rules. Pure and deterministic (no AI): used inside the
 * repository's write lock, by pages and by tests.
 *
 * Risk score = probability (1-5) × impact (1-5), so 1-25.
 * Risk level thresholds:  1-4 Low · 5-9 Medium · 10-14 High · 15-25 Critical
 *
 * Each type's `targetDate` is its own deadline, used for overdue detection:
 *   risk = review date · assumption = validation deadline ·
 *   issue = target resolution date · dependency = required-by date
 */
import {
  RAID_STATUSES_BY_TYPE,
  type ISODate,
  type PortfolioData,
  type Priority,
  type RaidDraft,
  type RaidInput,
  type RaidItem,
  type RaidStatus,
  type RaidType,
  type RiskItem,
} from "@/lib/types";
import { addDays, formatDate } from "@/lib/utils/dates";
import { humanize } from "@/lib/utils/format";

export const RISK_LEVEL_THRESHOLDS: { level: Priority; min: number; max: number }[] = [
  { level: "low", min: 1, max: 4 },
  { level: "medium", min: 5, max: 9 },
  { level: "high", min: 10, max: 14 },
  { level: "critical", min: 15, max: 25 },
];

/** Open records whose deadline falls within this many days count as upcoming reviews. */
export const UPCOMING_REVIEW_DAYS = 14;

export const RAID_TYPE_LABEL: Record<RaidType, string> = { risk: "Risk", assumption: "Assumption", issue: "Issue", dependency: "Dependency" };

/** What `targetDate` means for each type. */
export const TARGET_DATE_LABEL: Record<RaidType, string> = {
  risk: "Review date",
  assumption: "Validation deadline",
  issue: "Target resolution date",
  dependency: "Required-by date",
};

/** What `owner` means for each type. */
export const OWNER_LABEL: Record<RaidType, string> = {
  risk: "Risk owner",
  assumption: "Validation owner",
  issue: "Resolution owner",
  dependency: "Owner",
};

/** What `plan` means for each type. */
export const PLAN_LABEL: Record<RaidType, string> = {
  risk: "Mitigation plan",
  assumption: "Validation approach",
  issue: "Action plan",
  dependency: "Plan",
};

/** Statuses in which a record is no longer active. */
export const CLOSED_STATUSES: Record<RaidType, readonly RaidStatus[]> = {
  risk: ["closed", "materialized"],
  assumption: ["validated", "invalidated"],
  issue: ["resolved", "closed"],
  dependency: ["fulfilled"],
};

/** Allowed status changes. Anything else is rejected on the server. */
export const STATUS_TRANSITIONS: Record<RaidType, Partial<Record<RaidStatus, readonly RaidStatus[]>>> = {
  risk: {
    open: ["mitigating", "closed", "materialized"],
    mitigating: ["open", "closed", "materialized"],
    closed: ["open"],
    materialized: ["closed"],
  },
  assumption: {
    pending: ["validated", "invalidated"],
    validated: ["pending", "invalidated"],
    invalidated: ["pending", "validated"],
  },
  issue: {
    open: ["investigating", "escalated", "resolved"],
    investigating: ["open", "escalated", "resolved"],
    escalated: ["investigating", "resolved"],
    resolved: ["closed", "open"],
    closed: ["open"],
  },
  dependency: {
    pending: ["in_progress", "blocked", "fulfilled"],
    in_progress: ["pending", "blocked", "fulfilled"],
    blocked: ["in_progress", "fulfilled"],
    fulfilled: ["in_progress"],
  },
};

/* ------------------------------------------------------------------ */
/* Calculations                                                        */
/* ------------------------------------------------------------------ */

export function riskScore(risk: Pick<RiskItem, "probability" | "impact">): number {
  return risk.probability * risk.impact;
}

export function riskLevel(score: number): Priority {
  return RISK_LEVEL_THRESHOLDS.find((t) => score >= t.min && score <= t.max)?.level ?? "low";
}

/** Risk level for risks; the recorded priority/severity for every other type. */
export function severityOf(item: RaidItem): Priority {
  return item.type === "risk" ? riskLevel(riskScore(item)) : item.priority;
}

export const SEVERITY_RANK: Record<Priority, number> = { critical: 4, high: 3, medium: 2, low: 1 };

export function isClosedStatus(type: RaidType, status: RaidStatus): boolean {
  return CLOSED_STATUSES[type].includes(status);
}

export function isOpen(item: RaidItem): boolean {
  return !isClosedStatus(item.type, item.status);
}

/** Open and past its type-specific deadline. */
export function isOverdue(item: RaidItem, today: ISODate): boolean {
  return isOpen(item) && item.targetDate !== null && item.targetDate < today;
}

/** Open and its deadline falls between today and today + UPCOMING_REVIEW_DAYS. */
export function isUpcomingReview(item: RaidItem, today: ISODate, days = UPCOMING_REVIEW_DAYS): boolean {
  return isOpen(item) && item.targetDate !== null && item.targetDate >= today && item.targetDate <= addDays(today, days);
}

export function isHighOrCriticalRisk(item: RaidItem): boolean {
  return item.type === "risk" && isOpen(item) && SEVERITY_RANK[severityOf(item)] >= SEVERITY_RANK.high;
}

/** Escalation indicators: escalated issues and blocked dependencies. */
export function escalationNote(item: RaidItem): string | null {
  if (item.type === "issue" && item.status === "escalated") {
    return `Escalated${item.escalatedDate ? ` on ${formatDate(item.escalatedDate)}` : ""}${item.escalationReason ? `: ${item.escalationReason}` : ""}`;
  }
  if (item.type === "dependency" && item.status === "blocked") {
    return `Blocked${item.escalationOwner ? ` · escalation owner ${item.escalationOwner}` : ""}`;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Write rules                                                         */
/* ------------------------------------------------------------------ */

export type RaidErrorField =
  | "type"
  | "projectId"
  | "milestoneId"
  | "taskId"
  | "status"
  | "resolvedDate"
  | "escalationReason"
  | "escalatedDate"
  | "validationNotes"
  | "escalationOwner"
  | "form";
export type RaidRuleErrors = Partial<Record<RaidErrorField, string[]>>;

export class RaidRuleError extends Error {
  constructor(readonly fieldErrors: RaidRuleErrors) {
    super(Object.values(fieldErrors).flat()[0] ?? "RAID rule violated");
    this.name = "RaidRuleError";
  }
}

export interface RaidWriteResult {
  draft: RaidDraft;
  /** Human-readable changes for the record's activity history. */
  changes: string[];
}

const label = (s: string) => humanize(s);
const withArticle = (noun: string, capital = false) => `${/^[aeiou]/.test(noun) ? (capital ? "An" : "an") : capital ? "A" : "a"} ${noun}`;

/**
 * Validates a create (existing = null) or update and returns the record to
 * store. Applies resolution/escalation dates. Throws RaidRuleError.
 */
export function resolveRaidWrite(data: PortfolioData, existing: RaidItem | null, input: RaidInput, today: ISODate): RaidWriteResult {
  const errors: RaidRuleErrors = {};
  const add = (field: RaidErrorField, message: string) => (errors[field] ??= []).push(message);

  if (existing && existing.type !== input.type) add("type", "The type of a RAID record cannot be changed. Create a new record instead.");
  if (!(RAID_STATUSES_BY_TYPE[input.type] as readonly string[]).includes(input.status)) {
    add("status", `“${label(input.status)}” is not a valid status for ${withArticle(RAID_TYPE_LABEL[input.type].toLowerCase())}.`);
  }

  // Associations
  const project = data.projects.find((p) => p.id === input.projectId);
  if (!project) add("projectId", "Choose a project that exists.");
  else if (project.archivedAt !== null) add("projectId", `“${project.name}” is archived. Restore it before changing its RAID log.`);
  if (input.milestoneId) {
    const m = data.milestones.find((x) => x.id === input.milestoneId);
    if (!m) add("milestoneId", "Choose a milestone that exists.");
    else if (m.projectId !== input.projectId) add("milestoneId", "The milestone belongs to a different project.");
  }
  if (input.taskId) {
    const t = data.tasks.find((x) => x.id === input.taskId);
    if (!t) add("taskId", "Choose a task that exists.");
    else if (t.projectId !== input.projectId) add("taskId", "The task belongs to a different project.");
  }

  // Status transition
  const statusChanged = existing !== null && existing.status !== input.status;
  if (statusChanged && !errors.type) {
    const allowed = STATUS_TRANSITIONS[input.type][existing.status] ?? [];
    if (!allowed.includes(input.status)) {
      add(
        "status",
        `${withArticle(RAID_TYPE_LABEL[input.type].toLowerCase(), true)} cannot move from ${label(existing.status)} to ${label(input.status)}.` +
          (allowed.length ? ` Allowed next: ${allowed.map(label).join(", ")}.` : ""),
      );
    }
  }

  // Status requirements
  const draft = { ...input } as RaidDraft;
  if (draft.type === "issue" && draft.status === "escalated") {
    if (!draft.escalationReason.trim()) add("escalationReason", "Give a reason when escalating an issue.");
    const wasEscalated = existing?.type === "issue" && existing.status === "escalated";
    draft.escalatedDate = draft.escalatedDate ?? (wasEscalated ? existing.escalatedDate : null) ?? today;
  }
  if (draft.type === "issue" && draft.escalatedDate && draft.escalatedDate > today) add("escalatedDate", "The escalation date cannot be in the future.");
  if (draft.type === "assumption" && draft.status !== "pending" && !draft.validationNotes.trim()) {
    add("validationNotes", `Record the evidence when an assumption is ${label(draft.status).toLowerCase()}.`);
  }
  if (draft.type === "dependency" && draft.status === "blocked" && !draft.escalationOwner.trim()) {
    add("escalationOwner", "Name an escalation owner for a blocked dependency.");
  }

  // Resolution date
  const closed = isClosedStatus(input.type, input.status);
  const wasClosed = existing ? isClosedStatus(existing.type, existing.status) : false;
  if (closed) {
    draft.resolvedDate = input.resolvedDate ?? (wasClosed ? existing!.resolvedDate : null) ?? today;
    if (draft.resolvedDate > today) add("resolvedDate", `The resolution date cannot be in the future (today is ${formatDate(today)}).`);
  } else {
    draft.resolvedDate = null;
  }

  if (Object.keys(errors).length) throw new RaidRuleError(errors);
  return { draft, changes: describeChanges(existing, draft) };
}

function describeChanges(before: RaidItem | null, after: RaidDraft): string[] {
  if (!before) {
    const detail =
      after.type === "risk"
        ? ` (score ${riskScore(after)}, ${label(riskLevel(riskScore(after)))})`
        : ` (${label(after.status)}, ${label(after.priority)})`;
    return [`Created${detail}.`];
  }
  const changes: string[] = [];
  if (before.status !== after.status) {
    if (after.type === "issue" && after.status === "escalated") changes.push(`Escalated: ${after.escalationReason.trim()}`);
    else changes.push(`Status changed from ${label(before.status)} to ${label(after.status)}`);
    if (after.resolvedDate && !before.resolvedDate) changes.push(`resolution date recorded as ${formatDate(after.resolvedDate)}`);
    if (!after.resolvedDate && before.resolvedDate) changes.push(`reopened (was resolved on ${formatDate(before.resolvedDate)})`);
  }
  if (before.type === "risk" && after.type === "risk") {
    const s0 = riskScore(before);
    const s1 = riskScore(after);
    if (s0 !== s1) changes.push(`Risk score ${s0} (${label(riskLevel(s0))}) → ${s1} (${label(riskLevel(s1))})`);
  } else if ("priority" in before && "priority" in after && before.priority !== after.priority) {
    changes.push(`${after.type === "issue" ? "Severity" : "Priority"} changed from ${label(before.priority)} to ${label(after.priority)}`);
  }
  if (before.targetDate !== after.targetDate) {
    const what = TARGET_DATE_LABEL[after.type];
    changes.push(`${what} ${before.targetDate ? `moved from ${formatDate(before.targetDate)} ` : "set "}to ${after.targetDate ? formatDate(after.targetDate) : "none"}`);
  }
  if (before.owner !== after.owner) changes.push(`${OWNER_LABEL[after.type]} changed from ${before.owner} to ${after.owner}`);
  if (before.milestoneId !== after.milestoneId || before.taskId !== after.taskId) changes.push("Impacted milestone/task changed");
  if (before.latestUpdate !== after.latestUpdate && after.latestUpdate.trim()) {
    const text = after.latestUpdate.trim();
    changes.push(`Update: ${text.length > 160 ? `${text.slice(0, 157)}…` : text}`);
  }
  return changes.length ? [`${changes.join("; ").replace(/[.\s]+$/, "")}.`] : [];
}
