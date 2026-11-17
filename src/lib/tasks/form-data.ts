import type { PortfolioData } from "@/lib/types";

/** Options for the task form: only non-archived projects and their records. */
export function taskFormOptions(data: PortfolioData) {
  const live = data.projects.filter((p) => p.archivedAt === null);
  const liveIds = new Set(live.map((p) => p.id));
  const tasks = data.tasks.filter((t) => liveIds.has(t.projectId));
  return {
    projects: live.map((p) => ({ id: p.id, name: p.name })).sort((a, b) => a.name.localeCompare(b.name)),
    milestones: data.milestones
      .filter((m) => liveIds.has(m.projectId))
      .sort((a, b) => a.plannedDate.localeCompare(b.plannedDate))
      .map((m) => ({ id: m.id, projectId: m.projectId, name: m.name })),
    tasks: tasks
      .map((t) => ({ id: t.id, projectId: t.projectId, title: t.title, status: t.status, dependsOn: t.dependsOn }))
      .sort((a, b) => a.title.localeCompare(b.title)),
    owners: [...new Set(tasks.map((t) => t.owner))].sort((a, b) => a.localeCompare(b)),
  };
}
