import Link from "next/link";
import { CalendarX2 } from "lucide-react";
import type { MilestoneRow } from "@/lib/metrics/portfolio";
import { formatProgress } from "@/lib/milestones/rules";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge, MilestoneStatusBadge } from "@/components/ui/badge";
import { formatDate, formatRelativeDays } from "@/lib/utils/dates";

export function UpcomingMilestones({ rows, horizonDays = 30 }: { rows: MilestoneRow[]; horizonDays?: number }) {
  return (
    <Card>
      <CardHeader
        title="Upcoming milestones"
        description={`Open milestones due in the next ${horizonDays} days`}
        action={
          <Link href="/milestones?view=upcoming" className="text-xs font-medium text-slate-500 hover:text-slate-800">
            View all
          </Link>
        }
      />
      {rows.length === 0 ? (
        <EmptyState icon={CalendarX2} title="Nothing due soon" description={`No open milestones in the next ${horizonDays} days.`} />
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map(({ milestone, state, projectName, daysUntil }) => (
            <li key={milestone.id} className="relative flex items-start justify-between gap-3 px-5 py-3 hover:bg-slate-50/70">
              <div className="min-w-0 space-y-1">
                <Link
                  href={`/milestones/${milestone.id}`}
                  className="line-clamp-2 text-sm font-medium text-slate-900 after:absolute after:inset-0 hover:text-indigo-700"
                >
                  {milestone.name}
                </Link>
                <p className="truncate text-xs text-slate-500">
                  {projectName} · {formatProgress(state.progress)}
                </p>
                <MilestoneStatusBadge status={state.status} />
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs font-medium text-slate-900">{formatDate(milestone.plannedDate)}</p>
                <Badge tone={daysUntil <= 7 ? "amber" : "neutral"}>{formatRelativeDays(daysUntil)}</Badge>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
