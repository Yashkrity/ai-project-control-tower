import { Suspense } from "react";
import type { Metadata } from "next";
import { getRepository, getToday } from "@/lib/data";
import { taskFormOptions } from "@/lib/tasks/form-data";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { TaskForm } from "@/components/tasks/task-form";
import { createTaskAction } from "../actions";

export const metadata: Metadata = { title: "New task" };

async function NewTaskForm({ searchParams }: { searchParams: PageProps<"/tasks/new">["searchParams"] }) {
  const { project } = await searchParams;
  const today = await getToday();
  const options = taskFormOptions(await (await getRepository()).getPortfolio());
  const projectId = typeof project === "string" && options.projects.some((p) => p.id === project) ? project : "";

  return (
    <TaskForm
      // Remount when ?project changes, so client state starts fresh.
      key={projectId}
      action={createTaskAction}
      initialValues={{ projectId, status: "not_started", priority: "medium", dependsOn: [] }}
      submitLabel="Create task"
      cancelHref={projectId ? `/projects/${projectId}` : "/tasks"}
      today={today}
      {...options}
    />
  );
}

export default function NewTaskPage({ searchParams }: PageProps<"/tasks/new">) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="New task" description="Fields marked * are required." />
      <Suspense fallback={<Skeleton className="h-[640px] rounded-xl" />}>
        <NewTaskForm searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
