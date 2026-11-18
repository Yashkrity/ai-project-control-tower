/**
 * Task integrity rules. Pure functions over the portfolio, used:
 *  - inside the repository's write lock (so checks and the write are atomic)
 *  - by pages, to explain why a task is blocked
 *  - by unit tests
 */
import type { ISODate, PortfolioData, Task, TaskDraft, TaskInput } from "@/lib/types";
import { addDays, formatDate } from "@/lib/utils/dates";
import { humanize } from "@/lib/utils/format";

export type TaskErrorField =
  | "projectId"
  | "milestoneId"
  | "status"
  | "dependsOn"
  | "completedDate"
  | "form";
export type TaskRuleErrors = Partial<Record<TaskErrorField, string[]>>;

/** Thrown when a write would break a task rule; carries field-level messages. */
export class TaskRuleError extends Error {
  constructor(readonly fieldErrors: TaskRuleErrors) {
    super(Object.values(fieldErrors).flat()[0] ?? "Task rule violated");
    this.name = "TaskRuleError";
  }
}

/** Tasks due within this many days (inclusive) count as "due soon". */
export const DUE_SOON_DAYS = 7;

export const taskLabel = (t: Pick<Task, "title" | "status">) => `“${t.title}” (${humanize(t.status)})`;

/* ------------------------------------------------------------------ */
/* Read-side rules                                                     */
/* ------------------------------------------------------------------ */

export function indexTasks(tasks: Task[]): Map<string, Task> {
  return new Map(tasks.map((t) => [t.id, t]));
}

/** Predecessors that are not done (unknown IDs are ignored here; writes reject them). */
export function incompletePredecessors(task: Task, byId: Map<string, Task>): Task[] {
  return task.dependsOn
    .map((id) => byId.get(id))
    .filter((p): p is Task => !!p && p.status !== "done");
}

/** Tasks that list `taskId` as a predecessor. */
export function successorsOf(taskId: string, tasks: Task[]): Task[] {
  return tasks.filter((t) => t.dependsOn.includes(taskId));
}

export interface BlockInfo {
  blocked: boolean;
  /** Status explicitly set to Blocked. */
  byStatus: boolean;
  /** Should be underway (start date reached) but predecessors are not done. */
  byDependencies: boolean;
  /** Incomplete predecessors (shown even when they do not block yet). */
  waitingOn: Task[];
}

/**
 * A task is blocked when its status is Blocked, or when it is not done or on
 * hold, its start date has arrived, and at least one predecessor is not done.
 * The start-date gate keeps future tasks in a normal sequence from counting.
 */
export function taskBlockInfo(task: Task, byId: Map<string, Task>, today: ISODate): BlockInfo {
  const waitingOn = task.status === "done" ? [] : incompletePredecessors(task, byId);
  const byStatus = task.status === "blocked";
  const byDependencies =
    task.status !== "done" && task.status !== "on_hold" && waitingOn.length > 0 && task.startDate <= today;
  return { blocked: byStatus || byDependencies, byStatus, byDependencies, waitingOn };
}

export function isTaskDueSoon(task: Task, today: ISODate, days = DUE_SOON_DAYS): boolean {
  return task.status !== "done" && task.dueDate >= today && task.dueDate <= addDays(today, days);
}

/**
 * If `taskId` were given predecessors `dependsOn`, would the graph contain a
 * cycle? Returns the cycle as task IDs (starting and ending at `taskId`), or null.
 */
export function findCycle(taskId: string, dependsOn: string[], tasks: Task[]): string[] | null {
  const edges = new Map(tasks.map((t) => [t.id, t.dependsOn]));
  edges.set(taskId, dependsOn);

  // Depth-first search along "depends on" edges, looking for a way back to taskId.
  // The returned path reads "A depends on B depends on ... depends on A".
  const visited = new Set<string>();
  const path: string[] = [taskId];
  const visit = (node: string): boolean => {
    for (const next of edges.get(node) ?? []) {
      if (next === taskId) {
        path.push(taskId);
        return true;
      }
      if (visited.has(next)) continue;
      visited.add(next);
      path.push(next);
      if (visit(next)) return true;
      path.pop();
    }
    return false;
  };
  return visit(taskId) ? path : null;
}

/** IDs of every task that depends on `taskId`, directly or transitively. */
export function dependentsClosure(taskId: string, tasks: Pick<Task, "id" | "dependsOn">[]): Set<string> {
  const result = new Set<string>();
  const queue = [taskId];
  while (queue.length) {
    const id = queue.shift()!;
    for (const t of tasks) {
      if (t.dependsOn.includes(id) && !result.has(t.id)) {
        result.add(t.id);
        queue.push(t.id);
      }
    }
  }
  return result;
}

/* ------------------------------------------------------------------ */
/* Write-side rules                                                    */
/* ------------------------------------------------------------------ */

export type CompletionTransition = "completed" | "reopened" | null;

