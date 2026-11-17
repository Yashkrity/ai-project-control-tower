import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { ProjectForm } from "@/components/projects/project-form";
import { createProjectAction } from "../actions";

export const metadata: Metadata = { title: "New project" };

export default function NewProjectPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="New project" description="Fields marked * are required." />
      <ProjectForm
        action={createProjectAction}
        initialValues={{ status: "planning", health: "green", actualSpend: "0" }}
        submitLabel="Create project"
        cancelHref="/projects"
      />
    </div>
  );
}
