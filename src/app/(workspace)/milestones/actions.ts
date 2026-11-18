"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getAppTimeZone, getRepository } from "@/lib/data";
import { MilestoneRuleError, type DeleteChoice } from "@/lib/milestones/rules";
import { createMilestone, deleteMilestone, setTasksMilestone, updateMilestone } from "@/lib/services/milestones";
import { todayISO } from "@/lib/utils/dates";
import { milestoneFormValues, parseMilestoneForm, type MilestoneFormState } from "@/lib/validation/milestone";

// TODO(auth): verify the session and project access at the top of each action.

const idSchema = z.string().trim().min(1).max(100);
const FIX_FIELDS = "Please fix the highlighted fields.";

function refreshAll() {
  revalidatePath("/", "layout");
}

function ruleFailure(error: MilestoneRuleError, formData: FormData): MilestoneFormState {
  return { message: error.fieldErrors.form?.[0] ?? FIX_FIELDS, fieldErrors: error.fieldErrors, values: milestoneFormValues(formData) };
}

export async function createMilestoneAction(_prev: MilestoneFormState, formData: FormData): Promise<MilestoneFormState> {
  const parsed = parseMilestoneForm(formData);
  if (!parsed.success) return { message: FIX_FIELDS, fieldErrors: parsed.fieldErrors, values: parsed.values };

  let id: string;
  try {
    id = (await createMilestone(await getRepository(), parsed.data, todayISO(getAppTimeZone()))).id;
  } catch (error) {
    if (error instanceof MilestoneRuleError) return ruleFailure(error, formData);
    console.error("createMilestoneAction failed", error);
    return { message: "The milestone could not be saved. Please try again.", values: milestoneFormValues(formData) };
  }
  refreshAll();
  redirect(`/milestones/${id}`);
}

export async function updateMilestoneAction(rawId: string, _prev: MilestoneFormState, formData: FormData): Promise<MilestoneFormState> {
  const id = idSchema.safeParse(rawId);
  if (!id.success) return { message: "Unknown milestone." };
  const parsed = parseMilestoneForm(formData);
  if (!parsed.success) return { message: FIX_FIELDS, fieldErrors: parsed.fieldErrors, values: parsed.values };

  try {
    const milestone = await updateMilestone(await getRepository(), id.data, parsed.data, todayISO(getAppTimeZone()));
    if (!milestone) return { message: "This milestone no longer exists." };
  } catch (error) {
    if (error instanceof MilestoneRuleError) return ruleFailure(error, formData);
    console.error("updateMilestoneAction failed", error);
    return { message: "The milestone could not be saved. Please try again.", values: milestoneFormValues(formData) };
  }
  refreshAll();
  redirect(`/milestones/${id.data}`);
}

export interface SimpleActionState {
  message?: string;
}

/** Bound with the milestone ID. Form fields: taskHandling (unlink | reassign), reassignTo. */
export async function deleteMilestoneAction(rawId: string, _prev: SimpleActionState, formData: FormData): Promise<SimpleActionState> {
  const id = idSchema.safeParse(rawId);
  if (!id.success) return { message: "Unknown milestone." };

  const handling = formData.get("taskHandling");
  const target = formData.get("reassignTo");
  const choice: DeleteChoice =
    handling === "unlink"
      ? { mode: "unlink" }
      : handling === "reassign" && typeof target === "string" && target
        ? { mode: "reassign", target }
        : handling === "reassign"
          ? { mode: "reassign", target: "" }
          : { mode: "none" };

  let projectId: string;
  try {
    const result = await deleteMilestone(await getRepository(), id.data, choice);
    if (!result) return { message: "This milestone no longer exists." };
    projectId = result.milestone.projectId;
  } catch (error) {
    if (error instanceof MilestoneRuleError) return { message: error.message };
    console.error("deleteMilestoneAction failed", error);
    return { message: "The milestone could not be deleted. Please try again." };
  }
  refreshAll();
  redirect(`/milestones?project=${encodeURIComponent(projectId)}`);
}

/** Bound with the milestone ID. Form field: taskIds (repeated). */
export async function linkTasksAction(rawId: string, _prev: SimpleActionState, formData: FormData): Promise<SimpleActionState> {
  const id = idSchema.safeParse(rawId);
  if (!id.success) return { message: "Unknown milestone." };
  const taskIds = formData.getAll("taskIds").filter((v): v is string => typeof v === "string" && v.length > 0 && v.length <= 100);
  if (taskIds.length === 0) return { message: "Select at least one task to link." };

  try {
    await setTasksMilestone(await getRepository(), taskIds, id.data);
  } catch (error) {
    if (error instanceof MilestoneRuleError) return { message: error.message };
    console.error("linkTasksAction failed", error);
    return { message: "The tasks could not be linked. Please try again." };
  }
  refreshAll();
  return {};
}

/** Bound with the task ID; unlinks it from its milestone. */
export async function unlinkTaskAction(rawTaskId: string): Promise<void> {
  const taskId = idSchema.parse(rawTaskId);
  await setTasksMilestone(await getRepository(), [taskId], null);
  refreshAll();
}
