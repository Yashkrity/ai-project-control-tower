import Link from "next/link";
import { Archive, ArrowLeft, CalendarX2, MessageSquareDashed, Pencil } from "lucide-react";
import type { Milestone, ProjectUpdate } from "@/lib/types";
import { isMilestoneDelayed, type ProjectSummary } from "@/lib/metrics/portfolio";
import { daysBetween, formatDate, formatRelativeDays } from "@/lib/utils/dates";
import { cn, formatCurrency, humanize } from "@/lib/utils/format";
import { archiveProjectAction, restoreProjectAction } from "@/app/(workspace)/projects/actions";
import { ArchivedBadge, Badge, HealthBadge, ProjectStatusBadge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress-bar";
import { ArchiveSubmitButton } from "./archive-button";

function Stat({ label, value, detail, alert }: { label: string; value: string; detail: string; alert?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={cn("mt-2 text-2xl font-semibold tabular-nums", alert ? "text-red-600" : "text-slate-900")}>{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-900">{children}</dd>
    </div>
  );
}

export function ProjectDetail({
  summary,
  milestones,
  updates,
  today,
}: {
  summary: ProjectSummary;
  milestones: Milestone[];
  updates: ProjectUpdate[];
  today: string;
}) {
  const { project, progress, overdueTasks, scheduleElapsed, budgetBurn } = summary;
  const archived = project.archivedAt !== null;
  const archiveAction = (archived ? restoreProjectAction : archiveProjectAction).bind(null, project.id);

  return (
    <div className="space-y-6">
      <Link href="/projects" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft className="size-4" aria-hidden />
        Projects
      </Link>

      {archived && (
        <div className="flex items-start gap-2 rounded-md border border-slate-300 bg-slate-100 px-4 py-3 text-sm text-slate-700">
          <Archive className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            Archived on {formatDate(project.archivedAt!.slice(0, 10))}. Archived projects are excluded from the
            dashboard and portfolio totals. Restore it to include it again.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{project.name}</h1>
            <ProjectStatusBadge status={project.status} />
            <HealthBadge health={project.health} />
            {archived && <ArchivedBadge />}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {project.client} · Managed by {project.projectManager}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <LinkButton href={`/projects/${project.id}/edit`} variant="secondary">
            <Pencil className="size-4" aria-hidden />
            Edit
          </LinkButton>
          <form action={archiveAction}>
            <ArchiveSubmitButton archived={archived} />
          </form>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Progress"
          value={`${Math.round(progress.percent)}%`}
          detail={progress.total === 0 ? "No tasks yet" : `${progress.completed} of ${progress.total} tasks done`}
        />
        <Stat label="Overdue tasks" value={String(overdueTasks)} detail="Open and past due date" alert={overdueTasks > 0} />
        <Stat label="Schedule elapsed" value={`${scheduleElapsed}%`} detail={`Target end ${formatDate(project.targetEndDate)}`} />
        <Stat
          label="Budget used"
          value={`${budgetBurn}%`}
          detail={`${formatCurrency(project.actualSpend)} of ${formatCurrency(project.budget)}`}
          alert={budgetBurn > 100}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Project details" />
          <CardBody className="space-y-5">
            <div>
              <ProgressBar value={progress.percent} marker={scheduleElapsed} label="Progress against schedule" />
              <p className="mt-1.5 text-xs text-slate-500">
                {Math.round(progress.percent)}% of tasks done · {scheduleElapsed}% of schedule elapsed (marker)
              </p>
            </div>
            <dl className="grid gap-4 sm:grid-cols-2">
              <Detail label="Client">{project.client}</Detail>
              <Detail label="Project manager">{project.projectManager}</Detail>
              <Detail label="Start date">{formatDate(project.startDate)}</Detail>
              <Detail label="Target end date">{formatDate(project.targetEndDate)}</Detail>
              <Detail label="Budget">{formatCurrency(project.budget)}</Detail>
              <Detail label="Actual expenditure">{formatCurrency(project.actualSpend)}</Detail>
              <Detail label="Created">{formatDate(project.createdAt.slice(0, 10))}</Detail>
              <Detail label="Last updated">{formatDate(project.updatedAt.slice(0, 10))}</Detail>
            </dl>
            <div>
              <p className="text-xs font-medium text-slate-500">Description</p>
              <p className="mt-0.5 whitespace-pre-line text-sm text-slate-700">
                {project.description || <span className="text-slate-400">No description.</span>}
              </p>
            </div>
          </CardBody>
        </Card>

        <div className="space-y-6">
          <MilestoneList milestones={milestones} today={today} />
          <ActivityList updates={updates} today={today} />
        </div>
      </div>
    </div>
  );
}

function MilestoneList({ milestones, today }: { milestones: Milestone[]; today: string }) {
  return (
    <Card>
      <CardHeader title="Milestones" description="Editing arrives with the Milestones module" />
      {milestones.length === 0 ? (
        <EmptyState icon={CalendarX2} title="No milestones" />
      ) : (
        <ul className="divide-y divide-slate-100">
          {milestones.map((m) => (
            <li key={m.id} className="flex items-start justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900">{m.name}</p>
                <p className="text-xs text-slate-500">
                  {humanize(m.status)} · planned {formatDate(m.plannedDate)}
                  {m.actualDate && ` · done ${formatDate(m.actualDate)}`}
                </p>
              </div>
              {isMilestoneDelayed(m, today) && <Badge tone="red">Delayed</Badge>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function ActivityList({ updates, today }: { updates: ProjectUpdate[]; today: string }) {
  return (
    <Card>
      <CardHeader title="Activity" />
      {updates.length === 0 ? (
        <EmptyState icon={MessageSquareDashed} title="No activity yet" />
      ) : (
        <ol className="divide-y divide-slate-100">
          {updates.map((u) => (
            <li key={u.id} className="px-5 py-3">
              <p className="text-sm text-slate-700">{u.summary}</p>
              <p className="mt-1 text-xs text-slate-500">
                {u.author} · {formatRelativeDays(daysBetween(today, u.createdAt.slice(0, 10)))}
              </p>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
