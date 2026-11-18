import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRepository, getToday } from "@/lib/data";
import { milestoneFormOptions } from "@/lib/milestones/form-data";
import { milestoneState } from "@/lib/milestones/rules";
import { milestoneToFormValues } from "@/lib/validation/milestone";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { MilestoneForm } from "@/components/milestones/milestone-form";
import { updateMilestoneAction } from "../../actions";

export const metadata: Metadata = { title: "Edit milestone" };

async function EditMilestoneForm({ params }: { params: PageProps<"/milestones/[id]/edit">["params"] }) {
  const { id } = await params;
  const today = await getToday();
  const data = await (await getRepository()).getPortfolio();
  const milestone = data.milestones.find((m) => m.id === id);
  if (!milestone) notFound();
  const state = milestoneState(milestone, data.tasks.filter((t) => t.projectId === milestone.projectId), today);

  return (
    <div className="space-y-6">
      <PageHeader title={`Edit “${milestone.name}”`} description="Changes to planned dates and completion are recorded in the project's activity log." />
      <MilestoneForm
        action={updateMilestoneAction.bind(null, milestone.id)}
        initialValues={milestoneToFormValues(milestone)}
        submitLabel="Save changes"
        cancelHref={`/milestones/${milestone.id}`}
        today={today}
        current={{ status: state.status, explanation: state.explanation, linkedTasks: state.tasks.length, openTasks: state.openTasks.length }}
        {...milestoneFormOptions(data)}
      />
    </div>
  );
}

export default function EditMilestonePage({ params }: PageProps<"/milestones/[id]/edit">) {
  return (
    <div className="mx-auto max-w-3xl">
      <Suspense fallback={<Skeleton className="h-[640px] rounded-xl" />}>
        <EditMilestoneForm params={params} />
      </Suspense>
    </div>
  );
}
