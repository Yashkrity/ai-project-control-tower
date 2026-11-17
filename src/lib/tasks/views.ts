/**
 * Task list views and filters (pure, so they can be unit-tested).
 * Tasks in archived projects are excluded from every view.
 */
import { PRIORITIES, TASK_STATUSES, type ISODate, type PortfolioData, type Priority, type Task, type TaskStatus } from "@/lib/types";
import { isTaskOverdue } from "@/lib/metrics/portfolio";
import { daysBetween } from "@/lib/utils/dates";
import { indexTasks, isTaskDueSoon, taskBlockInfo, type BlockInfo } from "./rules";

export const TASK_VIEWS = [
  { key: "all", label: "All" },
  { key: "overdue", label: "Overdue" },
  { key: "due-soon", label: "Due soon" },
  { key: "blocked", label: "Blocked" },
  { key: "completed", label: "Completed" },
] as const;
export type TaskView = (typeof TASK_VIEWS)[number]["key"];

export interface TaskFilters {
  view: TaskView;
  project?: string;
  owner?: string;
  priority?: Priority;
  status?: TaskStatus;
}

export interface TaskRow {
  task: Task;
  projectName: string;
  milestoneName: string | null;
  block: BlockInfo;
  overdue: boolean;
  dueSoon: boolean;
  /** Positive = days late; negative = days until due. */
  dueInDays: number;
}

type Param = string | string[] | undefined;
const one = (v: Param) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;

export function parseTaskFilters(params: Record<string, Param>): TaskFilters {
  const view = one(params.view);
  const priority = one(params.priority);
  const status = one(params.status);
  return {
    view: TASK_VIEWS.some((v) => v.key === view) ? (view as TaskView) : "all",
    project: one(params.project),
    owner: one(params.owner),
    priority: (PRIORITIES as readonly string[]).includes(priority ?? "") ? (priority as Priority) : undefined,
    status: (TASK_STATUSES as readonly string[]).includes(status ?? "") ? (status as TaskStatus) : undefined,
  };
}

/** Query string for a filter set, optionally overriding some keys. */
export function filtersToQuery(filters: TaskFilters, patch: Partial<TaskFilters> = {}): string {
  const merged = { ...filters, ...patch };
  const qs = new URLSearchParams();
  if (merged.view !== "all") qs.set("view", merged.view);
  for (const key of ["project", "owner", "priority", "status"] as const) {
    if (merged[key]) qs.set(key, merged[key]!);
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export function buildTaskRows(data: PortfolioData, today: ISODate, { includeArchived = false } = {}): TaskRow[] {
  const live = new Map(
    data.projects.filter((p) => includeArchived || p.archivedAt === null).map((p) => [p.id, p.name]),
  );
  const milestones = new Map(data.milestones.map((m) => [m.id, m.name]));
  const byId = indexTasks(data.tasks);
  return data.tasks
    .filter((t) => live.has(t.projectId))
    .map((task) => ({
      task,
      projectName: live.get(task.projectId)!,
      milestoneName: task.milestoneId ? (milestones.get(task.milestoneId) ?? null) : null,
      block: taskBlockInfo(task, byId, today),
      overdue: isTaskOverdue(task, today),
      dueSoon: isTaskDueSoon(task, today),
      dueInDays: daysBetween(task.dueDate, today),
    }));
}

const inView = (row: TaskRow, view: TaskView) =>
  view === "overdue"
    ? row.overdue
    : view === "due-soon"
      ? row.dueSoon
      : view === "blocked"
        ? row.block.blocked
        : view === "completed"
          ? row.task.status === "done"
          : true;

const PRIORITY_RANK: Record<Priority, number> = { critical: 0, high: 1, medium: 2, low: 3 };

function sortRows(rows: TaskRow[], view: TaskView): TaskRow[] {
  const byDue = (a: TaskRow, b: TaskRow) =>
    a.task.dueDate.localeCompare(b.task.dueDate) || PRIORITY_RANK[a.task.priority] - PRIORITY_RANK[b.task.priority];
  if (view === "completed") {
    return rows.sort((a, b) => (b.task.completedDate ?? "").localeCompare(a.task.completedDate ?? ""));
  }
  if (view === "overdue") return rows.sort((a, b) => b.dueInDays - a.dueInDays || byDue(a, b));
  // Open work first (by due date), completed work last.
  return rows.sort((a, b) => Number(a.task.status === "done") - Number(b.task.status === "done") || byDue(a, b));
}

export function applyTaskFilters(rows: TaskRow[], f: TaskFilters): TaskRow[] {
  return sortRows(
    rows.filter(
      (r) =>
        inView(r, f.view) &&
        (!f.project || r.task.projectId === f.project) &&
        (!f.owner || r.task.owner === f.owner) &&
        (!f.priority || r.task.priority === f.priority) &&
        (!f.status || r.task.status === f.status),
    ),
    f.view,
  );
}

/** Counts per view for the tab labels, with the non-view filters applied. */
export function viewCounts(rows: TaskRow[], f: TaskFilters): Record<TaskView, number> {
  const counts = {} as Record<TaskView, number>;
  for (const v of TASK_VIEWS) counts[v.key] = applyTaskFilters(rows, { ...f, view: v.key }).length;
  return counts;
}
