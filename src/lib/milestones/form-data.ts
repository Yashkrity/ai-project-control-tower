import type { PortfolioData } from "@/lib/types";

/** Options for the milestone form: non-archived projects; owners seen in milestones and project managers. */
export function milestoneFormOptions(data: PortfolioData) {
  const live = data.projects.filter((p) => p.archivedAt === null);
  const owners = new Set([...data.milestones.map((m) => m.owner), ...live.map((p) => p.projectManager)]);
  return {
    projects: live.map((p) => ({ id: p.id, name: p.name })).sort((a, b) => a.name.localeCompare(b.name)),
    owners: [...owners].sort((a, b) => a.localeCompare(b)),
  };
}
