import { AlarmClock, CalendarClock, CheckCircle2, FolderKanban, Wallet, type LucideIcon } from "lucide-react";
import type { PortfolioSummary } from "@/lib/metrics/portfolio";
import { cn, formatCurrency, formatPercent } from "@/lib/utils/format";

function Kpi({
  label,
  value,
  detail,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  tone?: "default" | "alert";
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <Icon className={cn("size-4", tone === "alert" ? "text-red-500" : "text-slate-400")} aria-hidden />
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

export function KpiCards({ summary }: { summary: PortfolioSummary }) {
  const { activeByStatus, taskCompletion } = summary;
  const burn = summary.totalBudget > 0 ? (summary.totalSpend / summary.totalBudget) * 100 : 0;
  const nextMilestone = summary.upcomingMilestones[0];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      <Kpi
        label="Active projects"
        value={String(summary.activeProjects)}
        detail={`${activeByStatus.active} in delivery · ${activeByStatus.planning} planning · ${activeByStatus.on_hold} on hold`}
        icon={FolderKanban}
      />
      <Kpi
        label="Task completion"
        value={formatPercent(taskCompletion.percent)}
        detail={`${taskCompletion.completed} of ${taskCompletion.total} tasks done`}
        icon={CheckCircle2}
      />
      <Kpi
        label="Overdue tasks"
        value={String(summary.overdueTaskCount)}
        detail={summary.overdueTaskCount === 0 ? "Nothing past due" : "Open and past due date"}
        icon={AlarmClock}
        tone={summary.overdueTaskCount > 0 ? "alert" : "default"}
      />
      <Kpi
        label="Milestones (next 30 days)"
        value={String(summary.upcomingMilestones.length)}
        detail={
          nextMilestone
            ? `${summary.pastDueMilestoneCount} past due · next in ${nextMilestone.daysUntil}d`
            : `${summary.pastDueMilestoneCount} past due`
        }
        icon={CalendarClock}
        tone={summary.pastDueMilestoneCount > 0 ? "alert" : "default"}
      />
      <Kpi
        label="Budget spent (active)"
        value={formatPercent(burn)}
        detail={`${formatCurrency(summary.totalSpend, true)} of ${formatCurrency(summary.totalBudget, true)}`}
        icon={Wallet}
      />
    </div>
  );
}
