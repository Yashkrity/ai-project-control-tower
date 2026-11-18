import { Suspense } from "react";
import type { Metadata } from "next";
import { getRepository, getToday } from "@/lib/data";
import { milestoneFormOptions } from "@/lib/milestones/form-data";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { MilestoneForm } from "@/components/milestones/milestone-form";
import { createMilestoneAction } from "../actions";

export const metadata: Metadata = { title: "New milestone" };

async function NewMilestoneForm({ searchParams }: { searchParams: PageProps<"/milestones/new">["searchParams"] }) {
  const { project } = await searchParams;
  const today = await getToday();
  const data = await (await getRepository()).getPortfolio();
  const options = milestoneFormOptions(data);
  const chosen = typeof project === "string" ? data.projects.find((p) => p.id === project && p.archivedAt === null) : undefined;

  return (
    <MilestoneForm
      // Remount when ?project changes, so client state starts fresh.
      key={chosen?.id ?? ""}
      action={createMilestoneAction}
      initialValues={{ projectId: chosen?.id ?? "", owner: chosen?.projectManager ?? "", priority: "medium" }}
      submitLabel="Create milestone"
      cancelHref={chosen ? `/projects/${chosen.id}` : "/milestones"}
      today={today}
      {...options}
    />
  );
}

export default function NewMilestonePage({ searchParams }: PageProps<"/milestones/new">) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="New milestone" description="Fields marked * are required. Link tasks after creating it." />
      <Suspense fallback={<Skeleton className="h-[640px] rounded-xl" />}>
        <NewMilestoneForm searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
