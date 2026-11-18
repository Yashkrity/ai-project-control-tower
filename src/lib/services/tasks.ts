/**
 * Task use-cases: validated writes (rules run inside the repository's write
 * lock) plus activity-log entries for events a PM cares about.
 */
import type { PortfolioRepository } from "@/lib/data/repository";
import type { ISODate, Task, TaskInput } from "@/lib/types";
import { assertTaskDeletable, resolveTaskWrite, type TaskWriteResult } from "@/lib/tasks/rules";
import { daysBetween, formatDate } from "@/lib/utils/dates";
import { CURRENT_ACTOR } from "./projects";
import { reopenMilestoneIfIncomplete } from "./milestones";

export interface TaskWriteContext {
  today: ISODate;
  overrideDependencies?: boolean;
}

function completionNote(task: Task): string {
  if (!task.completedDate) return "";
  const slip = daysBetween(task.dueDate, task.completedDate);
  const timing = slip === 0 ? "on its due date" : slip > 0 ? `${slip} day${slip === 1 ? "" : "s"} late` : `${-slip} day${slip === -1 ? "" : "s"} early`;
  return `Task “${task.title}” completed on ${formatDate(task.completedDate)} (${timing}).`;
}

async function logWrite(repo: PortfolioRepository, task: Task, before: Task | null, result: TaskWriteResult) {
  const entries: { kind: "status" | "decision"; summary: string }[] = [];

  if (result.overriddenPredecessors.length) {
    entries.push({
      kind: "decision",
      summary: `Task “${task.title}” marked done with incomplete predecessors (override): ${result.overriddenPredecessors.map((p) => `“${p.title}”`).join(", ")}.`,
    });
  }
  if (result.transition === "completed") {
    entries.push({ kind: "status", summary: completionNote(task) });
  } else if (result.transition === "reopened" && before?.completedDate) {
    entries.push({ kind: "status", summary: `Task “${task.title}” reopened (was completed on ${formatDate(before.completedDate)}).` });
  }
  if (task.status === "blocked" && before?.status !== "blocked") {
    entries.push({ kind: "status", summary: `Task “${task.title}” marked blocked.` });
  }

  for (const entry of entries) {
    await repo.addProjectUpdate({ projectId: task.projectId, author: CURRENT_ACTOR, ...entry });
  }

  await syncMilestones(repo, task, before);
}

/** Logs milestone association changes and reopens a completed milestone that gained open work. */
async function syncMilestones(repo: PortfolioRepository, task: Task, before: Task | null) {
  const from = before?.milestoneId ?? null;
  const to = task.milestoneId;
  const nameOf = async (id: string) => (await repo.getMilestone(id))?.name ?? "a deleted milestone";
  const note = (summary: string) => repo.addProjectUpdate({ projectId: task.projectId, author: CURRENT_ACTOR, kind: "milestone", summary });

  if (from !== to) {
    if (from) await note(`“${task.title}” removed from milestone “${await nameOf(from)}”.`);
    if (to) await note(`“${task.title}” added to milestone “${await nameOf(to)}”.`);
  }
  if (to && task.status !== "done") {
    const milestone = await repo.getMilestone(to);
    if (milestone?.actualDate) await reopenMilestoneIfIncomplete(repo, to, `task “${task.title}” is no longer done`);
  }
}

export async function createTask(repo: PortfolioRepository, input: TaskInput, ctx: TaskWriteContext): Promise<Task> {
  let result!: TaskWriteResult;
  const task = await repo.createTask((data) => {
    result = resolveTaskWrite(data, null, input, ctx);
    return result.draft;
  });
  await logWrite(repo, task, null, result);
  return task;
}

/** Returns null when the task does not exist. Throws TaskRuleError on rule violations. */
export async function updateTask(
  repo: PortfolioRepository,
  id: string,
  input: TaskInput,
  ctx: TaskWriteContext,
): Promise<Task | null> {
  let result!: TaskWriteResult;
  let before = null as Task | null;
  const task = await repo.updateTask(id, (data, existing) => {
    before = existing;
    result = resolveTaskWrite(data, existing, input, ctx);
    return result.draft;
  });
  if (task) await logWrite(repo, task, before, result);
  return task;
}

/** Returns the deleted task, or null when it did not exist. Throws TaskRuleError when others depend on it. */
export async function deleteTask(repo: PortfolioRepository, id: string): Promise<Task | null> {
  const task = await repo.deleteTask(id, assertTaskDeletable);
  if (task) {
    await repo.addProjectUpdate({
      projectId: task.projectId,
      author: CURRENT_ACTOR,
      kind: "general",
      summary: `Task “${task.title}” deleted.`,
    });
  }
  return task;
}
