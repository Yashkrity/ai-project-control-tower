import Link from "next/link";
import { PRIORITIES, TASK_STATUSES } from "@/lib/types";
import { filtersToQuery, TASK_VIEWS, type TaskFilters, type TaskView } from "@/lib/tasks/views";
import { cn, humanize } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/form-field";

/** View tabs; each keeps the current filters. */
export function TaskViewTabs({ filters, counts }: { filters: TaskFilters; counts: Record<TaskView, number> }) {
  return (
    <nav aria-label="Task views" className="flex gap-1 overflow-x-auto border-b border-slate-100 px-3 pt-2">
      {TASK_VIEWS.map((v) => (
        <Link
          key={v.key}
          href={`/tasks${filtersToQuery(filters, { view: v.key })}`}
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
export function TaskFilterBar({
  filters,
  projects,
  owners,
}: {
  filters: TaskFilters;
  projects: { id: string; name: string }[];
  owners: string[];
}) {
  const active = !!(filters.project || filters.owner || filters.priority || filters.status);
  const select = (name: keyof TaskFilters, label: string, options: { value: string; label: string }[]) => (
    <div className="min-w-0">
      <label htmlFor={`filter-${name}`} className="block text-xs font-medium text-slate-500">
        {label}
      </label>
      <select id={`filter-${name}`} name={name} defaultValue={filters[name] ?? ""} className={cn(inputClass(false), "mt-1 py-1.5")}>
        <option value="">All</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <form method="get" action="/tasks" className="grid grid-cols-2 items-end gap-3 px-5 py-4 md:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
      {filters.view !== "all" && <input type="hidden" name="view" value={filters.view} />}
      {select("project", "Project", projects.map((p) => ({ value: p.id, label: p.name })))}
      {select("owner", "Owner", owners.map((o) => ({ value: o, label: o })))}
      {select("priority", "Priority", [...PRIORITIES].reverse().map((p) => ({ value: p, label: humanize(p) })))}
      {select("status", "Status", TASK_STATUSES.map((s) => ({ value: s, label: humanize(s) })))}
      <div className="col-span-2 flex gap-2 md:col-span-1">
        <Button type="submit" variant="secondary" className="py-1.5">
          Apply
        </Button>
        {active && (
          <Link href={`/tasks${filtersToQuery({ view: filters.view })}`} className="self-center text-sm font-medium text-slate-500 hover:text-slate-800">
            Clear
          </Link>
        )}
      </div>
    </form>
  );
}
