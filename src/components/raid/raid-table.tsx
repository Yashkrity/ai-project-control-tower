import Link from "next/link";
import { ArrowDown } from "lucide-react";
import type { RaidRow, RaidSort } from "@/lib/raid/views";
import { TARGET_DATE_LABEL } from "@/lib/raid/rules";
import { daysBetween, formatDate } from "@/lib/utils/dates";
import { cn } from "@/lib/utils/format";
import { Badge } from "@/components/ui/badge";
import { RaidStatusBadge, RaidTypeBadge, SeverityBadge } from "./raid-badges";

function Deadline({ row, today }: { row: RaidRow; today: string }) {
  const { item, overdue, upcoming, open } = row;
  if (!item.targetDate) return <span className="text-slate-400">—</span>;
  const days = daysBetween(today, item.targetDate);
  return (
    <div className="flex flex-col items-start gap-1">
      <span className="text-[11px] text-slate-500">{TARGET_DATE_LABEL[item.type]}</span>
      <span className="text-slate-700">{formatDate(item.targetDate)}</span>
      {!open && item.resolvedDate ? (
        <span className="text-[11px] text-slate-500">Resolved {formatDate(item.resolvedDate)}</span>
      ) : overdue ? (
        <Badge tone="red">{-days}d overdue</Badge>
      ) : upcoming ? (
        <Badge tone="amber">{days === 0 ? "Today" : `In ${days}d`}</Badge>
      ) : null}
    </div>
  );
}

/** Column header that links to a sort; the active sort shows an arrow. */
function SortHeader({ label, sort, active, href, className }: { label: string; sort: RaidSort; active: RaidSort; href: (s: RaidSort) => string; className?: string }) {
  return (
    <th scope="col" className={cn("px-3 py-2.5 font-medium", className)} aria-sort={active === sort ? "ascending" : undefined}>
      <Link href={href(sort)} className={cn("inline-flex items-center gap-1 hover:text-slate-800", active === sort && "text-slate-800")}>
        {label}
        {active === sort && <ArrowDown className="size-3" aria-hidden />}
      </Link>
    </th>
  );
}

export function RaidTable({
  rows,
  today,
  sort,
  sortHref,
  showProject = true,
}: {
  rows: RaidRow[];
  today: string;
  sort: RaidSort;
  sortHref: (s: RaidSort) => string;
  showProject?: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[960px] text-left text-sm">
        <thead className="border-b border-slate-100 text-xs text-slate-500">
          <tr>
            <SortHeader label="Record" sort="ref" active={sort} href={sortHref} className="pl-5" />
            {showProject && <th scope="col" className="px-3 py-2.5 font-medium">Project</th>}
            <th scope="col" className="px-3 py-2.5 font-medium">Owner</th>
            <SortHeader label="Severity" sort="severity" active={sort} href={sortHref} />
            <th scope="col" className="px-3 py-2.5 font-medium">Status</th>
            <SortHeader label="Deadline" sort="deadline" active={sort} href={sortHref} />
            <SortHeader label="Updated" sort="updated" active={sort} href={sortHref} className="pr-5" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={row.item.id} className={cn("relative align-top hover:bg-slate-50/70", !row.open && "text-slate-500")}>
              <td className="py-3 pl-5 pr-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-slate-500">{row.item.ref}</span>
                  <RaidTypeBadge type={row.item.type} />
                </div>
                <Link href={`/raid/${row.item.id}`} className="mt-1 block font-medium text-slate-900 after:absolute after:inset-0 hover:text-indigo-700">
                  {row.item.title}
                </Link>
                {(row.milestone || row.task) && (
                  <p className="mt-0.5 text-xs text-slate-500">
                    Impacts: {[row.milestone && `milestone “${row.milestone.name}”`, row.task && `task “${row.task.title}”`].filter(Boolean).join(", ")}
                  </p>
                )}
              </td>
              {showProject && <td className="px-3 py-3 text-slate-700">{row.projectName}</td>}
              <td className="px-3 py-3 text-slate-700">{row.item.owner}</td>
              <td className="px-3 py-3"><SeverityBadge severity={row.severity} score={row.score} /></td>
              <td className="px-3 py-3">
                <div className="flex max-w-56 flex-col items-start gap-1">
                  <RaidStatusBadge type={row.item.type} status={row.item.status} />
                  {row.escalation && <p className="text-xs font-medium text-red-600">{row.escalation}</p>}
                </div>
              </td>
              <td className="px-3 py-3"><Deadline row={row} today={today} /></td>
              <td className="py-3 pl-3 pr-5 text-xs text-slate-500">{formatDate(row.item.updatedAt.slice(0, 10))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
