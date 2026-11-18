import { z } from "zod";
import {
  ASSUMPTION_STATUSES,
  DEPENDENCY_DIRECTIONS,
  DEPENDENCY_STATUSES,
  ISSUE_STATUSES,
  PRIORITIES,
  RAID_TYPES,
  RISK_STATUSES,
  type RaidInput,
  type RaidItem,
} from "@/lib/types";
import { isoDate, optionalIsoDate, optionalText, requiredText } from "./common";

/** Every field name the RAID form can submit (all types). */
export const RAID_FIELDS = [
  "type",
  "projectId",
  "title",
  "description",
  "owner",
  "status",
  "targetDate",
  "resolvedDate",
  "milestoneId",
  "taskId",
  "plan",
  "latestUpdate",
  "probability",
  "impact",
  "contingency",
  "priority",
  "validationNotes",
  "businessImpact",
  "escalationReason",
  "escalatedDate",
  "direction",
  "requiredFrom",
  "impactIfUnfulfilled",
  "escalationOwner",
] as const;

export type RaidField = (typeof RAID_FIELDS)[number];
export type RaidFieldErrors = Partial<Record<RaidField | "form", string[]>>;
export type RaidFormValues = Partial<Record<RaidField, string>>;

export interface RaidFormState {
  message?: string;
  fieldErrors?: RaidFieldErrors;
  values?: RaidFormValues;
}

const optionalId = z.preprocess((v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : null), z.string().max(100).nullable());
const rating = (label: string) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() !== "" ? Number(v) : undefined),
    z
      .number({ error: (i) => (i.input === undefined ? `${label} is required` : `${label} must be a number from 1 to 5`) })
      .int(`${label} must be a whole number from 1 to 5`)
      .min(1, `${label} must be from 1 to 5`)
      .max(5, `${label} must be from 1 to 5`),
  );
const priority = z.enum(PRIORITIES, { error: "Choose a valid priority" });
const statusOf = <T extends readonly [string, ...string[]]>(values: T) => z.enum(values, { error: "Choose a valid status" });

const common = {
  projectId: z.string({ error: "Choose a project" }).trim().min(1, "Choose a project").max(100),
  title: requiredText("Title", 3, 160),
  description: optionalText("Description", 4000),
  owner: requiredText("Owner", 2, 80),
  resolvedDate: optionalIsoDate("Resolution date"),
  milestoneId: optionalId,
  taskId: optionalId,
  plan: optionalText("Plan", 4000),
  latestUpdate: optionalText("Latest update", 2000),
};

export const raidInputSchema = z.discriminatedUnion(
  "type",
  [
    z.object({
      type: z.literal("risk"),
      ...common,
      status: statusOf(RISK_STATUSES),
      targetDate: isoDate("Review date"),
      probability: rating("Probability"),
      impact: rating("Impact"),
      contingency: optionalText("Contingency plan", 4000),
    }),
    z.object({
      type: z.literal("assumption"),
      ...common,
      description: requiredText("Assumption statement", 5, 4000),
      status: statusOf(ASSUMPTION_STATUSES),
      targetDate: isoDate("Validation deadline"),
      priority,
      validationNotes: optionalText("Evidence / validation notes", 4000),
    }),
    z.object({
      type: z.literal("issue"),
      ...common,
      status: statusOf(ISSUE_STATUSES),
      targetDate: isoDate("Target resolution date"),
      priority: z.enum(PRIORITIES, { error: "Choose a valid severity" }),
      businessImpact: optionalText("Business impact", 2000),
      escalationReason: optionalText("Escalation reason", 2000),
      escalatedDate: optionalIsoDate("Escalation date"),
    }),
    z.object({
      type: z.literal("dependency"),
      ...common,
      status: statusOf(DEPENDENCY_STATUSES),
      targetDate: isoDate("Required-by date"),
      priority,
      direction: z.enum(DEPENDENCY_DIRECTIONS, { error: "Choose internal or external" }),
      requiredFrom: requiredText("Required from", 2, 120),
      impactIfUnfulfilled: optionalText("Impact if not fulfilled", 2000),
      escalationOwner: optionalText("Escalation owner", 80),
    }),
  ],
  { error: `Choose a type: ${RAID_TYPES.join(", ")}` },
);

export function raidFormValues(formData: FormData): RaidFormValues {
  const values: RaidFormValues = {};
  for (const field of RAID_FIELDS) {
    const v = formData.get(field);
    if (typeof v === "string") values[field] = v;
  }
  return values;
}

export type RaidParseResult =
  | { success: true; data: RaidInput }
  | { success: false; fieldErrors: RaidFieldErrors; values: RaidFormValues };

export function parseRaidForm(formData: FormData): RaidParseResult {
  const values = raidFormValues(formData);
  const result = raidInputSchema.safeParse(values);
  if (result.success) return { success: true, data: result.data as RaidInput };
  const flat = z.flattenError(result.error);
  const fieldErrors = flat.fieldErrors as RaidFieldErrors;
  if (flat.formErrors.length) fieldErrors.type = flat.formErrors;
  return { success: false, fieldErrors, values };
}

export function raidToFormValues(item: RaidItem): RaidFormValues {
  const v: RaidFormValues = {
    type: item.type,
    projectId: item.projectId,
    title: item.title,
    description: item.description,
    owner: item.owner,
    status: item.status,
    targetDate: item.targetDate ?? "",
    resolvedDate: item.resolvedDate ?? "",
    milestoneId: item.milestoneId ?? "",
    taskId: item.taskId ?? "",
    plan: item.plan,
    latestUpdate: item.latestUpdate,
  };
  switch (item.type) {
    case "risk":
      return { ...v, probability: String(item.probability), impact: String(item.impact), contingency: item.contingency };
    case "assumption":
      return { ...v, priority: item.priority, validationNotes: item.validationNotes };
    case "issue":
      return { ...v, priority: item.priority, businessImpact: item.businessImpact, escalationReason: item.escalationReason, escalatedDate: item.escalatedDate ?? "" };
    case "dependency":
      return { ...v, priority: item.priority, direction: item.direction, requiredFrom: item.requiredFrom, impactIfUnfulfilled: item.impactIfUnfulfilled, escalationOwner: item.escalationOwner };
  }
}
