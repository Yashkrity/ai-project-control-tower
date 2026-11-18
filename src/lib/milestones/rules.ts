/**
 * Milestone rules: task-derived progress, calculated status, and the
 * integrity checks for writes. Pure functions, used inside the repository's
 * write lock, by pages, and by tests.
 *
 * Status is calculated, never typed in. Precedence (first match wins):
 *   1. completed    actual completion date recorded AND every linked task done
 *   2. delayed      not completed and the planned completion date has passed
 *   3. at_risk      due within AT_RISK_WINDOW_DAYS with open tasks,
 *                   OR any linked task is blocked
 *   4. in_progress  at least one linked task has started
 *                   (in progress, blocked or done; on hold does not count)
 *   5. not_started  no linked task has started, or no tasks are linked
 */
import type { ISODate, Milestone, MilestoneDraft, MilestoneInput, MilestoneStatus, PortfolioData, Task, TaskStatus } from "@/lib/types";
import { indexTasks, taskBlockInfo } from "@/lib/tasks/rules";
import { addDays, daysBetween, formatDate } from "@/lib/utils/dates";

export const AT_RISK_WINDOW_DAYS = 14;
export const UPCOMING_WINDOW_DAYS = 30;

const STARTED: TaskStatus[] = ["in_progress", "blocked", "done"];
const quoted = (tasks: Pick<Task, "title">[], max = 3) => {
  const names = tasks.slice(0, max).map((t) => `“${t.title}”`);
  return tasks.length > max ? `${names.join(", ")} and ${tasks.length - max} more` : names.join(", ");
};
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/* ------------------------------------------------------------------ */
/* Progress and status                                                 */
/* ------------------------------------------------------------------ */

export interface MilestoneProgress {
  completed: number;
  total: number;
  /** null when no tasks are linked ("No tasks linked", never 0%). */
  percent: number | null;
}

/** Completed tasks / total linked tasks × 100, rounded to a whole number. */
export function milestoneProgress(tasks: Task[]): MilestoneProgress {
  const total = tasks.length;
  const completed = tasks.filter((t) => t.status === "done").length;
  return { completed, total, percent: total === 0 ? null : Math.round((completed / total) * 100) };
}

export function formatProgress(p: MilestoneProgress): string {
  return p.percent === null ? "No tasks linked" : `${p.percent}%`;
}

export interface MilestoneState {
  status: MilestoneStatus;
  progress: MilestoneProgress;
  tasks: Task[];
  openTasks: Task[];
  blockedTasks: Task[];
  /** Every linked task is done but no completion date is recorded yet. */
  readyToComplete: boolean;
  /** Planned completion minus today (negative = days overdue). */
  daysToPlanned: number;
  /** Actual minus planned completion, when completed (positive = late). */
  slipDays: number | null;
  /** Plain-language reason for the status. */
  explanation: string;
}

/**
 * @param projectTasks all tasks of the milestone's project (needed to judge
 *   whether linked tasks are blocked by their predecessors)
 */
