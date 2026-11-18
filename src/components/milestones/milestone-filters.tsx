import Link from "next/link";
import { MILESTONE_STATUSES } from "@/lib/types";
import { MILESTONE_VIEWS, milestoneFiltersToQuery, type MilestoneFilters, type MilestoneView } from "@/lib/milestones/views";
import { cn, humanize } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/form-field";

export function MilestoneViewTabs({ filters, counts }: { filters: MilestoneFilters; counts: Record<MilestoneView, number> }) {
  return (
    <nav aria-label="Milestone views" className="flex gap-1 overflow-x-auto border-b border-slate-100 px-3 pt-2">
      {MILESTONE_VIEWS.map((v) => (
        <Link
          key={v.key}
          href={`/milestones${milestoneFiltersToQuery(filters, { view: v.key })}`}
          aria-current={filters.view === v.key ? "page" : undefined}
          className={cn(
            "-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium",
            filters.view === v.key ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-800",
          )}
        >
          {v.label} <span className="ml-1 text-xs tabular-nums text-slate-400">{counts[v.key]}</span>
        </Link>
      ))}
    </nav>
  );
}

/** Plain GET form: works without JavaScript and keeps the URL shareable. */
export function MilestoneFilterBar({
  filters,
  projects,
  owners,
}: {
  filters: MilestoneFilters;
  projects: { id: string; name: string }[];
  owners: string[];
}) {
  const active = !!(filters.project || filters.owner || filters.status || filters.from || filters.to);
  const label = (id: string, text: string) => (
    <label htmlFor={id} className="block text-xs font-medium text-slate-500">
      {text}
    </label>
  );
  const select = (name: "project" | "owner" | "status", text: string, options: { value: string; label: string }[]) => (
    <div className="min-w-0">
      {label(`mf-${name}`, text)}
      <select id={`mf-${name}`} name={name} defaultValue={filters[name] ?? ""} className={cn(inputClass(false), "mt-1 py-1.5")}>
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
      {label(`mf-${name}`, text)}
      <input id={`mf-${name}`} type="date" name={name} defaultValue={filters[name] ?? ""} className={cn(inputClass(false), "mt-1 py-1.5")} />
    </div>
  );

  return (
    <form method="get" action="/milestones" className="grid grid-cols-2 items-end gap-3 px-5 py-4 lg:grid-cols-[repeat(5,minmax(0,1fr))_auto]">
      {filters.view !== "all" && <input type="hidden" name="view" value={filters.view} />}
      {select("project", "Project", projects.map((p) => ({ value: p.id, label: p.name })))}
      {select("owner", "Owner", owners.map((o) => ({ value: o, label: o })))}
      {select("status", "Status", MILESTONE_STATUSES.map((s) => ({ value: s, label: humanize(s) })))}
      {date("from", "Planned from")}
      {date("to", "Planned to")}
      <div className="col-span-2 flex gap-2 lg:col-span-1">
        <Button type="submit" variant="secondary" className="py-1.5">
          Apply
        </Button>
        {active && (
          <Link href={`/milestones${milestoneFiltersToQuery({ view: filters.view })}`} className="self-center text-sm font-medium text-slate-500 hover:text-slate-800">
            Clear
          </Link>
        )}
      </div>
    </form>
  );
}
