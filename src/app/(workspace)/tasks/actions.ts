"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getAppTimeZone, getRepository } from "@/lib/data";
import { TaskRuleError } from "@/lib/tasks/rules";
import { createTask, deleteTask, updateTask } from "@/lib/services/tasks";
import { todayISO } from "@/lib/utils/dates";
import { parseTaskForm, taskFormValues, type TaskFormState } from "@/lib/validation/task";

// TODO(auth): verify the session and project access at the top of each action.

const idSchema = z.string().trim().min(1).max(100);
const FIX_FIELDS = "Please fix the highlighted fields.";
const SAVE_FAILED = "The task could not be saved. Please try again.";

function refreshAll() {
  revalidatePath("/", "layout");
}

function ruleFailure(error: TaskRuleError, formData: FormData): TaskFormState {
  return {
    message: error.fieldErrors.form?.[0] ?? FIX_FIELDS,
    fieldErrors: error.fieldErrors,
    values: taskFormValues(formData),
  };
}

export async function createTaskAction(_prev: TaskFormState, formData: FormData): Promise<TaskFormState> {
  const parsed = parseTaskForm(formData);
  if (!parsed.success) return { message: FIX_FIELDS, fieldErrors: parsed.fieldErrors, values: parsed.values };

  let id: string;
  try {
    const task = await createTask(await getRepository(), parsed.data, {
      today: todayISO(getAppTimeZone()),
      overrideDependencies: parsed.overrideDependencies,
    });
    id = task.id;
  } catch (error) {
    if (error instanceof TaskRuleError) return ruleFailure(error, formData);
    console.error("createTaskAction failed", error);
    return { message: SAVE_FAILED, values: taskFormValues(formData) };
  }

  refreshAll();
  redirect(`/tasks/${id}`);
}

export async function updateTaskAction(rawId: string, _prev: TaskFormState, formData: FormData): Promise<TaskFormState> {
  const id = idSchema.safeParse(rawId);
  if (!id.success) return { message: "Unknown task." };

  const parsed = parseTaskForm(formData);
  if (!parsed.success) return { message: FIX_FIELDS, fieldErrors: parsed.fieldErrors, values: parsed.values };

  try {
    const task = await updateTask(await getRepository(), id.data, parsed.data, {
      today: todayISO(getAppTimeZone()),
      overrideDependencies: parsed.overrideDependencies,
    });
    if (!task) return { message: "This task no longer exists." };
  } catch (error) {
    if (error instanceof TaskRuleError) return ruleFailure(error, formData);
    console.error("updateTaskAction failed", error);
    return { message: SAVE_FAILED, values: taskFormValues(formData) };
  }

  refreshAll();
  redirect(`/tasks/${id.data}`);
}

export interface DeleteTaskState {
  message?: string;
}

/** Bound with the task ID; useActionState's (state, formData) arguments are not needed. */
export async function deleteTaskAction(rawId: string): Promise<DeleteTaskState> {
  const id = idSchema.safeParse(rawId);
  if (!id.success) return { message: "Unknown task." };

  let projectId: string;
  try {
    const task = await deleteTask(await getRepository(), id.data);
    if (!task) return { message: "This task no longer exists." };
    projectId = task.projectId;
  } catch (error) {
    if (error instanceof TaskRuleError) return { message: error.message };
    console.error("deleteTaskAction failed", error);
    return { message: "The task could not be deleted. Please try again." };
  }

  refreshAll();
  redirect(`/tasks?project=${encodeURIComponent(projectId)}`);
}
