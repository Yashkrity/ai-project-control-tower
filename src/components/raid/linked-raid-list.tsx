import Link from "next/link";
import { Plus } from "lucide-react";
import type { RaidRow } from "@/lib/raid/views";
import { Card, CardHeader } from "@/components/ui/card";
import { RaidStatusBadge, RaidTypeBadge, SeverityBadge } from "./raid-badges";

/** RAID records that impact a task or milestone, with a quick "log" link. */
export function LinkedRaidList({ rows, newHref, readOnly }: { rows: RaidRow[]; newHref: string; readOnly?: boolean }) {
  return (
    <Card>
      <CardHeader
        title="RAID records"
        description={rows.length ? `${rows.filter((r) => r.open).length} open` : undefined}
        action={
          !readOnly ? (
            <Link href={newHref} className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-500">
              <Plus className="size-3.5" aria-hidden />
              Log RAID item
            </Link>
          ) : undefined
        }
      />
      {rows.length === 0 ? (
        <p className="px-5 py-4 text-sm text-slate-500">No risks, assumptions, issues or dependencies linked.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((r) => (
            <li key={r.item.id} className="relative space-y-1.5 px-5 py-3 hover:bg-slate-50/70">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-mono text-xs text-slate-500">{r.item.ref}</span>
                <RaidTypeBadge type={r.item.type} />
                <RaidStatusBadge type={r.item.type} status={r.item.status} />
                <SeverityBadge severity={r.severity} score={r.score} />
              </div>
              <Link href={`/raid/${r.item.id}`} className="block text-sm font-medium text-slate-900 after:absolute after:inset-0 hover:text-indigo-700">
                {r.item.title}
              </Link>
              {(r.escalation || r.overdue) && (
                <p className="text-xs font-medium text-red-600">{[r.escalation, r.overdue && "Overdue"].filter(Boolean).join(" · ")}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