export interface TaskWriteResult {
  draft: TaskDraft;
  transition: CompletionTransition;
  /** Predecessors still open when the task was marked done via override. */
  overriddenPredecessors: Task[];
}

export interface TaskWriteOptions {
  today: ISODate;
  /** Explicitly allow Done while predecessors are incomplete. */
  overrideDependencies?: boolean;
}

/**
 * Validates a create (existing = null) or update against the whole portfolio
 * and returns the record to store. Throws TaskRuleError with field messages.
 *
 * Completion date lifecycle:
 *  - becomes Done: the submitted date, else today
 *  - stays Done: the submitted date, else the stored one
 *  - leaves Done (reopened): cleared
 *  - never in the future
 */
export function resolveTaskWrite(
  data: PortfolioData,
  existing: Task | null,
  input: TaskInput,
  { today, overrideDependencies = false }: TaskWriteOptions,
): TaskWriteResult {
  const errors: TaskRuleErrors = {};
  const add = (field: TaskErrorField, message: string) => (errors[field] ??= []).push(message);
  const byId = indexTasks(data.tasks);
  const taskId = existing?.id ?? "__new__";

  // Project
  const project = data.projects.find((p) => p.id === input.projectId);
  if (!project) add("projectId", "Choose a project that exists.");
  else if (project.archivedAt !== null) add("projectId", `“${project.name}” is archived. Restore it before changing its tasks.`);

  // Moving a task to another project would strand cross-project dependencies.
  if (existing && project && existing.projectId !== input.projectId) {
    const others = successorsOf(existing.id, data.tasks).filter((t) => t.projectId !== input.projectId);
    if (others.length) {
      add("projectId", `Other tasks depend on this one: ${others.map((t) => `“${t.title}”`).join(", ")}. Remove those dependencies before moving it.`);
    }
  }

  // Milestone
  if (input.milestoneId) {
    const milestone = data.milestones.find((m) => m.id === input.milestoneId);
    if (!milestone) add("milestoneId", "Choose a milestone that exists.");
    else if (milestone.projectId !== input.projectId) add("milestoneId", "The milestone belongs to a different project.");
    else if (milestone.actualDate && input.status !== "done" && existing?.milestoneId !== milestone.id) {
      // Linking unfinished work would silently undo a recorded completion.
      add("milestoneId", `“${milestone.name}” is completed. Reopen it (clear its completion date) before adding unfinished work.`);
    }
  }

  // Dependencies
  const dependsOn = [...new Set(input.dependsOn)];
  for (const id of dependsOn) {
    const pred = byId.get(id);
    if (id === taskId) add("dependsOn", "A task cannot depend on itself.");
    else if (!pred) add("dependsOn", `Predecessor “${id}” does not exist.`);
    else if (pred.projectId !== input.projectId) add("dependsOn", `“${pred.title}” is in another project. Dependencies must be within the same project.`);
  }
  if (!errors.dependsOn && existing) {
    const cycle = findCycle(existing.id, dependsOn, data.tasks);
    if (cycle) {
      const names = cycle.map((id) => (id === existing.id ? `“${input.title}”` : `“${byId.get(id)?.title ?? id}”`));
      add("dependsOn", `This would create a circular dependency: ${names.join(" → ")}.`);
    }
  }

  // Done gate
  const openPreds = dependsOn.map((id) => byId.get(id)).filter((p): p is Task => !!p && p.status !== "done");
  const wasDone = existing?.status === "done";
  const isDone = input.status === "done";
  let overriddenPredecessors: Task[] = [];
  if (isDone && openPreds.length && !errors.dependsOn) {
    if (overrideDependencies) {
      overriddenPredecessors = wasDone ? [] : openPreds;
    } else if (!wasDone) {
      add("status", `Cannot mark as done: still waiting on ${openPreds.map(taskLabel).join(", ")}. Complete those first, or tick “Complete anyway”.`);
    }
  }

  // Completion date
  let completedDate: ISODate | null = null;
  if (isDone) {
    completedDate = input.completedDate ?? (wasDone ? existing!.completedDate : null) ?? today;
    if (completedDate > today) add("completedDate", `Completion date cannot be in the future (today is ${formatDate(today)}).`);
  }

  if (Object.keys(errors).length) throw new TaskRuleError(errors);

  return {
    draft: { ...input, dependsOn, completedDate },
    transition: isDone && !wasDone ? "completed" : !isDone && wasDone ? "reopened" : null,
    overriddenPredecessors,
  };
}

/** A task that others depend on cannot be deleted until they stop depending on it. */
export function assertTaskDeletable(data: PortfolioData, task: Task): void {
  const successors = successorsOf(task.id, data.tasks);
  if (successors.length) {
    throw new TaskRuleError({
      form: [`Cannot delete: ${successors.map((t) => `“${t.title}”`).join(", ")} ${successors.length === 1 ? "depends" : "depend"} on this task. Remove those dependencies first.`],
    });
  }
}
