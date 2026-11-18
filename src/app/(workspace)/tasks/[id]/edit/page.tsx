import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRepository, getToday } from "@/lib/data";
import { taskFormOptions } from "@/lib/tasks/form-data";
import { taskToFormValues } from "@/lib/validation/task";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { TaskForm } from "@/components/tasks/task-form";
import { updateTaskAction } from "../../actions";

export const metadata: Metadata = { title: "Edit task" };

async function EditTaskForm({ params }: { params: PageProps<"/tasks/[id]/edit">["params"] }) {
  const { id } = await params;
  const today = await getToday();
  const data = await (await getRepository()).getPortfolio();
  const task = data.tasks.find((t) => t.id === id);
  if (!task) notFound();

  return (
    <div className="space-y-6">
      <PageHeader title={`Edit “${task.title}”`} description="Changes are validated against the project, milestone and dependency rules." />
      <TaskForm
        key={task.updatedAt}
        action={updateTaskAction.bind(null, task.id)}
        initialValues={taskToFormValues(task)}
        submitLabel="Save changes"
        cancelHref={`/tasks/${task.id}`}
        currentTaskId={task.id}
        today={today}
        {...taskFormOptions(data)}
      />
    </div>
  );
}

export default function EditTaskPage({ params }: PageProps<"/tasks/[id]/edit">) {
  return (
    <div className="mx-auto max-w-3xl">
      <Suspense fallback={<Skeleton className="h-[640px] rounded-xl" />}>
        <EditTaskForm params={params} />
      </Suspense>
    </div>
  );
}
