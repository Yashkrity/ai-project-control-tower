import { PartyPopper } from "lucide-react";
import type { OverdueTaskRow } from "@/lib/metrics/portfolio";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge, PriorityBadge } from "@/components/ui/badge";

export function OverdueTasks({ rows, limit = 6 }: { rows: OverdueTaskRow[]; limit?: number }) {
  const shown = rows.slice(0, limit);
  return (
    <Card>
      <CardHeader
        title="Overdue tasks"
        description={rows.length > limit ? `Showing ${limit} of ${rows.length}, most overdue first` : "Most overdue first"}
      />
      {rows.length === 0 ? (
        <EmptyState icon={PartyPopper} title="No overdue tasks" description="Every open task is within its due date." />
      ) : (
        <ul className="divide-y divide-slate-100">
          {shown.map(({ task, projectName, daysOverdue }) => (
            <li key={task.id} className="flex items-start justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="line-clamp-2 text-sm font-medium text-slate-900">{task.title}</p>
                <p className="truncate text-xs text-slate-500">
                  {projectName} · {task.owner}
                  {task.status === "blocked" && <span className="font-medium text-red-600"> · Blocked</span>}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <Badge tone="red">{daysOverdue}d late</Badge>
                <PriorityBadge priority={task.priority} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
