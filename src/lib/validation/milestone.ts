import { z } from "zod";
import { PRIORITIES, type Milestone, type MilestoneInput } from "@/lib/types";
import { dateOrderError, isoDate, optionalIsoDate, optionalText, requiredText } from "./common";

export const MILESTONE_FIELDS = [
  "name",
  "description",
  "projectId",
  "owner",
  "priority",
  "plannedStartDate",
  "plannedDate",
  "actualDate",
  "notes",
] as const;

export type MilestoneField = (typeof MILESTONE_FIELDS)[number];
export type MilestoneFieldErrors = Partial<Record<MilestoneField | "form", string[]>>;
export type MilestoneFormValues = Partial<Record<MilestoneField, string>>;

export interface MilestoneFormState {
  message?: string;
  fieldErrors?: MilestoneFieldErrors;
  values?: MilestoneFormValues;
}

const DATE_ORDER_ERROR = "Planned completion cannot be before the planned start";

export const milestoneInputSchema = z
  .object({
    name: requiredText("Title", 2, 160),
    description: optionalText("Description", 2000),
    projectId: z.string({ error: "Choose a project" }).trim().min(1, "Choose a project").max(100),
    owner: requiredText("Owner", 2, 80),
    priority: z.enum(PRIORITIES, { error: "Choose a valid priority" }),
    plannedStartDate: isoDate("Planned start"),
    plannedDate: isoDate("Planned completion"),
    actualDate: optionalIsoDate("Actual completion"),
    notes: optionalText("Notes", 4000),
  })
  .refine((m) => m.plannedDate >= m.plannedStartDate, { path: ["plannedDate"], error: DATE_ORDER_ERROR });

export function milestoneFormValues(formData: FormData): MilestoneFormValues {
  const values: MilestoneFormValues = {};
  for (const field of MILESTONE_FIELDS) {
    const v = formData.get(field);
    if (typeof v === "string") values[field] = v;
  }
  return values;
}

export type MilestoneParseResult =
  | { success: true; data: MilestoneInput }
  | { success: false; fieldErrors: MilestoneFieldErrors; values: MilestoneFormValues };

export function parseMilestoneForm(formData: FormData): MilestoneParseResult {
  const values = milestoneFormValues(formData);
  const result = milestoneInputSchema.safeParse(values);
  if (result.success) return { success: true, data: result.data };
  const fieldErrors = z.flattenError(result.error).fieldErrors as MilestoneFieldErrors;
  if (dateOrderError(values.plannedStartDate, values.plannedDate) && !fieldErrors.plannedDate) {
    fieldErrors.plannedDate = [DATE_ORDER_ERROR];
  }
  return { success: false, fieldErrors, values };
}

export function milestoneToFormValues(m: Milestone): MilestoneFormValues {
  return {
    name: m.name,
    description: m.description,
    projectId: m.projectId,
    owner: m.owner,
    priority: m.priority,
    plannedStartDate: m.plannedStartDate,
    plannedDate: m.plannedDate,
    actualDate: m.actualDate ?? "",
    notes: m.notes,
  };
}
