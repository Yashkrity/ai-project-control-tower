/**
 * Core domain model for the Control Tower.
 *
 * Dates are ISO calendar dates ("YYYY-MM-DD") unless the field name ends in
 * `At`, in which case it is a full ISO timestamp. Keeping calendar dates as
 * strings avoids timezone drift when comparing due dates.
 */

export type ISODate = string;
export type ISODateTime = string;

export const PROJECT_STATUSES = ["planning", "active", "on_hold", "completed"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const HEALTH_VALUES = ["green", "amber", "red"] as const;
export type Health = (typeof HEALTH_VALUES)[number];

export const TASK_STATUSES = ["not_started", "in_progress", "blocked", "on_hold", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const PRIORITIES = ["low", "medium", "high", "critical"] as const;
export type Priority = (typeof PRIORITIES)[number];

/**
 * Milestone status is calculated (see src/lib/milestones/rules.ts), never
 * stored or typed in. Listed in precedence order, highest first:
 * completed > delayed > at_risk > in_progress > not_started.
 */
export const MILESTONE_STATUSES = ["not_started", "in_progress", "at_risk", "delayed", "completed"] as const;
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];

export const RAID_TYPES = ["risk", "assumption", "issue", "dependency"] as const;
export type RaidType = (typeof RAID_TYPES)[number];


export interface Project {
  id: string;
  name: string;
  client: string;
  description: string;
  projectManager: string;
  startDate: ISODate;
  targetEndDate: ISODate;
  /** Approved budget in the portfolio's base currency. */
  budget: number;
  actualSpend: number;
  status: ProjectStatus;
  /** RAG health as judged by the project manager. */
  health: Health;
  /**
   * Archiving is independent of status, so restoring a project brings it
   * back exactly as it was (e.g. still "completed").
   */
  archivedAt: ISODateTime | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/** Fields a user can set when creating or editing a project. */
export type ProjectInput = Pick<
  Project,
  | "name"
  | "client"
  | "description"
  | "projectManager"
  | "startDate"
  | "targetEndDate"
  | "budget"
  | "actualSpend"
  | "status"
  | "health"
>;

export interface Milestone {
  id: string;
  projectId: string;
  /** Shown as "Title" in the UI. */
  name: string;
  description: string;
  owner: string;
  priority: Priority;
  plannedStartDate: ISODate;
  /** Planned completion date. */
  plannedDate: ISODate;
  /**
   * Actual completion date. Can only be recorded while every linked task is
   * done; cleared automatically if a linked task is reopened.
   */
  actualDate: ISODate | null;
  notes: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/** Fields a user can set when creating or editing a milestone. */
export type MilestoneInput = Pick<
  Milestone,
  "projectId" | "name" | "description" | "owner" | "priority" | "plannedStartDate" | "plannedDate" | "actualDate" | "notes"
>;

/** A milestone as stored, minus the fields the repository assigns. */
export type MilestoneDraft = Omit<Milestone, "id" | "createdAt" | "updatedAt">;

export interface Task {
  id: string;
  projectId: string;
  milestoneId: string | null;
  title: string;
  description: string;
  owner: string;
  priority: Priority;
  status: TaskStatus;
  startDate: ISODate;
  dueDate: ISODate;
  /** Actual completion date. Set only while status is "done". */
  completedDate: ISODate | null;
  /** Predecessor task IDs (same project) that must be done first. */
  dependsOn: string[];
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/** Fields a user can set when creating or editing a task. */
export type TaskInput = Pick<
  Task,
  | "projectId"
  | "milestoneId"
  | "title"
  | "description"
  | "owner"
  | "priority"
  | "status"
  | "startDate"
  | "dueDate"
  | "completedDate"
  | "dependsOn"
>;

/** A task as stored, minus the fields the repository assigns. */
export type TaskDraft = Omit<Task, "id" | "createdAt" | "updatedAt">;

/* ------------------------------------------------------------------ */
/* RAID register                                                       */
/* ------------------------------------------------------------------ */

export const RISK_STATUSES = ["open", "mitigating", "closed", "materialized"] as const;
export type RiskStatus = (typeof RISK_STATUSES)[number];
export const ASSUMPTION_STATUSES = ["pending", "validated", "invalidated"] as const;
export type AssumptionStatus = (typeof ASSUMPTION_STATUSES)[number];
export const ISSUE_STATUSES = ["open", "investigating", "escalated", "resolved", "closed"] as const;
export type IssueStatus = (typeof ISSUE_STATUSES)[number];
export const DEPENDENCY_STATUSES = ["pending", "in_progress", "blocked", "fulfilled"] as const;
export type DependencyStatus = (typeof DEPENDENCY_STATUSES)[number];
export const DEPENDENCY_DIRECTIONS = ["internal", "external"] as const;
export type DependencyDirection = (typeof DEPENDENCY_DIRECTIONS)[number];

export const RAID_STATUSES_BY_TYPE = {
  risk: RISK_STATUSES,
  assumption: ASSUMPTION_STATUSES,
  issue: ISSUE_STATUSES,
  dependency: DEPENDENCY_STATUSES,
} as const;
export type RaidStatus = RiskStatus | AssumptionStatus | IssueStatus | DependencyStatus;

/** 1 (rare / negligible) to 5 (almost certain / severe). */
export type RiskRating = 1 | 2 | 3 | 4 | 5;

/**
 * Fields shared by every RAID record. `targetDate` is the type's deadline:
 * risk = review date, assumption = validation deadline, issue = target
 * resolution date, dependency = required-by date. `resolvedDate` is the
 * actual resolution date: set when the record reaches a closed state.
 */
interface RaidBase {
  id: string;
  /** Human-readable reference, unique per type: R-001, A-001, I-001, D-001. */
  ref: string;
  projectId: string;
  title: string;
  /** Description; for assumptions, the assumption statement. */
  description: string;
  /** Risk owner, validation owner, resolution owner or dependency owner. */
  owner: string;
  targetDate: ISODate | null;
  resolvedDate: ISODate | null;
  milestoneId: string | null;
  taskId: string | null;
  /** Mitigation plan (risk), validation approach (assumption), action plan (issue), plan (dependency). */
  plan: string;
  latestUpdate: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface RiskItem extends RaidBase {
  type: "risk";
  status: RiskStatus;
  probability: RiskRating;
  impact: RiskRating;
  contingency: string;
}

export interface AssumptionItem extends RaidBase {
  type: "assumption";
  status: AssumptionStatus;
  priority: Priority;
  /** Evidence supporting validation or invalidation. */
  validationNotes: string;
}

export interface IssueItem extends RaidBase {
  type: "issue";
  status: IssueStatus;
  /** Severity of the issue. */
  priority: Priority;
  businessImpact: string;
  escalationReason: string;
  escalatedDate: ISODate | null;
}

export interface DependencyItem extends RaidBase {
  type: "dependency";
  status: DependencyStatus;
  priority: Priority;
  direction: DependencyDirection;
  requiredFrom: string;
  impactIfUnfulfilled: string;
  escalationOwner: string;
}

export type RaidItem = RiskItem | AssumptionItem | IssueItem | DependencyItem;

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** What a user submits; the repository assigns the rest. */
export type RaidInput = DistributiveOmit<RaidItem, "id" | "ref" | "createdAt" | "updatedAt">;
/** A record as stored, minus the fields the repository assigns. */
export type RaidDraft = RaidInput;

export const UPDATE_KINDS = ["status", "milestone", "risk", "decision", "general", "raid"] as const;
export type UpdateKind = (typeof UPDATE_KINDS)[number];

export interface ProjectUpdate {
  id: string;
  projectId: string;
  author: string;
  kind: UpdateKind;
  summary: string;
  createdAt: ISODateTime;
  /** Set for entries about a RAID record: that record's activity history. */
  raidItemId?: string;
}

/** Everything the portfolio dashboard needs, loaded in one call. */
export interface PortfolioData {
  projects: Project[];
  tasks: Task[];
  milestones: Milestone[];
  raidItems: RaidItem[];
  updates: ProjectUpdate[];
}
