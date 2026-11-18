import Link from "next/link";
import { FolderKanban } from "lucide-react";
import type { ProjectSummary } from "@/lib/metrics/portfolio";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { HealthBadge, ProjectStatusBadge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { cn, formatCurrency } from "@/lib/utils/format";
import { formatDate } from "@/lib/utils/dates";

export function ProjectTable({ projects }: { projects: ProjectSummary[] }) {
  return (
    <Card>
      <CardHeader
        title="Project-wise progress"
        description="Progress = tasks done ÷ total tasks. The marker shows how much of the schedule has elapsed. Blocked = marked blocked, or underway but waiting on predecessors."
      />
      {projects.length === 0 ? (
        <EmptyState icon={FolderKanban} title="No projects yet" description="Projects you create will appear here." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead className="border-b border-slate-100 text-xs text-slate-500">
              <tr>
                <th scope="col" className="px-5 py-2.5 font-medium">Project</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Status</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Health</th>
                <th scope="col" className="w-56 px-3 py-2.5 font-medium">Progress</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Overdue</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Blocked</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Milestones done</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Open risks / issues</th>
                <th scope="col" className="px-5 py-2.5 text-right font-medium">Budget used</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {projects.map(({ project, progress, overdueTasks, blockedTasks, milestones, openRisks, openIssues, scheduleElapsed, budgetBurn }) => (
                <tr key={project.id} className="relative align-middle hover:bg-slate-50/60">
                  <td className="px-5 py-3">
                    <Link
                      href={`/projects/${project.id}`}
                      className="font-medium text-slate-900 after:absolute after:inset-0 hover:text-indigo-700"
                    >
                      {project.name}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {project.client} · {project.projectManager} · due {formatDate(project.targetEndDate)}
                    </p>
                  </td>
                  <td className="px-3 py-3"><ProjectStatusBadge status={project.status} /></td>
                  <td className="px-3 py-3"><HealthBadge health={project.health} /></td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-3">
                      <ProgressBar value={progress.percent} marker={scheduleElapsed} label={`${project.name} progress`} />
                      <span className="w-10 shrink-0 text-right text-xs font-medium tabular-nums text-slate-700">
                        {Math.round(progress.percent)}%
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {progress.completed}/{progress.total} tasks · {scheduleElapsed}% of schedule elapsed
                    </p>
                  </td>
                  <td className={cn("px-3 py-3 text-right tabular-nums", overdueTasks > 0 ? "font-semibold text-red-600" : "text-slate-500")}>
                    {overdueTasks}
                  </td>
                  <td className={cn("px-3 py-3 text-right tabular-nums", blockedTasks > 0 ? "font-semibold text-red-600" : "text-slate-500")}>
                    {blockedTasks}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <p className="tabular-nums text-slate-900">
                      {milestones.total === 0 ? <span className="text-slate-400">—</span> : `${milestones.completed}/${milestones.total}`}
                    </p>
                    {(milestones.delayed > 0 || milestones.atRisk > 0) && (
                      <p className="text-[11px] font-medium text-red-600">
                        {[milestones.delayed && `${milestones.delayed} delayed`, milestones.atRisk && `${milestones.atRisk} at risk`].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-700">
                    {openRisks} / {openIssues}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <p className={cn("tabular-nums", budgetBurn > 90 ? "font-semibold text-red-600" : "text-slate-900")}>
                      {budgetBurn}%
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {formatCurrency(project.actualSpend, true)} / {formatCurrency(project.budget, true)}
                    </p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
