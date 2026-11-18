import Link from "next/link";
import { Search } from "lucide-react";
import { PRIORITIES, RAID_STATUSES_BY_TYPE } from "@/lib/types";
import { RAID_FOCUS, RAID_TABS, raidFiltersToQuery, type RaidFilters, type RaidFocus, type RaidTab } from "@/lib/raid/views";
import { cn, humanize } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/form-field";

export function RaidTabs({ filters, counts }: { filters: RaidFilters; counts: Record<RaidTab, number> }) {
  return (
    <nav aria-label="RAID types" className="flex gap-1 overflow-x-auto border-b border-slate-100 px-3 pt-2">
      {RAID_TABS.map((t) => (
        <Link
          key={t.key}
          href={`/raid${raidFiltersToQuery(filters, { tab: t.key, status: undefined })}`}
          aria-current={filters.tab === t.key ? "page" : undefined}
          className={cn(
            "-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium",
            filters.tab === t.key ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-800",
          )}
        >
          {t.label} <span className="ml-1 text-xs tabular-nums text-slate-400">{counts[t.key]}</span>
        </Link>
      ))}
    </nav>
  );
}

/** Governance shortcuts; clicking an active chip clears it. */
export function RaidFocusChips({ filters, counts }: { filters: RaidFilters; counts: Record<RaidFocus, number> }) {
  return (
    <div className="flex flex-wrap gap-2 px-5 pt-4" role="group" aria-label="Focus views">
      {RAID_FOCUS.map((f) => {
        const active = filters.focus === f.key;
        const alert = counts[f.key] > 0 && f.key !== "upcoming";
        return (
          <Link
            key={f.key}
            href={`/raid${raidFiltersToQuery(filters, { focus: active ? undefined : f.key })}`}
            aria-pressed={active}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              active ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300",
            )}
          >
            {f.label}
            <span
              className={cn(
                "rounded-full px-1.5 tabular-nums",
                active ? "bg-white/20" : alert ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600",
              )}
            >
              {counts[f.key]}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

export function RaidFilterBar({ filters, projects, owners }: { filters: RaidFilters; projects: { id: string; name: string }[]; owners: string[] }) {
  const active = !!(filters.project || filters.owner || filters.state || filters.status || filters.severity || filters.from || filters.to || filters.q);
  const lbl = (id: string, text: string) => (
    <label htmlFor={id} className="block text-xs font-medium text-slate-500">
      {text}
    </label>
  );
  const select = (name: "project" | "owner" | "state" | "status" | "severity", text: string, options: { value: string; label: string }[]) => (
    <div className="min-w-0">
      {lbl(`rf-${name}`, text)}
      <select id={`rf-${name}`} name={name} defaultValue={filters[name] ?? ""} className={cn(inputClass(false), "mt-1 py-1.5")}>
        <option value="">All</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
  const date = (name: "from" | "to", text: string) => (
    <div className="min-w-0">
      {lbl(`rf-${name}`, text)}
      <input id={`rf-${name}`} type="date" name={name} defaultValue={filters[name] ?? ""} className={cn(inputClass(false), "mt-1 py-1.5")} />
    </div>
  );

  return (
    <form method="get" action="/raid" className="space-y-3 px-5 py-4">
      {filters.tab !== "all" && <input type="hidden" name="tab" value={filters.tab} />}
      {filters.focus && <input type="hidden" name="focus" value={filters.focus} />}
      {filters.sort !== "deadline" && <input type="hidden" name="sort" value={filters.sort} />}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
        <label htmlFor="rf-q" className="sr-only">Search RAID records</label>
        <input
          id="rf-q"
          type="search"
          name="q"
          defaultValue={filters.q ?? ""}
          placeholder="Search by ID, title, description, owner or plan…"
          className={cn(inputClass(false), "pl-9")}
        />
      </div>
      <div className="grid grid-cols-2 items-end gap-3 md:grid-cols-4 xl:grid-cols-[repeat(7,minmax(0,1fr))_auto]">
        {select("project", "Project", projects.map((p) => ({ value: p.id, label: p.name })))}
        {select("owner", "Owner", owners.map((o) => ({ value: o, label: o })))}
        {select("state", "Open / closed", [
          { value: "open", label: "Open" },
          { value: "closed", label: "Closed" },
        ])}
        {filters.tab !== "all"
          ? select("status", "Status", RAID_STATUSES_BY_TYPE[filters.tab].map((s) => ({ value: s, label: humanize(s) })))
          : (
            <div className="min-w-0 text-xs text-slate-400">
              <span className="block font-medium">Status</span>
              <span className="mt-2.5 block">Pick a type tab</span>
            </div>
          )}
        {select("severity", "Severity", [...PRIORITIES].reverse().map((p) => ({ value: p, label: humanize(p) })))}
        {date("from", "Deadline from")}
        {date("to", "Deadline to")}
        <div className="col-span-2 flex gap-2 md:col-span-1">
          <Button type="submit" variant="secondary" className="py-1.5">
            Apply
          </Button>
          {active && (
            <Link href={`/raid${raidFiltersToQuery({ tab: filters.tab, focus: filters.focus, sort: filters.sort })}`} className="self-center text-sm font-medium text-slate-500 hover:text-slate-800">
              Clear
            </Link>
          )}
        </div>
      </div>
    </form>
  );
}
