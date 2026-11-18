/**
 * RAID register views, filters, search and sorting (pure). Records of
 * archived projects are excluded.
 */
import { PRIORITIES, RAID_STATUSES_BY_TYPE, RAID_TYPES, type ISODate, type PortfolioData, type Priority, type RaidItem, type RaidStatus, type RaidType } from "@/lib/types";
import { escalationNote, isHighOrCriticalRisk, isOpen, isOverdue, isUpcomingReview, riskScore, severityOf, SEVERITY_RANK } from "./rules";

export const RAID_TABS = [
  { key: "all", label: "All records" },
  { key: "risk", label: "Risks" },
  { key: "assumption", label: "Assumptions" },
  { key: "issue", label: "Issues" },
  { key: "dependency", label: "Dependencies" },
] as const;
export type RaidTab = (typeof RAID_TABS)[number]["key"];

export const RAID_FOCUS = [
  { key: "high-risks", label: "Open high/critical risks" },
  { key: "overdue", label: "Overdue" },
  { key: "escalated", label: "Escalated issues" },
  { key: "blocked", label: "Blocked dependencies" },
  { key: "upcoming", label: "Upcoming reviews" },
] as const;
export type RaidFocus = (typeof RAID_FOCUS)[number]["key"];

export const RAID_SORTS = ["deadline", "severity", "updated", "ref"] as const;
export type RaidSort = (typeof RAID_SORTS)[number];

export interface RaidFilters {
  tab: RaidTab;
  focus?: RaidFocus;
  project?: string;
  owner?: string;
  /** "open" or "closed" across types. */
  state?: "open" | "closed";
  /** Exact status; only applied when a type tab is selected. */
  status?: RaidStatus;
  severity?: Priority;
  from?: ISODate;
  to?: ISODate;
  q?: string;
  sort: RaidSort;
}

export interface RaidRow {
  item: RaidItem;
  projectName: string;
  severity: Priority;
  score: number | null;
  open: boolean;
  overdue: boolean;
  upcoming: boolean;
  escalation: string | null;
  milestone: { id: string; name: string } | null;
  task: { id: string; title: string } | null;
}

type Param = string | string[] | undefined;
const one = (v: Param) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
const isDate = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
const oneOf = <T extends string>(values: readonly T[], v?: string) => (values.includes(v as T) ? (v as T) : undefined);

export function parseRaidFilters(params: Record<string, Param>): RaidFilters {
  const tab = oneOf(RAID_TABS.map((t) => t.key), one(params.tab)) ?? "all";
  const status = one(params.status);
  return {
    tab,
    focus: oneOf(RAID_FOCUS.map((f) => f.key), one(params.focus)),
    project: one(params.project),
    owner: one(params.owner),
    state: oneOf(["open", "closed"] as const, one(params.state)),
    status: tab !== "all" && (RAID_STATUSES_BY_TYPE[tab] as readonly string[]).includes(status ?? "") ? (status as RaidStatus) : undefined,
    severity: oneOf(PRIORITIES, one(params.severity)),
    from: isDate(one(params.from)),
    to: isDate(one(params.to)),
    q: one(params.q)?.slice(0, 100),
    sort: oneOf(RAID_SORTS, one(params.sort)) ?? "deadline",
  };
}

