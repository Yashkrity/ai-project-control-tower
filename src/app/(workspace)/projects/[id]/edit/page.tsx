import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRepository } from "@/lib/data";
import { projectToFormValues } from "@/lib/validation/project";
import { PageHeader } from "@/components/layout/page-header";
import { ProjectForm } from "@/components/projects/project-form";
import { Skeleton } from "@/components/ui/skeleton";
import { updateProjectAction } from "../../actions";

export const metadata: Metadata = { title: "Edit project" };

async function EditForm({ params }: { params: PageProps<"/projects/[id]/edit">["params"] }) {
  const { id } = await params;
  const project = await (await getRepository()).getProject(id);
  if (!project) notFound();

  return (
    <div className="space-y-6">
      <PageHeader title={`Edit ${project.name}`} description="Changes to status, health, target date and budget are logged to the activity feed." />
      <ProjectForm
        key={project.updatedAt}
        action={updateProjectAction.bind(null, project.id)}
        initialValues={projectToFormValues(project)}
        submitLabel="Save changes"
        cancelHref={`/projects/${project.id}`}
      />
    </div>
  );
}

export default function EditProjectPage({ params }: PageProps<"/projects/[id]/edit">) {
  return (
    <div className="mx-auto max-w-3xl">
      <Suspense fallback={<Skeleton className="h-[560px] rounded-xl" />}>
        <EditForm params={params} />
      </Suspense>
    </div>
  );
}
