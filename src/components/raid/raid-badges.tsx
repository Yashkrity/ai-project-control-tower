import { AlertTriangle, CircleHelp, Flame, Link2 } from "lucide-react";
import type { Priority, RaidStatus, RaidType } from "@/lib/types";
import { isClosedStatus, RAID_TYPE_LABEL } from "@/lib/raid/rules";
import { cn, humanize } from "@/lib/utils/format";

const TYPE_STYLE: Record<RaidType, { icon: typeof Flame; cls: string }> = {
  risk: { icon: AlertTriangle, cls: "bg-amber-50 text-amber-800 ring-amber-200" },
  assumption: { icon: CircleHelp, cls: "bg-violet-50 text-violet-700 ring-violet-200" },
  issue: { icon: Flame, cls: "bg-red-50 text-red-700 ring-red-200" },
  dependency: { icon: Link2, cls: "bg-sky-50 text-sky-700 ring-sky-200" },
};

export function RaidTypeBadge({ type }: { type: RaidType }) {
  const { icon: Icon, cls } = TYPE_STYLE[type];
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset", cls)}>
      <Icon className="size-3" aria-hidden />
      {RAID_TYPE_LABEL[type]}
    </span>
  );
}

const ATTENTION: RaidStatus[] = ["escalated", "blocked", "materialized", "invalidated"];
const PROGRESS: RaidStatus[] = ["mitigating", "investigating", "in_progress"];

/** Status: red for statuses needing attention, blue for work underway, green when closed, grey otherwise. */
export function RaidStatusBadge({ type, status }: { type: RaidType; status: RaidStatus }) {
  const tone = ATTENTION.includes(status)
    ? "bg-red-50 text-red-700 ring-red-200"
    : isClosedStatus(type, status)
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : PROGRESS.includes(status)
        ? "bg-sky-50 text-sky-700 ring-sky-200"
        : "bg-slate-100 text-slate-700 ring-slate-200";
  return <span className={cn("inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", tone)}>{humanize(status)}</span>;
}

const SEVERITY_STYLE: Record<Priority, string> = {
  critical: "bg-red-600 text-white",
  high: "bg-orange-100 text-orange-800",
  medium: "bg-yellow-100 text-yellow-800",
  low: "bg-slate-100 text-slate-700",
};

/** Severity / risk level, with the score for risks (e.g. "20 · Critical"). */
export function SeverityBadge({ severity, score }: { severity: Priority; score?: number | null }) {
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-semibold tabular-nums", SEVERITY_STYLE[severity])}>
      {score != null && <span>{score} ·</span>}
      {humanize(severity)}
    </span>
  );
}
