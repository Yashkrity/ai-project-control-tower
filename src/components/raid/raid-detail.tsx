import Link from "next/link";
import { AlarmClock, ArrowLeft, Flag, ListChecks, Pencil, ShieldAlert } from "lucide-react";
import type { Project, ProjectUpdate, RaidItem } from "@/lib/types";
import type { RaidRow } from "@/lib/raid/views";
import { OWNER_LABEL, PLAN_LABEL, RISK_LEVEL_THRESHOLDS, TARGET_DATE_LABEL } from "@/lib/raid/rules";
import { daysBetween, formatDate, formatRelativeDays } from "@/lib/utils/dates";
import { humanize } from "@/lib/utils/format";
import { deleteRaidAction } from "@/app/(workspace)/raid/actions";
import { Card, CardHeader } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { DeleteTaskButton } from "@/components/tasks/delete-task-button";
import { RaidStatusBadge, RaidTypeBadge, SeverityBadge } from "./raid-badges";

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-900">{children}</dd>
    </div>
  );
}

function TextBlock({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-0.5 whitespace-pre-line text-sm text-slate-700">{text || <span className="text-slate-400">Not recorded</span>}</p>
    </div>
  );
}

const date = (d: string | null) => (d ? formatDate(d) : "—");

function TypeFacts({ item }: { item: RaidItem }) {
  switch (item.type) {
    case "risk":
      return (
        <>
          <Fact label="Probability">{item.probability} / 5</Fact>
          <Fact label="Impact">{item.impact} / 5</Fact>
        </>
      );
    case "assumption":
      return <Fact label="Priority">{humanize(item.priority)}</Fact>;
    case "issue":
      return (
        <>
          <Fact label="Severity">{humanize(item.priority)}</Fact>
          <Fact label="Escalated on">{date(item.escalatedDate)}</Fact>
        </>
      );
    case "dependency":
      return (
        <>
          <Fact label="Internal or external">{humanize(item.direction)}</Fact>
          <Fact label="Required from">{item.requiredFrom}</Fact>
          <Fact label="Escalation owner">{item.escalationOwner || "—"}</Fact>
          <Fact label="Priority">{humanize(item.priority)}</Fact>
        </>
      );
  }
}

function TypeText({ item }: { item: RaidItem }) {
  switch (item.type) {
    case "risk":
      return (
        <>
          <TextBlock label={PLAN_LABEL.risk} text={item.plan} />
          <TextBlock label="Contingency plan" text={item.contingency} />
        </>
      );
    case "assumption":
      return (
        <>
          <TextBlock label={PLAN_LABEL.assumption} text={item.plan} />
          <TextBlock label="Evidence / validation notes" text={item.validationNotes} />
        </>
      );
    case "issue":
      return (
        <>
          <TextBlock label="Business / delivery impact" text={item.businessImpact} />
          <TextBlock label={PLAN_LABEL.issue} text={item.plan} />
          {item.escalationReason && <TextBlock label="Escalation reason" text={item.escalationReason} />}
        </>
      );
    case "dependency":
      return (
        <>
          <TextBlock label="Impact if not fulfilled" text={item.impactIfUnfulfilled} />
          <TextBlock label={PLAN_LABEL.dependency} text={item.plan} />
        </>
      );
  }
}

