import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRepository, getToday } from "@/lib/data";
import { isTaskOverdue } from "@/lib/metrics/portfolio";
import { indexTasks, successorsOf, taskBlockInfo } from "@/lib/tasks/rules";
import { daysBetween } from "@/lib/utils/dates";
import { TaskDetail } from "@/components/tasks/task-detail";
import { LinkedRaidList } from "@/components/raid/linked-raid-list";
import { applyRaidFilters, buildRaidRows } from "@/lib/raid/views";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Task" };

async function TaskContent({ params }: { params: PageProps<"/tasks/[id]">["params"] }) {
  const { id } = await params;
  const today = await getToday();
  const data = await (await getRepository()).getPortfolio();
  const task = data.tasks.find((t) => t.id === id);
  const project = task && data.projects.find((p) => p.id === task.projectId);
  if (!task || !project) notFound();

  const byId = indexTasks(data.tasks);
  const raid = applyRaidFilters(buildRaidRows(data, today, { includeArchived: true }).filter((r) => r.item.taskId === task.id), { tab: "all", sort: "deadline" });
  return (
    <div className="space-y-6">
      <TaskDetail
        task={task}
        project={project}
        milestone={data.milestones.find((m) => m.id === task.milestoneId) ?? null}
        predecessors={task.dependsOn.map((d) => byId.get(d)).filter((t) => t !== undefined)}
        successors={successorsOf(task.id, data.tasks)}
        block={taskBlockInfo(task, byId, today)}
        overdueDays={isTaskOverdue(task, today) ? daysBetween(task.dueDate, today) : null}
      />
      <LinkedRaidList rows={raid} newHref={`/raid/new?project=${project.id}&task=${task.id}`} readOnly={project.archivedAt !== null} />
    </div>
  );
}

export default function TaskPage({ params }: PageProps<"/tasks/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-[480px] rounded-xl" />}>
      <TaskContent params={params} />
    </Suspense>
  );
}
