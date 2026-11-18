import Link from "next/link";
import { ArrowLeft, CheckCircle2, ListChecks, Pencil, Unlink } from "lucide-react";
import type { Milestone, Project } from "@/lib/types";
import type { MilestoneState } from "@/lib/milestones/rules";
import type { TaskRow } from "@/lib/tasks/views";
import { formatDate } from "@/lib/utils/dates";
import { cn, humanize } from "@/lib/utils/format";
import { deleteMilestoneAction, linkTasksAction, unlinkTaskAction } from "@/app/(workspace)/milestones/actions";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/button";
import { MilestoneStatusBadge, PriorityBadge, TaskStatusBadge } from "@/components/ui/badge";
import { BlockReason, DueCell } from "@/components/tasks/task-table";
import { MilestoneProgress } from "./milestone-progress";
import { DeleteMilestoneButton } from "./delete-milestone-button";
import { LinkTasksForm, type LinkCandidate } from "./link-tasks-form";

const STATUS_PANEL: Record<MilestoneState["status"], string> = {
  completed: "border-emerald-200 bg-emerald-50 text-emerald-900",
  delayed: "border-red-200 bg-red-50 text-red-900",
  at_risk: "border-amber-200 bg-amber-50 text-amber-900",
  in_progress: "border-sky-200 bg-sky-50 text-sky-900",
  not_started: "border-slate-200 bg-white text-slate-700",
};

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-900">{children}</dd>
    </div>
  );
}

function Stat({ label, value, detail, alert }: { label: string; value: string; detail: string; alert?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={cn("mt-2 text-2xl font-semibold tabular-nums", alert ? "text-red-600" : "text-slate-900")}>{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

export function MilestoneDetail({
  milestone,
  project,
  state,
  taskRows,
  candidates,
  otherMilestones,
}: {
  milestone: Milestone;
  project: Project;
  state: MilestoneState;
  taskRows: TaskRow[];
  candidates: LinkCandidate[];
  otherMilestones: { id: string; name: string; completed: boolean }[];
}) {
  const archived = project.archivedAt !== null;
  const { progress } = state;

  return (
    <div className="space-y-6">
      <Link href={`/milestones?project=${project.id}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft className="size-4" aria-hidden />
        {project.name} milestones
      </Link>

      {archived && (
        <p className="rounded-md border border-slate-300 bg-slate-100 px-4 py-3 text-sm text-slate-700">
          This milestone belongs to an archived project, so it is read-only. Restore the project to change it.
        </p>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{milestone.name}</h1>
            <MilestoneStatusBadge status={state.status} />
            <PriorityBadge priority={milestone.priority} />
          </div>
          <p className="mt-1 text-sm text-slate-500">
            <Link href={`/projects/${project.id}`} className="hover:text-slate-800">{project.name}</Link> · Owner {milestone.owner}
          </p>
        </div>
        {!archived && (
          <div className="flex shrink-0 flex-wrap items-start justify-end gap-2">
            <LinkButton href={`/milestones/${milestone.id}/edit`} variant="secondary">
              <Pencil className="size-4" aria-hidden />
              Edit
            </LinkButton>
            <DeleteMilestoneButton
              action={deleteMilestoneAction.bind(null, milestone.id)}
              linkedTasks={state.tasks.length}
              otherMilestones={otherMilestones}
            />
          </div>
        )}
      </div>

      <div role="status" className={cn("rounded-md border px-4 py-3 text-sm", STATUS_PANEL[state.status])}>
        <p>
          <span className="font-semibold">{humanize(state.status)}.</span> {state.explanation}
        </p>
        <p className="mt-1 text-xs opacity-80">
          Calculated from linked tasks and dates. This is separate from the project&apos;s manual RAG health.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Progress</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">{progress.percent === null ? "—" : `${progress.percent}%`}</p>
          <div className="mt-2"><MilestoneProgress progress={progress} label="Milestone progress" /></div>
        </div>
        <Stat label="Open tasks" value={String(state.openTasks.length)} detail={`of ${state.tasks.length} linked`} />
        <Stat label="Blocked tasks" value={String(state.blockedTasks.length)} detail="Marked blocked or waiting on predecessors" alert={state.blockedTasks.length > 0} />
        <Stat
          label={state.status === "completed" ? "Completed" : "Planned completion"}
          value={state.status === "completed" && milestone.actualDate ? formatDate(milestone.actualDate) : formatDate(milestone.plannedDate)}
          detail={
            state.status === "completed"
              ? `Planned ${formatDate(milestone.plannedDate)}`
              : state.daysToPlanned < 0
                ? `${-state.daysToPlanned} days overdue`
                : `In ${state.daysToPlanned} days`
          }
          alert={state.status === "delayed"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Linked tasks"
            description={state.tasks.length ? "Progress = completed ÷ total linked tasks" : undefined}
            action={!archived ? (
              <LinkButton href={`/tasks/new?project=${project.id}`} variant="secondary" className="py-1.5">
                <ListChecks className="size-4" aria-hidden />
                New task
              </LinkButton>
            ) : undefined}
          />
          {taskRows.length === 0 ? (
            <EmptyState icon={ListChecks} title="No tasks linked" description="Link existing tasks below, or set this milestone on a task's edit page." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {taskRows.map((row) => (
                <li key={row.task.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <Link href={`/tasks/${row.task.id}`} className="font-medium text-slate-900 hover:text-indigo-700">
                      {row.task.title}
                    </Link>
                    <p className="text-xs text-slate-500">{row.task.owner}</p>
                    <BlockReason row={row} />
                  </div>
                  <div className="flex shrink-0 items-start gap-3">
                    <TaskStatusBadge status={row.task.status} />
                    <div className="text-xs"><DueCell row={row} /></div>
                    {!archived && (
                      <form action={unlinkTaskAction.bind(null, row.task.id)}>
                        <button type="submit" className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800" title="Unlink from this milestone">
                          <Unlink className="size-3.5" aria-hidden />
                          Unlink
                        </button>
                      </form>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Details" />
            <dl className="grid gap-4 px-5 py-4">
              <Detail label="Planned start">{formatDate(milestone.plannedStartDate)}</Detail>
              <Detail label="Planned completion">{formatDate(milestone.plannedDate)}</Detail>
              <Detail label="Actual completion">
                {milestone.actualDate ? (
                  <span className="inline-flex items-center gap-1.5">
                    <CheckCircle2 className="size-4 text-emerald-600" aria-hidden />
                    {formatDate(milestone.actualDate)}
                  </span>
                ) : (
                  <span className="text-slate-400">Not recorded</span>
                )}
              </Detail>
              <Detail label="Description">
                {milestone.description ? <span className="whitespace-pre-line">{milestone.description}</span> : <span className="text-slate-400">None</span>}
              </Detail>
              <Detail label="Notes">
                {milestone.notes ? <span className="whitespace-pre-line">{milestone.notes}</span> : <span className="text-slate-400">None</span>}
              </Detail>
            </dl>
          </Card>
          {!archived && (
            <Card>
              <CardHeader title="Link tasks" description="Tasks in this project" />
              <LinkTasksForm
                action={linkTasksAction.bind(null, milestone.id)}
                candidates={candidates}
                milestoneCompleted={state.status === "completed"}
              />
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
