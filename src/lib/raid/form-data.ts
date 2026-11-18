import type { PortfolioData } from "@/lib/types";

/** Options for the RAID form: non-archived projects and their milestones and tasks. */
export function raidFormOptions(data: PortfolioData) {
  const live = data.projects.filter((p) => p.archivedAt === null);
  const ids = new Set(live.map((p) => p.id));
  const owners = new Set([...data.raidItems.map((r) => r.owner), ...live.map((p) => p.projectManager)]);
  return {
    projects: live.map((p) => ({ id: p.id, name: p.name })).sort((a, b) => a.name.localeCompare(b.name)),
    milestones: data.milestones.filter((m) => ids.has(m.projectId)).map((m) => ({ id: m.id, projectId: m.projectId, name: m.name })),
    tasks: data.tasks
      .filter((t) => ids.has(t.projectId))
      .map((t) => ({ id: t.id, projectId: t.projectId, title: t.title }))
      .sort((a, b) => a.title.localeCompare(b.title)),
    owners: [...owners].sort((a, b) => a.localeCompare(b)),
  };
}
