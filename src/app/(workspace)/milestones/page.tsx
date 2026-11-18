import { Suspense } from "react";
import type { Metadata } from "next";
import { CalendarPlus, Plus, SearchX } from "lucide-react";
import { getRepository, getToday } from "@/lib/data";
import { applyMilestoneFilters, buildMilestoneRows, milestoneViewCounts, parseMilestoneFilters } from "@/lib/milestones/views";
import { AT_RISK_WINDOW_DAYS, UPCOMING_WINDOW_DAYS } from "@/lib/milestones/rules";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MilestoneTable } from "@/components/milestones/milestone-table";
import { MilestoneFilterBar, MilestoneViewTabs } from "@/components/milestones/milestone-filters";

export const metadata: Metadata = { title: "Milestones" };

async function MilestoneList({ searchParams }: { searchParams: PageProps<"/milestones">["searchParams"] }) {
  const filters = parseMilestoneFilters(await searchParams);
  const today = await getToday();
  const data = await (await getRepository()).getPortfolio();

  const all = buildMilestoneRows(data, today);
  const rows = applyMilestoneFilters(all, filters);
  const counts = milestoneViewCounts(all, filters);
  const projects = data.projects
    .filter((p) => p.archivedAt === null)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((p) => ({ id: p.id, name: p.name }));
  const owners = [...new Set(all.map((r) => r.milestone.owner))].sort((a, b) => a.localeCompare(b));
  const newHref = filters.project ? `/milestones/new?project=${encodeURIComponent(filters.project)}` : "/milestones/new";

  return (
    <Card>
      <MilestoneViewTabs filters={filters} counts={counts} />
      <MilestoneFilterBar filters={filters} projects={projects} owners={owners} />
      <div className="border-t border-slate-100">
        {all.length === 0 ? (
          <EmptyState
            icon={CalendarPlus}
            title="No milestones yet"
            description="Create a milestone, then link tasks to it to track progress."
            action={<LinkButton href={newHref}><Plus className="size-4" aria-hidden />New milestone</LinkButton>}
          />
        ) : rows.length === 0 ? (
          <EmptyState icon={SearchX} title="No milestones match" description="Try another view or clear the filters." />
        ) : (
          <>
            <p className="px-5 pt-3 text-xs text-slate-500">
              {rows.length} milestone{rows.length === 1 ? "" : "s"} · upcoming = next {UPCOMING_WINDOW_DAYS} days · at risk = due within{" "}
              {AT_RISK_WINDOW_DAYS} days with open tasks, or a linked task is blocked · archived projects hidden
            </p>
            <MilestoneTable rows={rows} showProject={!filters.project} />
          </>
        )}
      </div>
    </Card>
  );
}

export default function MilestonesPage({ searchParams }: PageProps<"/milestones">) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Milestones"
        description="Status and progress are calculated from linked tasks and dates. They are separate from a project's manual RAG health."
        actions={
          <LinkButton href="/milestones/new">
            <Plus className="size-4" aria-hidden />
            New milestone
          </LinkButton>
        }
      />
      <Suspense fallback={<Skeleton className="h-[480px] rounded-xl" />}>
        <MilestoneList searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
