import Link from "next/link";
import { Info, Plus } from "lucide-react";
import type { RaidSummary } from "@/lib/raid/summary";
import { raidSignals } from "@/lib/raid/summary";
import { Card, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils/format";

/**
 * Project RAID counts, each linking to the matching filtered register view,
 * plus calculated signals shown beside (never replacing) the manual RAG health.
 */
export function ProjectRaidPanel({ projectId, summary, archived }: { projectId: string; summary: RaidSummary; archived: boolean }) {
  const p = `project=${encodeURIComponent(projectId)}`;
  const counts: { label: string; value: number; href: string; alert: boolean }[] = [
    { label: "Open risks", value: summary.openRisks, href: `/raid?tab=risk&state=open&${p}`, alert: false },
    { label: "High/critical risks", value: summary.highCriticalRisks, href: `/raid?focus=high-risks&${p}`, alert: true },
    { label: "Open issues", value: summary.openIssues, href: `/raid?tab=issue&state=open&${p}`, alert: false },
    { label: "Escalated issues", value: summary.escalatedIssues, href: `/raid?focus=escalated&${p}`, alert: true },
    { label: "Blocked dependencies", value: summary.blockedDependencies, href: `/raid?focus=blocked&${p}`, alert: true },
    { label: "Overdue assumptions", value: summary.overdueAssumptions, href: `/raid?tab=assumption&focus=overdue&${p}`, alert: true },
    { label: "Upcoming reviews (14 days)", value: summary.upcomingReviews, href: `/raid?focus=upcoming&${p}`, alert: false },
  ];
  const signals = raidSignals(summary);

  return (
    <Card>
      <CardHeader
        title="RAID"
        description={`${summary.openTotal} open record${summary.openTotal === 1 ? "" : "s"}`}
        action={
          <div className="flex items-center gap-3">
            <Link href={`/raid?${p}`} className="text-xs font-medium text-slate-500 hover:text-slate-800">
              View log
            </Link>
            {!archived && (
              <Link href={`/raid/new?${p}`} className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-500">
                <Plus className="size-3.5" aria-hidden />
                New
              </Link>
            )}
          </div>
        }
      />
      <ul className="grid grid-cols-2 gap-px bg-slate-100 sm:grid-cols-4 lg:grid-cols-7">
        {counts.map((c) => (
          <li key={c.label} className="bg-white">
            <Link href={c.href} className="block h-full px-4 py-3 hover:bg-slate-50">
              <span className={cn("block text-xl font-semibold tabular-nums", c.alert && c.value > 0 ? "text-red-600" : "text-slate-900")}>{c.value}</span>
              <span className="mt-0.5 block text-xs text-slate-500">{c.label}</span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="flex items-start gap-2 border-t border-slate-100 px-5 py-3 text-xs text-slate-600">
        <Info className="mt-0.5 size-3.5 shrink-0 text-slate-400" aria-hidden />
        <p>
          {signals.length ? (
            <>
              <span className="font-medium text-slate-800">Calculated signals:</span> {signals.join(" · ")}.{" "}
            </>
          ) : (
            "No calculated RAID warnings. "
          )}
          These do not change the project&apos;s RAG health, which is set manually.
        </p>
      </div>
    </Card>
  );
}
