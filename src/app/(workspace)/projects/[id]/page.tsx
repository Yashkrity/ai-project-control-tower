import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRepository, getToday } from "@/lib/data";
import { summarizeProject } from "@/lib/metrics/portfolio";
import { applyTaskFilters, buildTaskRows } from "@/lib/tasks/views";
import { buildMilestoneRows } from "@/lib/milestones/views";
import { ProjectDetail } from "@/components/projects/project-detail";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Project" };

async function ProjectContent({ params }: { params: PageProps<"/projects/[id]">["params"] }) {
  const { id } = await params;
  const today = await getToday();
  const data = await (await getRepository()).getPortfolio();
  const project = data.projects.find((p) => p.id === id);
  if (!project) notFound();

  const milestones = buildMilestoneRows(data, today, { includeArchived: true })
    .filter((r) => r.milestone.projectId === id)
    .sort((a, b) => a.milestone.plannedDate.localeCompare(b.milestone.plannedDate));
  const updates = data.updates
    .filter((u) => u.projectId === id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 10);

  const tasks = applyTaskFilters(buildTaskRows(data, today, { includeArchived: true }), { view: "all", project: id });

  return (
    <ProjectDetail
      summary={summarizeProject(project, data, today)}
      milestones={milestones}
      updates={updates}
      tasks={tasks}
      today={today}
    />
  );
}

export default function ProjectPage({ params }: PageProps<"/projects/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-[480px] rounded-xl" />}>
      <ProjectContent params={params} />
    </Suspense>
  );
}