export function raidFiltersToQuery(f: RaidFilters, patch: Partial<RaidFilters> = {}): string {
  const m = { ...f, ...patch };
  const qs = new URLSearchParams();
  if (m.tab !== "all") qs.set("tab", m.tab);
  for (const key of ["focus", "project", "owner", "state", "status", "severity", "from", "to", "q"] as const) {
    if (m[key]) qs.set(key, m[key]!);
  }
  if (m.sort !== "deadline") qs.set("sort", m.sort);
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export function buildRaidRows(data: PortfolioData, today: ISODate, { includeArchived = false } = {}): RaidRow[] {
  const projects = new Map(data.projects.filter((p) => includeArchived || p.archivedAt === null).map((p) => [p.id, p.name]));
  const milestones = new Map(data.milestones.map((m) => [m.id, m.name]));
  const tasks = new Map(data.tasks.map((t) => [t.id, t.title]));
  return data.raidItems
    .filter((r) => projects.has(r.projectId))
    .map((item) => ({
      item,
      projectName: projects.get(item.projectId)!,
      severity: severityOf(item),
      score: item.type === "risk" ? riskScore(item) : null,
      open: isOpen(item),
      overdue: isOverdue(item, today),
      upcoming: isUpcomingReview(item, today),
      escalation: escalationNote(item),
      milestone: item.milestoneId && milestones.has(item.milestoneId) ? { id: item.milestoneId, name: milestones.get(item.milestoneId)! } : null,
      task: item.taskId && tasks.has(item.taskId) ? { id: item.taskId, title: tasks.get(item.taskId)! } : null,
    }));
}

const inFocus = (r: RaidRow, focus?: RaidFocus) =>
  !focus ||
  (focus === "high-risks" && isHighOrCriticalRisk(r.item)) ||
  (focus === "overdue" && r.overdue) ||
  (focus === "escalated" && r.item.type === "issue" && r.item.status === "escalated") ||
  (focus === "blocked" && r.item.type === "dependency" && r.item.status === "blocked") ||
  (focus === "upcoming" && r.upcoming);

const matches = (r: RaidRow, q: string) => {
  const needle = q.toLowerCase();
  const i = r.item;
  return [i.ref, i.title, i.description, i.owner, i.plan, i.latestUpdate, r.projectName].some((s) => s.toLowerCase().includes(needle));
};

function sortRows(rows: RaidRow[], sort: RaidSort): RaidRow[] {
  const byDeadline = (a: RaidRow, b: RaidRow) => (a.item.targetDate ?? "9999").localeCompare(b.item.targetDate ?? "9999");
  const cmp: Record<RaidSort, (a: RaidRow, b: RaidRow) => number> = {
    deadline: (a, b) => Number(b.open) - Number(a.open) || byDeadline(a, b),
    severity: (a, b) => Number(b.open) - Number(a.open) || SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || (b.score ?? 0) - (a.score ?? 0) || byDeadline(a, b),
    updated: (a, b) => b.item.updatedAt.localeCompare(a.item.updatedAt),
    ref: (a, b) => a.item.ref.localeCompare(b.item.ref),
  };
  return rows.sort(cmp[sort]);
}

export function applyRaidFilters(rows: RaidRow[], f: RaidFilters): RaidRow[] {
  return sortRows(
    rows.filter(
      (r) =>
        (f.tab === "all" || r.item.type === f.tab) &&
        inFocus(r, f.focus) &&
        (!f.project || r.item.projectId === f.project) &&
        (!f.owner || r.item.owner === f.owner) &&
        (!f.state || (f.state === "open") === r.open) &&
        (!f.status || r.item.status === f.status) &&
        (!f.severity || r.severity === f.severity) &&
        (!f.from || (r.item.targetDate !== null && r.item.targetDate >= f.from)) &&
        (!f.to || (r.item.targetDate !== null && r.item.targetDate <= f.to)) &&
        (!f.q || matches(r, f.q)),
    ),
    f.sort,
  );
}

/** Counts for the type tabs and focus chips, each with the other filters applied. */
export function raidCounts(rows: RaidRow[], f: RaidFilters) {
  const tabs = {} as Record<RaidTab, number>;
  for (const t of RAID_TABS) tabs[t.key] = applyRaidFilters(rows, { ...f, tab: t.key, status: undefined }).length;
  const focus = {} as Record<RaidFocus, number>;
  for (const x of RAID_FOCUS) focus[x.key] = applyRaidFilters(rows, { ...f, focus: x.key }).length;
  return { tabs, focus };
}

export const isRaidType = (v: unknown): v is RaidType => RAID_TYPES.includes(v as RaidType);
