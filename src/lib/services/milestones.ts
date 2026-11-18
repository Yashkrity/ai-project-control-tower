/**
 * Milestone use-cases: validated writes (rules run inside the repository's
 * write lock) plus activity-log entries.
 */
import type { PortfolioRepository } from "@/lib/data/repository";
import type { ISODate, Milestone, MilestoneInput, Task } from "@/lib/types";
import {
  assertTasksLinkable,
  planMilestoneDelete,
  resolveMilestoneWrite,
  type DeleteChoice,
  type MilestoneWriteResult,
} from "@/lib/milestones/rules";
import { formatDate } from "@/lib/utils/dates";
import { CURRENT_ACTOR } from "./projects";

const log = (repo: PortfolioRepository, projectId: string, summary: string) =>
  repo.addProjectUpdate({ projectId, author: CURRENT_ACTOR, kind: "milestone", summary });

const names = (tasks: Pick<Task, "title">[]) => tasks.map((t) => `“${t.title}”`).join(", ");

export async function createMilestone(repo: PortfolioRepository, input: MilestoneInput, today: ISODate): Promise<Milestone> {
  let result!: MilestoneWriteResult;
  const milestone = await repo.createMilestone((data) => {
    result = resolveMilestoneWrite(data, null, input, today);
    return result.draft;
  });
  await log(repo, milestone.projectId, `Milestone “${milestone.name}” created, planned for ${formatDate(milestone.plannedDate)}.`);
  if (result.transition === "completed") {
    await log(repo, milestone.projectId, `Milestone “${milestone.name}” completed on ${formatDate(milestone.actualDate!)}.`);
  }
  return milestone;
}

/** Returns null when the milestone does not exist. Throws MilestoneRuleError on rule violations. */
export async function updateMilestone(
  repo: PortfolioRepository,
  id: string,
  input: MilestoneInput,
  today: ISODate,
): Promise<Milestone | null> {
  let result!: MilestoneWriteResult;
  let before = null as Milestone | null;
  const milestone = await repo.updateMilestone(id, (data, existing) => {
    before = existing;
    result = resolveMilestoneWrite(data, existing, input, today);
    return result.draft;
  });
  if (!milestone) return null;

  if (result.dateChanges.length) {
    const text = result.dateChanges.join("; ");
    await log(repo, milestone.projectId, `Milestone “${milestone.name}”: ${text}.`);
  }
  if (result.transition === "completed") {
    await log(repo, milestone.projectId, `Milestone “${milestone.name}” completed on ${formatDate(milestone.actualDate!)}.`);
  } else if (result.transition === "reopened") {
    await log(repo, milestone.projectId, `Milestone “${milestone.name}” reopened (was completed on ${formatDate(before!.actualDate!)}).`);
  }
  return milestone;
}

/** Returns null when the milestone does not exist. Throws MilestoneRuleError when linked tasks need a decision. */
export async function deleteMilestone(repo: PortfolioRepository, id: string, choice: DeleteChoice) {
  let target: Milestone | undefined;
  const result = await repo.deleteMilestone(id, (data, existing) => {
    const plan = planMilestoneDelete(data, existing, choice);
    target = plan.reassignTo ? data.milestones.find((m) => m.id === plan.reassignTo) : undefined;
    return plan;
  });
  if (!result) return null;
  const { milestone, movedTasks } = result;
  const what = movedTasks.length
    ? target
      ? `; ${movedTasks.length} task(s) moved to “${target.name}”: ${names(movedTasks)}`
      : `; ${movedTasks.length} task(s) unlinked: ${names(movedTasks)}`
    : "";
  await log(repo, milestone.projectId, `Milestone “${milestone.name}” deleted${what}.`);
  return result;
}

/** Links (milestoneId) or unlinks (null) tasks, then logs the change per milestone. */
export async function setTasksMilestone(repo: PortfolioRepository, taskIds: string[], milestoneId: string | null): Promise<Task[]> {
  const ids = [...new Set(taskIds)];
  if (ids.length === 0) return [];
  const previous = new Map<string, string | null>();
  let milestones: Milestone[] = [];
  const updated = await repo.setTasksMilestone(ids, milestoneId, (data, tasks) => {
    assertTasksLinkable(data, tasks, ids, milestoneId);
    tasks.forEach((t) => previous.set(t.id, t.milestoneId));
    milestones = data.milestones;
  });
  const nameOf = (id: string) => milestones.find((m) => m.id === id)?.name ?? "a deleted milestone";

  const changed = updated.filter((t) => previous.get(t.id) !== milestoneId);
  if (changed.length === 0) return updated;
  const projectId = changed[0].projectId;

  // Removed from previous milestones
  const bySource = new Map<string, Task[]>();
  for (const t of changed) {
    const from = previous.get(t.id);
    if (from) bySource.set(from, [...(bySource.get(from) ?? []), t]);
  }
  for (const [from, tasks] of bySource) {
    await log(repo, projectId, `${names(tasks)} removed from milestone “${nameOf(from)}”.`);
  }
  if (milestoneId) await log(repo, projectId, `${names(changed)} added to milestone “${nameOf(milestoneId)}”.`);
  return updated;
}

/**
 * Keeps completion honest: if a completed milestone now has an unfinished
 * linked task (for example a task was reopened), clear its completion date
 * and log why. Called after task writes.
 */
export async function reopenMilestoneIfIncomplete(repo: PortfolioRepository, milestoneId: string, reason: string): Promise<void> {
  let reopenedFrom = null as string | null;
  const milestone = await repo.updateMilestone(milestoneId, (data, existing) => {
    const m = existing!;
    const open = data.tasks.some((t) => t.milestoneId === m.id && t.status !== "done");
    if (!m.actualDate || !open) return m;
    reopenedFrom = m.actualDate;
    return { ...m, actualDate: null };
  });
  if (milestone && reopenedFrom) {
    await log(repo, milestone.projectId, `Milestone “${milestone.name}” reopened (was completed on ${formatDate(reopenedFrom)}): ${reason}.`);
  }
}
