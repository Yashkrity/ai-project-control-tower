"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getAppTimeZone, getRepository } from "@/lib/data";
import { RaidRuleError } from "@/lib/raid/rules";
import { createRaidItem, deleteRaidItem, updateRaidItem } from "@/lib/services/raid";
import { todayISO } from "@/lib/utils/dates";
import { parseRaidForm, raidFormValues, type RaidFormState } from "@/lib/validation/raid";

// TODO(auth): verify the session and project access at the top of each action.

const idSchema = z.string().trim().min(1).max(100);
const FIX_FIELDS = "Please fix the highlighted fields.";

function refreshAll() {
  revalidatePath("/", "layout");
}

function ruleFailure(error: RaidRuleError, formData: FormData): RaidFormState {
  return { message: error.fieldErrors.form?.[0] ?? FIX_FIELDS, fieldErrors: error.fieldErrors, values: raidFormValues(formData) };
}

export async function createRaidAction(_prev: RaidFormState, formData: FormData): Promise<RaidFormState> {
  const parsed = parseRaidForm(formData);
  if (!parsed.success) return { message: FIX_FIELDS, fieldErrors: parsed.fieldErrors, values: parsed.values };

  let id: string;
  try {
    id = (await createRaidItem(await getRepository(), parsed.data, todayISO(getAppTimeZone()))).id;
  } catch (error) {
    if (error instanceof RaidRuleError) return ruleFailure(error, formData);
    console.error("createRaidAction failed", error);
    return { message: "The record could not be saved. Please try again.", values: raidFormValues(formData) };
  }
  refreshAll();
  redirect(`/raid/${id}`);
}

export async function updateRaidAction(rawId: string, _prev: RaidFormState, formData: FormData): Promise<RaidFormState> {
  const id = idSchema.safeParse(rawId);
  if (!id.success) return { message: "Unknown record." };
  const parsed = parseRaidForm(formData);
  if (!parsed.success) return { message: FIX_FIELDS, fieldErrors: parsed.fieldErrors, values: parsed.values };

  try {
    const item = await updateRaidItem(await getRepository(), id.data, parsed.data, todayISO(getAppTimeZone()));
    if (!item) return { message: "This record no longer exists." };
  } catch (error) {
    if (error instanceof RaidRuleError) return ruleFailure(error, formData);
    console.error("updateRaidAction failed", error);
    return { message: "The record could not be saved. Please try again.", values: raidFormValues(formData) };
  }
  refreshAll();
  redirect(`/raid/${id.data}`);
}

export interface DeleteRaidState {
  message?: string;
}

/** Bound with the record ID. */
export async function deleteRaidAction(rawId: string): Promise<DeleteRaidState> {
  const id = idSchema.safeParse(rawId);
  if (!id.success) return { message: "Unknown record." };
  let projectId: string;
  try {
    const item = await deleteRaidItem(await getRepository(), id.data);
    if (!item) return { message: "This record no longer exists." };
    projectId = item.projectId;
  } catch (error) {
    console.error("deleteRaidAction failed", error);
    return { message: "The record could not be deleted. Please try again." };
  }
  refreshAll();
  redirect(`/raid?project=${encodeURIComponent(projectId)}`);
}
