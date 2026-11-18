import Link from "next/link";
import { AlertTriangle, ArrowLeft, CheckCircle2, Link2, Pencil } from "lucide-react";
import type { Project, Task } from "@/lib/types";
import type { BlockInfo } from "@/lib/tasks/rules";
import { daysBetween, formatDate } from "@/lib/utils/dates";
import { humanize } from "@/lib/utils/format";
import { deleteTaskAction } from "@/app/(workspace)/tasks/actions";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, PriorityBadge, TaskStatusBadge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { DeleteTaskButton } from "./delete-task-button";

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-900">{children}</dd>
    </div>
  );
}

function TaskLinkList({ tasks, empty }: { tasks: Task[]; empty: string }) {
  if (tasks.length === 0) return <p className="px-5 py-4 text-sm text-slate-500">{empty}</p>;
  return (
    <ul className="divide-y divide-slate-100">
      {tasks.map((t) => (
        <li key={t.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
          <Link href={`/tasks/${t.id}`} className="min-w-0 truncate text-sm font-medium text-slate-800 hover:text-indigo-700">
            {t.title}
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-xs text-slate-500">due {formatDate(t.dueDate)}</span>
            <TaskStatusBadge status={t.status} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function completionText(task: Task): string | null {
  if (task.status !== "done" || !task.completedDate) return null;
  const slip = daysBetween(task.dueDate, task.completedDate);
  const timing = slip === 0 ? "on its due date" : slip > 0 ? `${slip} day${slip === 1 ? "" : "s"} late` : `${-slip} day${slip === -1 ? "" : "s"} early`;
  return `${formatDate(task.completedDate)} (${timing})`;
}

export function TaskDetail({
  task,
  project,
  milestone,
  predecessors,
  successors,
  block,
  overdueDays,
}: {
  task: Task;
  project: Project;
  milestone: { id: string; name: string } | null;
  predecessors: Task[];
  successors: Task[];
  block: BlockInfo;
  overdueDays: number | null;
}) {
  const archived = project.archivedAt !== null;
  const completed = completionText(task);
  const waitingNames = block.waitingOn.map((p) => `“${p.title}”`).join(", ");

  return (
    <div className="space-y-6">
      <Link href={`/tasks?project=${project.id}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft className="size-4" aria-hidden />
        {project.name} tasks
      </Link>

      {archived && (
        <p className="rounded-md border border-slate-300 bg-slate-100 px-4 py-3 text-sm text-slate-700">
          This task belongs to an archived project, so it is read-only. Restore the project to change it.
        </p>
      )}

      {block.blocked && (
        <div role="status" className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            <span className="font-semibold">Blocked.</span>{" "}
            {block.byDependencies
              ? `This task should be underway (start date ${formatDate(task.startDate)}) but is waiting on ${waitingNames}.`
              : block.waitingOn.length
                ? `Status is set to Blocked. It is also waiting on ${waitingNames}.`
                : "Status is set to Blocked."}
          </p>
        </div>
      )}
      {!block.blocked && block.waitingOn.length > 0 && (
        <p className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
          Waiting on {waitingNames}. It cannot be marked done until {block.waitingOn.length === 1 ? "that task is" : "those tasks are"} done.
        </p>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{task.title}</h1>
            <TaskStatusBadge status={task.status} />
            <PriorityBadge priority={task.priority} />
            {overdueDays !== null && <Badge tone="red">{overdueDays}d overdue</Badge>}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            <Link href={`/projects/${project.id}`} className="hover:text-slate-800">{project.name}</Link> · Owner {task.owner}
          </p>
        </div>
        {!archived && (
          <div className="flex shrink-0 items-start gap-2">
            <LinkButton href={`/tasks/${task.id}/edit`} variant="secondary">
              <Pencil className="size-4" aria-hidden />
              Edit
            </LinkButton>
            <DeleteTaskButton action={deleteTaskAction.bind(null, task.id)} successorCount={successors.length} />
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Details" />
          <div className="space-y-5 px-5 py-4">
            <dl className="grid gap-4 sm:grid-cols-2">
              <Detail label="Project">{project.name}</Detail>
              <Detail label="Milestone">
                {milestone ? (
                  <Link href={`/milestones/${milestone.id}`} className="font-medium text-indigo-700 hover:text-indigo-600">
                    {milestone.name}
                  </Link>
                ) : (
                  <span className="text-slate-400">None</span>
                )}
              </Detail>
              <Detail label="Owner">{task.owner}</Detail>
              <Detail label="Priority">{humanize(task.priority)}</Detail>
              <Detail label="Start date">{formatDate(task.startDate)}</Detail>
              <Detail label="Due date">{formatDate(task.dueDate)}</Detail>
              <Detail label="Actual completion">
                {completed ? (
                  <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="size-4 text-emerald-600" aria-hidden />{completed}</span>
                ) : (
                  <span className="text-slate-400">Not completed</span>
                )}
              </Detail>
              <Detail label="Last updated">{formatDate(task.updatedAt.slice(0, 10))}</Detail>
            </dl>
            <div>
              <p className="text-xs font-medium text-slate-500">Description</p>
              <p className="mt-0.5 whitespace-pre-line text-sm text-slate-700">
                {task.description || <span className="text-slate-400">No description.</span>}
              </p>
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Depends on"
              description={predecessors.length ? `${predecessors.filter((p) => p.status === "done").length} of ${predecessors.length} done` : undefined}
              action={<Link2 className="size-4 text-slate-400" aria-hidden />}
            />
            <TaskLinkList tasks={predecessors} empty="No predecessors." />
          </Card>
          <Card>
            <CardHeader title="Waiting on this task" />
            <TaskLinkList tasks={successors} empty="No tasks depend on this one." />
          </Card>
        </div>
      </div>
    </div>
  );
}
