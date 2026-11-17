import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Archive, FolderPlus, Plus } from "lucide-react";
import { getRepository, getToday } from "@/lib/data";
import { isArchived, summarizeProject } from "@/lib/metrics/portfolio";
import { cn } from "@/lib/utils/format";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectsTable } from "@/components/projects/projects-table";

export const metadata: Metadata = { title: "Projects" };

const VIEWS = [
  { key: "current", label: "Current" },
  { key: "archived", label: "Archived" },
  { key: "all", label: "All" },
] as const;
type View = (typeof VIEWS)[number]["key"];

function parseView(value: string | string[] | undefined): View {
  return VIEWS.some((v) => v.key === value) ? (value as View) : "current";
}

async function ProjectsList({ searchParams }: { searchParams: PageProps<"/projects">["searchParams"] }) {
  const view = parseView((await searchParams).view);
  const today = await getToday();
  const data = await (await getRepository()).getPortfolio();

  const counts = {
    current: data.projects.filter((p) => !isArchived(p)).length,
    archived: data.projects.filter(isArchived).length,
    all: data.projects.length,
  };
  const rows = data.projects
    .filter((p) => (view === "all" ? true : view === "archived" ? isArchived(p) : !isArchived(p)))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((p) => summarizeProject(p, data, today));

  return (
    <Card>
      <nav aria-label="Project views" className="flex gap-1 border-b border-slate-100 px-3 pt-2">
        {VIEWS.map((v) => (
          <Link
            key={v.key}
            href={v.key === "current" ? "/projects" : `/projects?view=${v.key}`}
            aria-current={view === v.key ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium",
              view === v.key
                ? "border-indigo-600 text-indigo-700"
                : "border-transparent text-slate-500 hover:text-slate-800",
            )}
          >
            {v.label} <span className="ml-1 text-xs tabular-nums text-slate-400">{counts[v.key]}</span>
          </Link>
        ))}
      </nav>
      {rows.length === 0 ? (
        view === "archived" ? (
          <EmptyState icon={Archive} title="No archived projects" description="Archived projects are kept here and can be restored at any time." />
        ) : (
          <EmptyState
            icon={FolderPlus}
            title="No projects yet"
            description="Create your first project to start tracking delivery."
            action={<LinkButton href="/projects/new"><Plus className="size-4" aria-hidden />New project</LinkButton>}
          />
        )
      ) : (
        <ProjectsTable rows={rows} />
      )}
    </Card>
  );
}

export default function ProjectsPage({ searchParams }: PageProps<"/projects">) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description="Every project in the portfolio, most recently updated first."
        actions={
          <LinkButton href="/projects/new">
            <Plus className="size-4" aria-hidden />
            New project
          </LinkButton>
        }
      />
      <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
        <ProjectsList searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
