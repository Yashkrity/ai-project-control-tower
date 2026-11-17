import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/layout/module-placeholder";

export const metadata: Metadata = { title: "Tasks" };

export default function TasksPage() {
  return (
    <ModulePlaceholder
      title="Tasks"
      description="Plan and track work across projects and milestones."
      planned={["create / edit / delete", "owners and priorities", "overdue tracking", "task dependencies"]}
    />
  );
}
