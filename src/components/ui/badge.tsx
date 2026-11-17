import type { ReactNode } from "react";
import type { Health, Priority, ProjectStatus } from "@/lib/types";
import { cn, humanize } from "@/lib/utils/format";

type Tone = "neutral" | "green" | "amber" | "red" | "blue" | "violet";

const TONES: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate-700 ring-slate-200",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  blue: "bg-sky-50 text-sky-700 ring-sky-200",
  violet: "bg-violet-50 text-violet-700 ring-violet-200",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        TONES[tone],
      )}
    >
      {children}
    </span>
  );
}

const HEALTH_DOT: Record<Health, string> = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
};

export function HealthBadge({ health }: { health: Health }) {
  return (
    <Badge tone={health}>
      <span className={cn("size-1.5 rounded-full", HEALTH_DOT[health])} aria-hidden />
      {humanize(health)}
    </Badge>
  );
}

const STATUS_TONE: Record<ProjectStatus, Tone> = {
  planning: "violet",
  active: "blue",
  on_hold: "amber",
  completed: "green",
};

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{humanize(status)}</Badge>;
}

export function ArchivedBadge() {
  return <Badge tone="neutral">Archived</Badge>;
}

const PRIORITY_TONE: Record<Priority, Tone> = {
  critical: "red",
  high: "amber",
  medium: "blue",
  low: "neutral",
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <Badge tone={PRIORITY_TONE[priority]}>{humanize(priority)}</Badge>;
}
