import Link from "next/link";
import type { ProjectSummary } from "@/lib/metrics/portfolio";
import { ArchivedBadge, HealthBadge, ProjectStatusBadge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { formatDate } from "@/lib/utils/dates";
import { cn, formatCurrency } from "@/lib/utils/format";

export function ProjectsTable({ rows }: { rows: ProjectSummary[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] text-left text-sm">
        <thead className="border-b border-slate-100 text-xs text-slate-500">
          <tr>
            <th scope="col" className="px-5 py-2.5 font-medium">Project</th>
            <th scope="col" className="px-3 py-2.5 font-medium">Status</th>
            <th scope="col" className="px-3 py-2.5 font-medium">Health</th>
            <th scope="col" className="w-48 px-3 py-2.5 font-medium">Progress</th>
            <th scope="col" className="px-3 py-2.5 font-medium">Target end</th>
            <th scope="col" className="px-5 py-2.5 text-right font-medium">Budget used</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map(({ project, progress, budgetBurn, overdueTasks }) => (
            <tr key={project.id} className="relative hover:bg-slate-50/70">
              <td className="px-5 py-3">
                <Link
                  href={`/projects/${project.id}`}
                  className="font-medium text-slate-900 after:absolute after:inset-0 hover:text-indigo-700"
                >
                  {project.name}
                </Link>
                <p className="text-xs text-slate-500">
                  {project.client} · {project.projectManager}
                </p>
              </td>
              <td className="px-3 py-3">
                <div className="flex flex-wrap gap-1.5">
                  <ProjectStatusBadge status={project.status} />
                  {project.archivedAt && <ArchivedBadge />}
                </div>
              </td>
              <td className="px-3 py-3"><HealthBadge health={project.health} /></td>
              <td className="px-3 py-3">
                <div className="flex items-center gap-3">
                  <ProgressBar value={progress.percent} label={`${project.name} progress`} />
                  <span className="w-10 shrink-0 text-right text-xs font-medium tabular-nums text-slate-700">
                    {Math.round(progress.percent)}%
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  {progress.total === 0 ? "No tasks yet" : `${progress.completed}/${progress.total} tasks`}
                  {overdueTasks > 0 && <span className="font-medium text-red-600"> · {overdueTasks} overdue</span>}
                </p>
              </td>
              <td className="px-3 py-3 text-slate-700">{formatDate(project.targetEndDate)}</td>
              <td className="px-5 py-3 text-right">
                <p className={cn("tabular-nums", budgetBurn > 100 ? "font-semibold text-red-600" : "text-slate-900")}>
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
  );
}
