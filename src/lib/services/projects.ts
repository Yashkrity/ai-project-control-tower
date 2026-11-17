/**
 * Project use-cases: repository writes plus the activity log entries that
 * feed "Recent project updates". Actions call these; they never write the
 * repository directly, so logging rules live in one place.
 */
import type { PortfolioRepository } from "@/lib/data/repository";
import type { Project, ProjectInput, UpdateKind } from "@/lib/types";
import { formatDate } from "@/lib/utils/dates";
import { formatCurrency, humanize } from "@/lib/utils/format";

/** Placeholder author until authentication exists. */
export const CURRENT_ACTOR = "Workspace user";

export async function createProject(repo: PortfolioRepository, input: ProjectInput): Promise<Project> {
  const project = await repo.createProject(input);
  await repo.addProjectUpdate({
    projectId: project.id,
    author: CURRENT_ACTOR,
    kind: "general",
    summary: `Project created (${humanize(project.status)}, ${humanize(project.health)}).`,
  });
  return project;
}

/** Describes material changes worth logging; ignores cosmetic edits. */
export function describeProjectChanges(before: ProjectInput, after: ProjectInput): { kind: UpdateKind; summary: string } | null {
  const changes: string[] = [];
  let kind: UpdateKind = "general";

  if (before.status !== after.status) {
    changes.push(`Status changed from ${humanize(before.status)} to ${humanize(after.status)}.`);
    kind = "status";
  }
  if (before.health !== after.health) {
    changes.push(`Health changed from ${humanize(before.health)} to ${humanize(after.health)}.`);
    kind = "status";
  }
  if (before.targetEndDate !== after.targetEndDate) {
    changes.push(`Target end date moved from ${formatDate(before.targetEndDate)} to ${formatDate(after.targetEndDate)}.`);
  }
  if (before.budget !== after.budget) {
    changes.push(`Budget changed from ${formatCurrency(before.budget)} to ${formatCurrency(after.budget)}.`);
  }
  return changes.length ? { kind, summary: changes.join(" ") } : null;
}

export async function updateProject(
  repo: PortfolioRepository,
  id: string,
  input: ProjectInput,
): Promise<Project | null> {
  const before = await repo.getProject(id);
  if (!before) return null;
  const after = await repo.updateProject(id, input);
  if (!after) return null;
  const change = describeProjectChanges(before, after);
  if (change) {
    await repo.addProjectUpdate({ projectId: id, author: CURRENT_ACTOR, ...change });
  }
  return after;
}

export async function setProjectArchived(
  repo: PortfolioRepository,
  id: string,
  archived: boolean,
): Promise<Project | null> {
  const before = await repo.getProject(id);
  if (!before) return null;
  if ((before.archivedAt !== null) === archived) return before; // already in that state
  const project = await repo.setProjectArchived(id, archived);
  if (project) {
    await repo.addProjectUpdate({
      projectId: id,
      author: CURRENT_ACTOR,
      kind: "general",
      summary: archived ? "Project archived." : "Project restored from archive.",
    });
  }
  return project;
}