export function milestoneState(milestone: Milestone, projectTasks: Task[], today: ISODate): MilestoneState {
  const tasks = projectTasks.filter((t) => t.milestoneId === milestone.id);
  const progress = milestoneProgress(tasks);
  const openTasks = tasks.filter((t) => t.status !== "done");
  const byId = indexTasks(projectTasks);
  const blockedTasks = tasks.filter((t) => taskBlockInfo(t, byId, today).blocked);
  const daysToPlanned = daysBetween(today, milestone.plannedDate);
  const allDone = openTasks.length === 0;
  const done = `${progress.completed} of ${progress.total} tasks done`;

  const base = { progress, tasks, openTasks, blockedTasks, daysToPlanned };

  if (milestone.actualDate && allDone) {
    const slip = daysBetween(milestone.plannedDate, milestone.actualDate);
    const timing = slip === 0 ? "on the planned date" : slip > 0 ? `${plural(slip, "day")} late` : `${plural(-slip, "day")} early`;
    return { ...base, status: "completed", readyToComplete: false, slipDays: slip, explanation: `Completed on ${formatDate(milestone.actualDate)}, ${timing}.` };
  }

  const readyToComplete = tasks.length > 0 && allDone && !milestone.actualDate;
  const pending = milestone.actualDate
    ? ` A completion date is recorded, but ${plural(openTasks.length, "linked task")} ${openTasks.length === 1 ? "is" : "are"} not done.`
    : readyToComplete
      ? " Every linked task is done: record the actual completion date to complete it."
      : "";
  const result = (status: MilestoneStatus, explanation: string): MilestoneState => ({
    ...base,
    status,
    readyToComplete,
    slipDays: null,
    explanation: explanation + pending,
  });

  if (daysToPlanned < 0) {
    return result(
      "delayed",
      `Planned completion (${formatDate(milestone.plannedDate)}) passed ${plural(-daysToPlanned, "day")} ago` +
        (tasks.length ? ` with ${done}.` : " and no completion date is recorded."),
    );
  }

  const approaching = daysToPlanned <= AT_RISK_WINDOW_DAYS && openTasks.length > 0;
  if (approaching || blockedTasks.length) {
    const reasons: string[] = [];
    if (approaching) reasons.push(`due in ${plural(daysToPlanned, "day")} with ${plural(openTasks.length, "open task")}`);
    if (blockedTasks.length) reasons.push(`${blockedTasks.length === 1 ? "a linked task is" : `${blockedTasks.length} linked tasks are`} blocked (${quoted(blockedTasks)})`);
    const text = reasons.join("; and ");
    return result("at_risk", `${text.charAt(0).toUpperCase()}${text.slice(1)}.`);
  }

  if (tasks.some((t) => STARTED.includes(t.status))) return result("in_progress", `${done}.`);
  return result("not_started", tasks.length ? "No linked task has started yet." : "No tasks linked.");
}

/** States for every milestone of every given project, keyed by milestone ID. */
export function milestoneStates(data: Pick<PortfolioData, "milestones" | "tasks">, today: ISODate): Map<string, MilestoneState> {
  const tasksByProject = new Map<string, Task[]>();
  for (const t of data.tasks) {
    const list = tasksByProject.get(t.projectId) ?? [];
    list.push(t);
    tasksByProject.set(t.projectId, list);
  }
  return new Map(data.milestones.map((m) => [m.id, milestoneState(m, tasksByProject.get(m.projectId) ?? [], today)]));
}

export const isUpcoming = (m: Milestone, s: MilestoneState, today: ISODate, days = UPCOMING_WINDOW_DAYS) =>
  s.status !== "completed" && m.plannedDate >= today && m.plannedDate <= addDays(today, days);

/* ------------------------------------------------------------------ */
/* Write rules                                                         */
/* ------------------------------------------------------------------ */

export type MilestoneErrorField = "projectId" | "actualDate" | "form";
export type MilestoneRuleErrors = Partial<Record<MilestoneErrorField, string[]>>;

export class MilestoneRuleError extends Error {
  constructor(readonly fieldErrors: MilestoneRuleErrors) {
    super(Object.values(fieldErrors).flat()[0] ?? "Milestone rule violated");
    this.name = "MilestoneRuleError";
  }
}

export interface MilestoneWriteResult {
  draft: MilestoneDraft;
  transition: "completed" | "reopened" | null;
  /** Human-readable schedule changes, e.g. "Planned completion moved from … to …". */
  dateChanges: string[];
}

/**
 * Validates a create (existing = null) or update against the portfolio.
 * Field formats and date order are checked by the form schema; this checks
 * associations and the completion rule. Throws MilestoneRuleError.
 */
