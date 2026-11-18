import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRepository, getToday } from "@/lib/data";
import { buildRaidRows } from "@/lib/raid/views";
import { RaidDetail } from "@/components/raid/raid-detail";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "RAID record" };

async function Content({ params }: { params: PageProps<"/raid/[id]">["params"] }) {
  const { id } = await params;
  const today = await getToday();
  const data = await (await getRepository()).getPortfolio();
  const row = buildRaidRows(data, today, { includeArchived: true }).find((r) => r.item.id === id);
  const project = row && data.projects.find((p) => p.id === row.item.projectId);
  if (!row || !project) notFound();

  const history = data.updates.filter((u) => u.raidItemId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return <RaidDetail row={row} project={project} history={history} today={today} />;
}

export default function RaidRecordPage({ params }: PageProps<"/raid/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-[520px] rounded-xl" />}>
      <Content params={params} />
    </Suspense>
  );
}
