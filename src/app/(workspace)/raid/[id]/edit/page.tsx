import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRepository, getToday } from "@/lib/data";
import { raidFormOptions } from "@/lib/raid/form-data";
import { RAID_TYPE_LABEL } from "@/lib/raid/rules";
import { raidToFormValues } from "@/lib/validation/raid";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { RaidForm } from "@/components/raid/raid-form";
import { updateRaidAction } from "../../actions";

export const metadata: Metadata = { title: "Edit RAID record" };

async function EditForm({ params }: { params: PageProps<"/raid/[id]/edit">["params"] }) {
  const { id } = await params;
  const today = await getToday();
  const data = await (await getRepository()).getPortfolio();
  const item = data.raidItems.find((r) => r.id === id);
  if (!item) notFound();

  return (
    <div className="space-y-6">
      <PageHeader title={`Edit ${item.ref}: ${item.title}`} description={`${RAID_TYPE_LABEL[item.type]} · changes are recorded in the record's activity history.`} />
      <RaidForm
        key={item.updatedAt}
        action={updateRaidAction.bind(null, item.id)}
        initialValues={raidToFormValues(item)}
        submitLabel="Save changes"
        cancelHref={`/raid/${item.id}`}
        today={today}
        editing={{ type: item.type, status: item.status }}
        {...raidFormOptions(data)}
      />
    </div>
  );
}

export default function EditRaidPage({ params }: PageProps<"/raid/[id]/edit">) {
  return (
    <div className="mx-auto max-w-3xl">
      <Suspense fallback={<Skeleton className="h-[720px] rounded-xl" />}>
        <EditForm params={params} />
      </Suspense>
    </div>
  );
}
