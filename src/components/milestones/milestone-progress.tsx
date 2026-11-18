import type { MilestoneProgress as Progress } from "@/lib/milestones/rules";
import { ProgressBar } from "@/components/ui/progress-bar";

/** Task-derived progress. Never shows 0% for a milestone with no tasks. */
export function MilestoneProgress({ progress, label }: { progress: Progress; label: string }) {
  if (progress.percent === null) {
    return <p className="text-xs italic text-slate-500">No tasks linked</p>;
  }
  return (
    <div>
      <div className="flex items-center gap-3">
        <ProgressBar value={progress.percent} label={label} />
        <span className="w-10 shrink-0 text-right text-xs font-medium tabular-nums text-slate-700">{progress.percent}%</span>
      </div>
      <p className="mt-1 text-[11px] text-slate-500">
        {progress.completed}/{progress.total} tasks done
      </p>
    </div>
  );
}
