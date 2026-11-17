import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/layout/module-placeholder";

export const metadata: Metadata = { title: "Milestones" };

export default function MilestonesPage() {
  return (
    <ModulePlaceholder
      title="Milestones"
      description="Track planned versus actual delivery dates."
      planned={["create / edit", "planned vs actual dates", "status tracking", "delayed milestone detection"]}
    />
  );
}
