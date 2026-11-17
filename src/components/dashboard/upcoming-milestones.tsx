import { CalendarX2 } from "lucide-react";
import type { MilestoneRow } from "@/lib/metrics/portfolio";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatRelativeDays } from "@/lib/utils/dates";
import { humanize } from "@/lib/utils/format";

export function UpcomingMilestones({ rows, horizonDays = 30 }: { rows: MilestoneRow[]; horizonDays?: number }) {
  return (
    <Card>
      <CardHeader title="Upcoming milestones" description={`Open milestones due in the next ${horizonDays} days`} />
      {rows.length === 0 ? (
        <EmptyState icon={CalendarX2} title="Nothing due soon" description={`No open milestones in the next ${horizonDays} days.`} />
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map(({ milestone, projectName, daysUntil }) => (
            <li key={milestone.id} className="flex items-start justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="line-clamp-2 text-sm font-medium text-slate-900">{milestone.name}</p>
                <p className="truncate text-xs text-slate-500">
                  {projectName} · {humanize(milestone.status)}
                </p>
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
