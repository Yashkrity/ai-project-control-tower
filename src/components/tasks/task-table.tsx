import Link from "next/link";
import { Link2 } from "lucide-react";
import type { TaskRow } from "@/lib/tasks/views";
import { Badge, PriorityBadge, TaskStatusBadge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils/dates";

/** One-line explanation of why a task is blocked (or what it waits on). */
export function BlockReason({ row }: { row: Pick<TaskRow, "block" | "task"> }) {
  const { block, task } = row;
  if (task.status === "done" || (!block.blocked && block.waitingOn.length === 0)) return null;
  const names = block.waitingOn.map((p) => `“${p.title}”`).join(", ");
  let text: string;
  if (block.byDependencies) text = `Blocked: waiting on ${names}`;
  else if (block.byStatus && block.waitingOn.length) text = `Marked blocked · waiting on ${names}`;
  else if (block.byStatus) text = "Marked blocked";
  else text = `Waiting on ${names}`; // not started yet, or on hold
  return <p className={block.blocked ? "text-xs font-medium text-red-600" : "text-xs text-slate-500"}>{text}</p>;
}

export function DueCell({ row }: { row: TaskRow }) {
  const { task, overdue, dueSoon, dueInDays } = row;
  return (
    <div className="flex flex-col items-start gap-1">
      <span className="text-slate-700">{formatDate(task.dueDate)}</span>
      {task.status === "done" && task.completedDate ? (
        <span className="text-[11px] text-slate-500">Done {formatDate(task.completedDate)}</span>
      ) : overdue ? (
        <Badge tone="red">{dueInDays}d late</Badge>
      ) : dueSoon ? (
        <Badge tone="amber">{dueInDays === 0 ? "Due today" : `In ${-dueInDays}d`}</Badge>
      ) : null}
    </div>
  );
}

export function TaskTable({ rows, showProject = true }: { rows: TaskRow[]; showProject?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[880px] text-left text-sm">
        <thead className="border-b border-slate-100 text-xs text-slate-500">
          <tr>
            <th scope="col" className="px-5 py-2.5 font-medium">Task</th>
            {showProject && <th scope="col" className="px-3 py-2.5 font-medium">Project</th>}
            <th scope="col" className="px-3 py-2.5 font-medium">Owner</th>
            <th scope="col" className="px-3 py-2.5 font-medium">Priority</th>
            <th scope="col" className="px-3 py-2.5 font-medium">Status</th>
            <th scope="col" className="px-3 py-2.5 font-medium">Due</th>
            <th scope="col" className="px-5 py-2.5 font-medium">Depends on</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={row.task.id} className="relative align-top hover:bg-slate-50/70">
              <td className="px-5 py-3">
                <Link
                  href={`/tasks/${row.task.id}`}
                  className="font-medium text-slate-900 after:absolute after:inset-0 hover:text-indigo-700"
                >
                  {row.task.title}
                </Link>
                {row.milestoneName && <p className="text-xs text-slate-500">Milestone: {row.milestoneName}</p>}
              </td>
              {showProject && <td className="px-3 py-3 text-slate-700">{row.projectName}</td>}
              <td className="px-3 py-3 text-slate-700">{row.task.owner}</td>
              <td className="px-3 py-3"><PriorityBadge priority={row.task.priority} /></td>
              <td className="px-3 py-3">
                <div className="flex max-w-56 flex-col items-start gap-1">
                  <TaskStatusBadge status={row.task.status} />
                  <BlockReason row={row} />
                </div>
              </td>
              <td className="px-3 py-3"><DueCell row={row} /></td>
              <td className="px-5 py-3 text-slate-600">
                {row.task.dependsOn.length === 0 ? (
                  <span className="text-slate-400">—</span>
                ) : (
                  <span className="inline-flex items-center gap-1">
                    <Link2 className="size-3.5" aria-hidden />
                    {row.task.dependsOn.length} predecessor{row.task.dependsOn.length === 1 ? "" : "s"}
                    {row.block.waitingOn.length > 0 && <span className="text-slate-500">({row.block.waitingOn.length} open)</span>}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
