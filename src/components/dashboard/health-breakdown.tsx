import { CircleCheck, CircleAlert, OctagonAlert, Activity, type LucideIcon } from "lucide-react";
import type { Health } from "@/lib/types";
import type { PortfolioSummary } from "@/lib/metrics/portfolio";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

const ROWS: { key: Health; label: string; meaning: string; bar: string; icon: LucideIcon; ink: string }[] = [
  { key: "green", label: "Green", meaning: "On track", bar: "bg-emerald-500", icon: CircleCheck, ink: "text-emerald-600" },
  { key: "amber", label: "Amber", meaning: "At risk", bar: "bg-amber-500", icon: CircleAlert, ink: "text-amber-600" },
  { key: "red", label: "Red", meaning: "Off track", bar: "bg-red-500", icon: OctagonAlert, ink: "text-red-600" },
];

/** Health of active projects as a labelled segmented bar + count list. */
export function HealthBreakdown({ summary }: { summary: PortfolioSummary }) {
  const total = summary.activeProjects;

  return (
    <Card>
      <CardHeader title="Projects by health" description="Active projects, as reported by project managers" />
      <CardBody>
        {total === 0 ? (
          <EmptyState icon={Activity} title="No active projects" description="Health appears once a project is in planning or delivery." />
        ) : (
          <>
            <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full" role="img"
              aria-label={ROWS.map((r) => `${summary.healthCounts[r.key]} ${r.label}`).join(", ")}>
              {ROWS.filter((r) => summary.healthCounts[r.key] > 0).map((r) => (
                <div
                  key={r.key}
                  className={r.bar}
                  style={{ width: `${(summary.healthCounts[r.key] / total) * 100}%` }}
                  title={`${r.label}: ${summary.healthCounts[r.key]}`}
                />
              ))}
            </div>
            <ul className="mt-5 space-y-3">
              {ROWS.map((r) => {
                const count = summary.healthCounts[r.key];
                const Icon = r.icon;
                return (
                  <li key={r.key} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <Icon className={`size-4 ${r.ink}`} aria-hidden />
                      <span className="font-medium text-slate-900">{r.label}</span>
                      <span className="text-slate-500">{r.meaning}</span>
                    </span>
                    <span className="tabular-nums text-slate-700">
                      <span className="font-semibold text-slate-900">{count}</span>
                      <span className="ml-2 text-xs text-slate-500">{Math.round((count / total) * 100)}%</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </CardBody>
    </Card>
  );
}
