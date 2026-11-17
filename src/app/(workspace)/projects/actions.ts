"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getRepository } from "@/lib/data";
import { createProject, setProjectArchived, updateProject } from "@/lib/services/projects";
import { formValues, parseProjectForm, type ProjectFormState } from "@/lib/validation/project";

// TODO(auth): once authentication exists, verify the session and the user's
// access to the project at the top of every action below.

const idSchema = z.string().trim().min(1).max(100);

const SAVE_FAILED = "The project could not be saved. Please try again.";

function refreshAll() {
  // Dashboard, list and detail pages all derive from project data.
  revalidatePath("/", "layout");
}

export async function createProjectAction(_prev: ProjectFormState, formData: FormData): Promise<ProjectFormState> {
  const parsed = parseProjectForm(formData);
  if (!parsed.success) {
    return { message: "Please fix the highlighted fields.", fieldErrors: parsed.fieldErrors, values: parsed.values };
  }

  let id: string;
  try {
    const project = await createProject(await getRepository(), parsed.data);
    id = project.id;
  } catch (error) {
    console.error("createProjectAction failed", error);
    return { message: SAVE_FAILED, values: formValues(formData) };
  }

  refreshAll();
  redirect(`/projects/${id}`);
}

export async function updateProjectAction(
  rawId: string,
  _prev: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  const id = idSchema.safeParse(rawId);
  if (!id.success) return { message: "Unknown project." };

  const parsed = parseProjectForm(formData);
  if (!parsed.success) {
    return { message: "Please fix the highlighted fields.", fieldErrors: parsed.fieldErrors, values: parsed.values };
  }

  try {
    const project = await updateProject(await getRepository(), id.data, parsed.data);
    if (!project) return { message: "This project no longer exists." };
  } catch (error) {
    console.error("updateProjectAction failed", error);
    return { message: SAVE_FAILED, values: formValues(formData) };
  }

  refreshAll();
  redirect(`/projects/${id.data}`);
}

async function archive(rawId: string, archived: boolean): Promise<void> {
  const id = idSchema.parse(rawId);
  const project = await setProjectArchived(await getRepository(), id, archived);
  if (!project) throw new Error("This project no longer exists.");
  refreshAll();
  redirect(`/projects/${id}`);
}

export async function archiveProjectAction(rawId: string): Promise<void> {
  await archive(rawId, true);
}

export async function restoreProjectAction(rawId: string): Promise<void> {
  await archive(rawId, false);
}
