import Link from "next/link";
import type { MilestoneListRow } from "@/lib/milestones/views";
import { Badge, MilestoneStatusBadge, PriorityBadge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils/dates";
import { MilestoneProgress } from "./milestone-progress";

function DateCell({ row }: { row: MilestoneListRow }) {
  const { milestone, state } = row;
  return (
    <div className="flex flex-col items-start gap-1">
      <span className="text-slate-700">{formatDate(milestone.plannedDate)}</span>
      {state.status === "completed" && milestone.actualDate ? (
        <span className="text-[11px] text-slate-500">
          Done {formatDate(milestone.actualDate)}
          {state.slipDays ? ` (${state.slipDays > 0 ? `${state.slipDays}d late` : `${-state.slipDays}d early`})` : ""}
        </span>
      ) : state.daysToPlanned < 0 ? (
        <Badge tone="red">{-state.daysToPlanned}d overdue</Badge>
      ) : (
        <span className="text-[11px] text-slate-500">{state.daysToPlanned === 0 ? "Due today" : `In ${state.daysToPlanned}d`}</span>
      )}
    </div>
  );
}

export function MilestoneTable({ rows, showProject = true }: { rows: MilestoneListRow[]; showProject?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead className="border-b border-slate-100 text-xs text-slate-500">
          <tr>
            <th scope="col" className="px-5 py-2.5 font-medium">Milestone</th>
            {showProject && <th scope="col" className="px-3 py-2.5 font-medium">Project</th>}
            <th scope="col" className="px-3 py-2.5 font-medium">Owner</th>
            <th scope="col" className="px-3 py-2.5 font-medium">Status</th>
            <th scope="col" className="w-44 px-3 py-2.5 font-medium">Progress</th>
            <th scope="col" className="px-5 py-2.5 font-medium">Planned completion</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={row.milestone.id} className="relative align-top hover:bg-slate-50/70">
              <td className="px-5 py-3">
                <Link
                  href={`/milestones/${row.milestone.id}`}
                  className="font-medium text-slate-900 after:absolute after:inset-0 hover:text-indigo-700"
                >
                  {row.milestone.name}
                </Link>
                <div className="mt-1">
                  <PriorityBadge priority={row.milestone.priority} />
                </div>
              </td>
              {showProject && <td className="px-3 py-3 text-slate-700">{row.projectName}</td>}
              <td className="px-3 py-3 text-slate-700">{row.milestone.owner}</td>
              <td className="px-3 py-3">
                <div className="flex max-w-64 flex-col items-start gap-1">
                  <MilestoneStatusBadge status={row.state.status} />
                  <p className="text-xs text-slate-500">{row.state.explanation}</p>
                </div>
              </td>
              <td className="px-3 py-3">
                <MilestoneProgress progress={row.state.progress} label={`${row.milestone.name} progress`} />
              </td>
              <td className="px-5 py-3"><DateCell row={row} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
