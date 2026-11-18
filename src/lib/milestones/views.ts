/**
 * Milestone list views and filters (pure). Milestones in archived projects
 * are excluded from every view.
 */
import { MILESTONE_STATUSES, type ISODate, type Milestone, type MilestoneStatus, type PortfolioData } from "@/lib/types";
import { isUpcoming, milestoneStates, type MilestoneState } from "./rules";

export const MILESTONE_VIEWS = [
  { key: "all", label: "All" },
  { key: "upcoming", label: "Upcoming" },
  { key: "overdue", label: "Overdue" },
  { key: "at-risk", label: "At risk" },
  { key: "completed", label: "Completed" },
] as const;
export type MilestoneView = (typeof MILESTONE_VIEWS)[number]["key"];

export interface MilestoneFilters {
  view: MilestoneView;
  project?: string;
  owner?: string;
  status?: MilestoneStatus;
  /** Planned completion on or after this date. */
  from?: ISODate;
  /** Planned completion on or before this date. */
  to?: ISODate;
}

export interface MilestoneListRow {
  milestone: Milestone;
  state: MilestoneState;
  projectName: string;
  upcoming: boolean;
}

type Param = string | string[] | undefined;
const one = (v: Param) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
const isDate = (v: string | undefined) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);

export function parseMilestoneFilters(params: Record<string, Param>): MilestoneFilters {
  const view = one(params.view);
  const status = one(params.status);
  return {
    view: MILESTONE_VIEWS.some((v) => v.key === view) ? (view as MilestoneView) : "all",
    project: one(params.project),
    owner: one(params.owner),
    status: (MILESTONE_STATUSES as readonly string[]).includes(status ?? "") ? (status as MilestoneStatus) : undefined,
    from: isDate(one(params.from)),
    to: isDate(one(params.to)),
  };
}

export function milestoneFiltersToQuery(filters: MilestoneFilters, patch: Partial<MilestoneFilters> = {}): string {
  const merged = { ...filters, ...patch };
  const qs = new URLSearchParams();
  if (merged.view !== "all") qs.set("view", merged.view);
  for (const key of ["project", "owner", "status", "from", "to"] as const) {
    if (merged[key]) qs.set(key, merged[key]!);
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export function buildMilestoneRows(data: PortfolioData, today: ISODate, { includeArchived = false } = {}): MilestoneListRow[] {
  const projects = new Map(data.projects.filter((p) => includeArchived || p.archivedAt === null).map((p) => [p.id, p.name]));
  const states = milestoneStates(data, today);
  return data.milestones
    .filter((m) => projects.has(m.projectId))
    .map((milestone) => {
      const state = states.get(milestone.id)!;
      return { milestone, state, projectName: projects.get(milestone.projectId)!, upcoming: isUpcoming(milestone, state, today) };
    });
}

const inView = (r: MilestoneListRow, view: MilestoneView) =>
  view === "upcoming"
    ? r.upcoming
    : view === "overdue"
      ? r.state.status === "delayed"
      : view === "at-risk"
        ? r.state.status === "at_risk"
        : view === "completed"
          ? r.state.status === "completed"
          : true;

export function applyMilestoneFilters(rows: MilestoneListRow[], f: MilestoneFilters): MilestoneListRow[] {
  const filtered = rows.filter(
    (r) =>
      inView(r, f.view) &&
      (!f.project || r.milestone.projectId === f.project) &&
      (!f.owner || r.milestone.owner === f.owner) &&
      (!f.status || r.state.status === f.status) &&
      (!f.from || r.milestone.plannedDate >= f.from) &&
      (!f.to || r.milestone.plannedDate <= f.to),
  );
  if (f.view === "completed") {
    return filtered.sort((a, b) => (b.milestone.actualDate ?? "").localeCompare(a.milestone.actualDate ?? ""));
  }
  // Open milestones by planned completion, completed ones last.
  return filtered.sort(
    (a, b) =>
      Number(a.state.status === "completed") - Number(b.state.status === "completed") ||
      a.milestone.plannedDate.localeCompare(b.milestone.plannedDate),
  );
}

export function milestoneViewCounts(rows: MilestoneListRow[], f: MilestoneFilters): Record<MilestoneView, number> {
  const counts = {} as Record<MilestoneView, number>;
  for (const v of MILESTONE_VIEWS) counts[v.key] = applyMilestoneFilters(rows, { ...f, view: v.key }).length;
  return counts;
}
