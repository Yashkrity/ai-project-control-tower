import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRepository, getToday } from "@/lib/data";
import { milestoneState, milestoneStates } from "@/lib/milestones/rules";
import { applyTaskFilters, buildTaskRows } from "@/lib/tasks/views";
import { MilestoneDetail } from "@/components/milestones/milestone-detail";
import { LinkedRaidList } from "@/components/raid/linked-raid-list";
import { applyRaidFilters, buildRaidRows } from "@/lib/raid/views";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Milestone" };

async function MilestoneContent({ params }: { params: PageProps<"/milestones/[id]">["params"] }) {
  const { id } = await params;
  const today = await getToday();
  const data = await (await getRepository()).getPortfolio();
  const milestone = data.milestones.find((m) => m.id === id);
  const project = milestone && data.projects.find((p) => p.id === milestone.projectId);
  if (!milestone || !project) notFound();

  const projectTasks = data.tasks.filter((t) => t.projectId === project.id);
  const state = milestoneState(milestone, projectTasks, today);
  const taskRows = applyTaskFilters(
    buildTaskRows(data, today, { includeArchived: true }).filter((r) => r.task.milestoneId === id),
    { view: "all" },
  );
  const siblings = data.milestones.filter((m) => m.projectId === project.id && m.id !== id);
  const states = milestoneStates({ milestones: siblings, tasks: projectTasks }, today);
  const nameOf = new Map(siblings.map((m) => [m.id, m.name]));

  const raid = applyRaidFilters(buildRaidRows(data, today, { includeArchived: true }).filter((r) => r.item.milestoneId === id), { tab: "all", sort: "deadline" });

  return (
    <div className="space-y-6">
    <MilestoneDetail
      milestone={milestone}
      project={project}
      state={state}
      taskRows={taskRows}
      candidates={projectTasks
        .filter((t) => t.milestoneId !== id)
        .sort((a, b) => a.title.localeCompare(b.title))
        .map((t) => ({ id: t.id, title: t.title, status: t.status, currentMilestone: t.milestoneId ? (nameOf.get(t.milestoneId) ?? null) : null }))}
      otherMilestones={siblings.map((m) => ({ id: m.id, name: m.name, completed: states.get(m.id)?.status === "completed" }))}
    />
    <LinkedRaidList rows={raid} newHref={`/raid/new?project=${project.id}&milestone=${id}`} readOnly={project.archivedAt !== null} />
    </div>
  );
}

export default function MilestonePage({ params }: PageProps<"/milestones/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-[520px] rounded-xl" />}>
      <MilestoneContent params={params} />
    </Suspense>
  );
}
