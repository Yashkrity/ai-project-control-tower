import { MessageSquareDashed } from "lucide-react";
import type { UpdateRow } from "@/lib/metrics/portfolio";
import type { UpdateKind } from "@/lib/types";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { daysBetween, formatRelativeDays } from "@/lib/utils/dates";
import { humanize } from "@/lib/utils/format";

const KIND_TONE: Record<UpdateKind, "neutral" | "blue" | "amber" | "violet" | "green"> = {
  status: "blue",
  milestone: "green",
  risk: "amber",
  decision: "violet",
  general: "neutral",
  raid: "amber",
};

export function RecentUpdates({ rows, today }: { rows: UpdateRow[]; today: string }) {
  return (
    <Card>
      <CardHeader title="Recent project updates" description="Latest activity across the portfolio" />
      {rows.length === 0 ? (
        <EmptyState icon={MessageSquareDashed} title="No updates yet" description="Status changes and decisions will be logged here." />
      ) : (
        <ol className="divide-y divide-slate-100">
          {rows.map(({ update, projectName }) => (
            <li key={update.id} className="px-5 py-3">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-xs font-medium text-slate-900">{projectName}</p>
                <Badge tone={KIND_TONE[update.kind]}>{humanize(update.kind)}</Badge>
              </div>
              <p className="mt-1 text-sm text-slate-700">{update.summary}</p>
              <p className="mt-1 text-xs text-slate-500">
                {update.author} · {formatRelativeDays(daysBetween(today, update.createdAt.slice(0, 10)))}
              </p>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