export function RaidDetail({ row, project, history, today }: { row: RaidRow; project: Project; history: ProjectUpdate[]; today: string }) {
  const { item } = row;
  const archived = project.archivedAt !== null;

  return (
    <div className="space-y-6">
      <Link href={`/raid?project=${project.id}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft className="size-4" aria-hidden />
        {project.name} RAID log
      </Link>

      {archived && (
        <p className="rounded-md border border-slate-300 bg-slate-100 px-4 py-3 text-sm text-slate-700">
          This record belongs to an archived project, so it is read-only. Restore the project to change it.
        </p>
      )}
      {row.escalation && (
        <p role="status" className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <Flag className="mt-0.5 size-4 shrink-0" aria-hidden />
          {row.escalation}
        </p>
      )}
      {row.overdue && item.targetDate && (
        <p role="status" className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlarmClock className="mt-0.5 size-4 shrink-0" aria-hidden />
          Overdue: {TARGET_DATE_LABEL[item.type].toLowerCase()} was {formatDate(item.targetDate)} ({daysBetween(item.targetDate, today)} days ago).
        </p>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm text-slate-500">{item.ref}</span>
            <RaidTypeBadge type={item.type} />
            <RaidStatusBadge type={item.type} status={item.status} />
            <SeverityBadge severity={row.severity} score={row.score} />
          </div>
          <h1 className="mt-2 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{item.title}</h1>
          <p className="mt-1 text-sm text-slate-500">
            <Link href={`/projects/${project.id}`} className="hover:text-slate-800">{project.name}</Link> · {OWNER_LABEL[item.type]}{" "}
            <span className="font-medium text-slate-700">{item.owner}</span>
          </p>
        </div>
        {!archived && (
          <div className="flex shrink-0 items-start gap-2">
            <LinkButton href={`/raid/${item.id}/edit`} variant="secondary">
              <Pencil className="size-4" aria-hidden />
              Edit
            </LinkButton>
            <DeleteTaskButton action={deleteRaidAction.bind(null, item.id)} successorCount={0} />
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Details" />
          <div className="space-y-5 px-5 py-4">
            <dl className="grid gap-4 sm:grid-cols-3">
              <Fact label={TARGET_DATE_LABEL[item.type]}>{date(item.targetDate)}</Fact>
              <Fact label="Actual resolution">{date(item.resolvedDate)}</Fact>
              <Fact label="Created">{formatDate(item.createdAt.slice(0, 10))}</Fact>
              <TypeFacts item={item} />
              {item.type === "risk" && (
                <Fact label="Risk score">
                  {row.score} ({humanize(row.severity)})
                </Fact>
              )}
            </dl>
            {item.type === "risk" && (
              <p className="text-xs text-slate-500">
                Score = probability × impact. Levels: {RISK_LEVEL_THRESHOLDS.map((t) => `${t.min}–${t.max} ${humanize(t.level)}`).join(" · ")}.
              </p>
            )}
            <TextBlock label={item.type === "assumption" ? "Assumption statement" : "Description"} text={item.description} />
            <TypeText item={item} />
            <TextBlock label="Latest update" text={item.latestUpdate} />
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Impacts" />
            <div className="space-y-3 px-5 py-4 text-sm">
              {row.milestone ? (
                <p className="flex items-center gap-2">
                  <Flag className="size-4 text-slate-400" aria-hidden />
                  <Link href={`/milestones/${row.milestone.id}`} className="font-medium text-indigo-700 hover:text-indigo-600">{row.milestone.name}</Link>
                </p>
              ) : null}
              {row.task ? (
                <p className="flex items-center gap-2">
                  <ListChecks className="size-4 text-slate-400" aria-hidden />
                  <Link href={`/tasks/${row.task.id}`} className="font-medium text-indigo-700 hover:text-indigo-600">{row.task.title}</Link>
                </p>
              ) : null}
              {!row.milestone && !row.task && <p className="text-slate-500">No milestone or task linked.</p>}
            </div>
          </Card>
          <Card>
            <CardHeader title="Activity history" action={<ShieldAlert className="size-4 text-slate-400" aria-hidden />} />
            {history.length === 0 ? (
              <p className="px-5 py-4 text-sm text-slate-500">No activity recorded.</p>
            ) : (
              <ol className="divide-y divide-slate-100">
                {history.map((u) => (
                  <li key={u.id} className="px-5 py-3">
                    <p className="text-sm text-slate-700">{u.summary.replace(/^[RAID]-\d+ \w+ “.*?”: /, "")}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {u.author} · {formatRelativeDays(daysBetween(today, u.createdAt.slice(0, 10)))}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
