import { cn } from "@/lib/utils/format";

/**
 * Horizontal progress bar. `marker` optionally draws a thin line (e.g. time
 * elapsed) so progress can be compared against the schedule.
 */
export function ProgressBar({
  value,
  marker,
  label,
  className,
}: {
  value: number;
  marker?: number;
  label: string;
  className?: string;
}) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      className={cn("relative h-2 w-full rounded-full bg-slate-100", className)}
    >
      <div className="h-full rounded-full bg-indigo-500" style={{ width: `${clamped}%` }} />
      {marker !== undefined && (
        <div
          className="absolute -top-1 h-4 w-0.5 rounded bg-slate-500"
          style={{ left: `calc(${Math.min(100, Math.max(0, marker))}% - 1px)` }}
          title={`Schedule elapsed: ${marker}%`}
          aria-hidden
        />
      )}
    </div>
  );
}