export function resolveMilestoneWrite(
  data: PortfolioData,
  existing: Milestone | null,
  input: MilestoneInput,
  today: ISODate,
): MilestoneWriteResult {
  const errors: MilestoneRuleErrors = {};
  const add = (field: MilestoneErrorField, message: string) => (errors[field] ??= []).push(message);

  const project = data.projects.find((p) => p.id === input.projectId);
  if (!project) add("projectId", "Choose a project that exists.");
  else if (project.archivedAt !== null) add("projectId", `“${project.name}” is archived. Restore it before changing its milestones.`);

  const linked = existing ? data.tasks.filter((t) => t.milestoneId === existing.id) : [];
  if (existing && existing.projectId !== input.projectId && linked.length) {
    add("projectId", `${plural(linked.length, "task")} ${linked.length === 1 ? "is" : "are"} linked to this milestone. Unlink or move ${linked.length === 1 ? "it" : "them"} before changing the project.`);
  }

  if (input.actualDate) {
    if (input.actualDate > today) add("actualDate", `The actual completion date cannot be in the future (today is ${formatDate(today)}).`);
    const open = linked.filter((t) => t.status !== "done");
    if (open.length) {
      add("actualDate", `Cannot record completion: ${plural(open.length, "linked task")} ${open.length === 1 ? "is" : "are"} not done (${quoted(open)}).`);
    }
  }

  if (Object.keys(errors).length) throw new MilestoneRuleError(errors);

  const dateChanges: string[] = [];
  if (existing && existing.plannedStartDate !== input.plannedStartDate) {
    dateChanges.push(`planned start moved from ${formatDate(existing.plannedStartDate)} to ${formatDate(input.plannedStartDate)}`);
  }
  if (existing && existing.plannedDate !== input.plannedDate) {
    dateChanges.push(`planned completion moved from ${formatDate(existing.plannedDate)} to ${formatDate(input.plannedDate)}`);
  }

  const wasDone = !!existing?.actualDate;
  const isDone = !!input.actualDate;
  return {
    draft: { ...input },
    transition: isDone && !wasDone ? "completed" : !isDone && wasDone ? "reopened" : null,
    dateChanges,
  };
}

export type DeleteChoice = { mode: "none" } | { mode: "unlink" } | { mode: "reassign"; target: string };

/** Decides what happens to linked tasks when a milestone is deleted. */
export function planMilestoneDelete(data: PortfolioData, milestone: Milestone, choice: DeleteChoice): { reassignTo: string | null } {
  const linked = data.tasks.filter((t) => t.milestoneId === milestone.id);
  if (linked.length === 0) return { reassignTo: null };

  if (choice.mode === "none") {
    throw new MilestoneRuleError({
      form: [`${plural(linked.length, "task")} ${linked.length === 1 ? "is" : "are"} linked to this milestone. Choose whether to unlink ${linked.length === 1 ? "it" : "them"} or move ${linked.length === 1 ? "it" : "them"} to another milestone.`],
    });
  }
  if (choice.mode === "unlink") return { reassignTo: null };

  const target = data.milestones.find((m) => m.id === choice.target);
  if (!target || target.id === milestone.id) throw new MilestoneRuleError({ form: ["Choose another milestone to move the tasks to."] });
  if (target.projectId !== milestone.projectId) throw new MilestoneRuleError({ form: ["Tasks can only move to a milestone in the same project."] });
  const open = linked.filter((t) => t.status !== "done");
  if (target.actualDate && open.length) {
    throw new MilestoneRuleError({ form: [`“${target.name}” is completed, so unfinished tasks (${quoted(open)}) cannot move to it. Reopen it first or unlink the tasks.`] });
  }
  return { reassignTo: target.id };
}

/** Validates linking tasks to a milestone (milestoneId) or unlinking them (null). */
export function assertTasksLinkable(data: PortfolioData, tasks: Task[], requestedIds: string[], milestoneId: string | null): void {
  const missing = requestedIds.filter((id) => !tasks.some((t) => t.id === id));
  if (missing.length) throw new MilestoneRuleError({ form: [`Some tasks no longer exist (${missing.length}). Refresh and try again.`] });
  if (milestoneId === null) return;

  const milestone = data.milestones.find((m) => m.id === milestoneId);
  if (!milestone) throw new MilestoneRuleError({ form: ["This milestone no longer exists."] });
  const project = data.projects.find((p) => p.id === milestone.projectId);
  if (project?.archivedAt) throw new MilestoneRuleError({ form: [`“${project.name}” is archived. Restore it before changing its milestones.`] });
  const foreign = tasks.filter((t) => t.projectId !== milestone.projectId);
  if (foreign.length) throw new MilestoneRuleError({ form: [`Only tasks in the same project can be linked (${quoted(foreign)} ${foreign.length === 1 ? "is" : "are"} not).`] });
  const open = tasks.filter((t) => t.status !== "done");
  if (milestone.actualDate && open.length) {
    throw new MilestoneRuleError({ form: [`“${milestone.name}” is completed. Reopen it (clear its completion date) before adding unfinished work.`] });
  }
}
