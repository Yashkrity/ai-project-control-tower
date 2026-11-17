import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/layout/module-placeholder";

export const metadata: Metadata = { title: "RAID log" };

export default function RaidPage() {
  return (
    <ModulePlaceholder
      title="RAID log"
      description="Risks, assumptions, issues and dependencies across the portfolio."
      planned={["severity / probability / impact", "mitigation plans", "owners and target dates", "status workflow"]}
    />
  );
}
