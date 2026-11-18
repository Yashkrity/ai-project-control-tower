import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRepository, getToday } from "@/lib/data";
import { isTaskOverdue } from "@/lib/metrics/portfolio";
import { indexTasks, successorsOf, taskBlockInfo } from "@/lib/tasks/rules";
import { daysBetween } from "@/lib/utils/dates";
import { TaskDetail } from "@/components/tasks/task-detail";
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
  return (
    <TaskDetail
      task={task}
      project={project}
      milestone={data.milestones.find((m) => m.id === task.milestoneId) ?? null}
      predecessors={task.dependsOn.map((d) => byId.get(d)).filter((t) => t !== undefined)}
      successors={successorsOf(task.id, data.tasks)}
      block={taskBlockInfo(task, byId, today)}
      overdueDays={isTaskOverdue(task, today) ? daysBetween(task.dueDate, today) : null}
    />
  );
}

export default function TaskPage({ params }: PageProps<"/tasks/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-[480px] rounded-xl" />}>
      <TaskContent params={params} />
    </Suspense>
  );
}
