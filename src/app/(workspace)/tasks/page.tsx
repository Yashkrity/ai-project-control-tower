import { Suspense } from "react";
import type { Metadata } from "next";
import { ListChecks, Plus, SearchX } from "lucide-react";
import { getRepository, getToday } from "@/lib/data";
import { applyTaskFilters, buildTaskRows, parseTaskFilters, viewCounts } from "@/lib/tasks/views";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TaskTable } from "@/components/tasks/task-table";
import { TaskFilterBar, TaskViewTabs } from "@/components/tasks/task-filters";

export const metadata: Metadata = { title: "Tasks" };

async function TaskList({ searchParams }: { searchParams: PageProps<"/tasks">["searchParams"] }) {
  const filters = parseTaskFilters(await searchParams);
  const today = await getToday();
  const data = await (await getRepository()).getPortfolio();

  const allRows = buildTaskRows(data, today);
  const rows = applyTaskFilters(allRows, filters);
  const counts = viewCounts(allRows, filters);
  const projects = data.projects
    .filter((p) => p.archivedAt === null)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((p) => ({ id: p.id, name: p.name }));
  const owners = [...new Set(allRows.map((r) => r.task.owner))].sort((a, b) => a.localeCompare(b));
  const newHref = filters.project ? `/tasks/new?project=${encodeURIComponent(filters.project)}` : "/tasks/new";

  return (
    <Card>
      <TaskViewTabs filters={filters} counts={counts} />
      <TaskFilterBar filters={filters} projects={projects} owners={owners} />
      <div className="border-t border-slate-100">
        {allRows.length === 0 ? (
          <EmptyState
            icon={ListChecks}
            title="No tasks yet"
            description="Create a task to start tracking work against a project."
            action={<LinkButton href={newHref}><Plus className="size-4" aria-hidden />New task</LinkButton>}
          />
        ) : rows.length === 0 ? (
          <EmptyState icon={SearchX} title="No tasks match" description="Try another view or clear the filters." />
        ) : (
          <>
            <p className="px-5 pt-3 text-xs text-slate-500">
              {rows.length} task{rows.length === 1 ? "" : "s"} · tasks in archived projects are hidden
            </p>
            <TaskTable rows={rows} showProject={!filters.project} />
          </>
        )}
      </div>
    </Card>
  );
}

export default function TasksPage({ searchParams }: PageProps<"/tasks">) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Tasks"
        description="Plan and track work across projects, with owners, due dates and dependencies."
        actions={
          <LinkButton href="/tasks/new">
            <Plus className="size-4" aria-hidden />
            New task
          </LinkButton>
        }
      />
      <Suspense fallback={<Skeleton className="h-[480px] rounded-xl" />}>
        <TaskList searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
