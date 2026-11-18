import { Suspense } from "react";
import type { Metadata } from "next";
import { getRepository, getToday } from "@/lib/data";
import { raidFormOptions } from "@/lib/raid/form-data";
import { isRaidType } from "@/lib/raid/views";
import { RAID_STATUSES_BY_TYPE } from "@/lib/types";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { RaidForm } from "@/components/raid/raid-form";
import { createRaidAction } from "../actions";

export const metadata: Metadata = { title: "New RAID record" };

async function NewForm({ searchParams }: { searchParams: PageProps<"/raid/new">["searchParams"] }) {
  const sp = await searchParams;
  const today = await getToday();
  const data = await (await getRepository()).getPortfolio();
  const options = raidFormOptions(data);
  const type = isRaidType(sp.type) ? sp.type : "risk";
  const project = typeof sp.project === "string" ? data.projects.find((p) => p.id === sp.project && p.archivedAt === null) : undefined;
  const milestone = typeof sp.milestone === "string" ? data.milestones.find((m) => m.id === sp.milestone && m.projectId === project?.id) : undefined;
  const task = typeof sp.task === "string" ? data.tasks.find((t) => t.id === sp.task && t.projectId === project?.id) : undefined;

  return (
    <RaidForm
      // Remount when the query changes (e.g. ?type=risk -> ?type=issue), so client state starts fresh.
      key={`${type}|${project?.id ?? ""}|${milestone?.id ?? ""}|${task?.id ?? ""}`}
      action={createRaidAction}
      initialValues={{
        type,
        status: RAID_STATUSES_BY_TYPE[type][0],
        projectId: project?.id ?? "",
        owner: project?.projectManager ?? "",
        milestoneId: milestone?.id ?? "",
        taskId: task?.id ?? "",
        priority: "medium",
        probability: "3",
        impact: "3",
        direction: "external",
      }}
      submitLabel="Create record"
      cancelHref={project ? `/projects/${project.id}` : "/raid"}
      today={today}
      {...options}
    />
  );
}

export default function NewRaidPage({ searchParams }: PageProps<"/raid/new">) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="New RAID record" description="Choose the type first; the form shows only the fields that type needs." />
      <Suspense fallback={<Skeleton className="h-[720px] rounded-xl" />}>
        <NewForm searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
