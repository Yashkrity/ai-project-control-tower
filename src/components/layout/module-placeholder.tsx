import Link from "next/link";
import { Construction } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/layout/page-header";

/** Shown for modules whose screens are scheduled for a later phase. */
export function ModulePlaceholder({
  title,
  description,
  planned,
}: {
  title: string;
  description: string;
  planned: string[];
}) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />
      <Card>
        <EmptyState
          icon={Construction}
          title={`${title} module is not built yet`}
          description={
            <>
              Planned capabilities: {planned.join(", ")}. The underlying demo data already feeds the
              portfolio dashboard.
            </>
          }
          action={
            <Link
              href="/"
              className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500"
            >
              Back to dashboard
            </Link>
          }
        />
      </Card>
    </div>
  );
}
