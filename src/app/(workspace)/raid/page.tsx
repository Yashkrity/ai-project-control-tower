import { Suspense } from "react";
import type { Metadata } from "next";
import { Plus, SearchX, ShieldCheck } from "lucide-react";
import { getRepository, getToday } from "@/lib/data";
import { applyRaidFilters, buildRaidRows, parseRaidFilters, raidCounts, raidFiltersToQuery } from "@/lib/raid/views";
import { RAID_TYPE_LABEL, RISK_LEVEL_THRESHOLDS, UPCOMING_REVIEW_DAYS } from "@/lib/raid/rules";
import { humanize } from "@/lib/utils/format";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RaidTable } from "@/components/raid/raid-table";
import { RaidFilterBar, RaidFocusChips, RaidTabs } from "@/components/raid/raid-filters";

export const metadata: Metadata = { title: "RAID log" };

async function Register({ searchParams }: { searchParams: PageProps<"/raid">["searchParams"] }) {
  const filters = parseRaidFilters(await searchParams);
  const today = await getToday();
  const data = await (await getRepository()).getPortfolio();

  const all = buildRaidRows(data, today);
  const rows = applyRaidFilters(all, filters);
  const counts = raidCounts(all, filters);
  const projects = data.projects.filter((p) => p.archivedAt === null).sort((a, b) => a.name.localeCompare(b.name)).map((p) => ({ id: p.id, name: p.name }));
  const owners = [...new Set(all.map((r) => r.item.owner))].sort((a, b) => a.localeCompare(b));
  const newQuery = new URLSearchParams({ ...(filters.tab !== "all" && { type: filters.tab }), ...(filters.project && { project: filters.project }) }).toString();
  const newHref = `/raid/new${newQuery ? `?${newQuery}` : ""}`;

  return (
    <Card>
      <RaidTabs filters={filters} counts={counts.tabs} />
      <RaidFocusChips filters={filters} counts={counts.focus} />
      <RaidFilterBar filters={filters} projects={projects} owners={owners} />
      <div className="border-t border-slate-100">
        {all.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title="The RAID log is empty"
            description="Record risks, assumptions, issues and dependencies to manage them alongside delivery."
            action={<LinkButton href={newHref}><Plus className="size-4" aria-hidden />New record</LinkButton>}
          />
        ) : rows.length === 0 ? (
          <EmptyState icon={SearchX} title="No records match" description="Try another tab, focus or search, or clear the filters." />
        ) : (
          <>
            <p className="px-5 pt-3 text-xs text-slate-500">
              {rows.length} record{rows.length === 1 ? "" : "s"} · overdue = open and past its deadline · upcoming = deadline within {UPCOMING_REVIEW_DAYS} days ·
              risk level from score (probability × impact): {RISK_LEVEL_THRESHOLDS.map((t) => `${t.min}–${t.max} ${humanize(t.level)}`).join(", ")}
            </p>
            <RaidTable rows={rows} today={today} sort={filters.sort} sortHref={(sort) => `/raid${raidFiltersToQuery(filters, { sort })}`} showProject={!filters.project} />
          </>
        )}
      </div>
    </Card>
  );
}

async function NewButton({ searchParams }: { searchParams: PageProps<"/raid">["searchParams"] }) {
  const f = parseRaidFilters(await searchParams);
  const qs = new URLSearchParams({ ...(f.tab !== "all" && { type: f.tab }), ...(f.project && { project: f.project }) }).toString();
  return (
    <LinkButton href={`/raid/new${qs ? `?${qs}` : ""}`}>
      <Plus className="size-4" aria-hidden />
      {f.tab === "all" ? "New record" : `New ${RAID_TYPE_LABEL[f.tab].toLowerCase()}`}
    </LinkButton>
  );
}

export default function RaidPage({ searchParams }: PageProps<"/raid">) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="RAID log"
        description="Risks, assumptions, issues and dependencies across the portfolio. Scores, overdue and escalation flags are calculated, not typed in."
        actions={
          <Suspense fallback={<LinkButton href="/raid/new"><Plus className="size-4" aria-hidden />New record</LinkButton>}>
            <NewButton searchParams={searchParams} />
          </Suspense>
        }
      />
      <Suspense fallback={<Skeleton className="h-[520px] rounded-xl" />}>
        <Register searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
