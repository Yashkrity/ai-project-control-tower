import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/layout/module-placeholder";

export const metadata: Metadata = { title: "Projects" };

export default function ProjectsPage() {
  return (
    <ModulePlaceholder
      title="Projects"
      description="Create, edit and archive projects across the portfolio."
      planned={["create / edit / archive", "budget vs actuals", "status and health", "project detail view"]}
    />
  );
}
