import { z } from "zod";
import { HEALTH_VALUES, PROJECT_STATUSES, type ProjectInput } from "@/lib/types";
import { blankToUndefined, dateOrderError, isoDate, requiredText } from "./common";

export const PROJECT_FIELDS = [
  "name",
  "client",
  "description",
  "projectManager",
  "startDate",
  "targetEndDate",
  "budget",
  "actualSpend",
  "status",
  "health",
] as const satisfies readonly (keyof ProjectInput)[];

export type ProjectField = (typeof PROJECT_FIELDS)[number];
export type ProjectFieldErrors = Partial<Record<ProjectField, string[]>>;
export type ProjectFormValues = Partial<Record<ProjectField, string>>;

/** Returned by project server actions to drive the form UI. */
export interface ProjectFormState {
  message?: string;
  fieldErrors?: ProjectFieldErrors;
  /** Echo of what was submitted, so a failed submit does not wipe the form. */
  values?: ProjectFormValues;
}

const MAX_MONEY = 100_000_000_000;
const DATE_ORDER_ERROR = "Target end date cannot be before the start date";

const money = (label: string) =>
  z.preprocess(
    (v) => {
      const value = blankToUndefined(v);
      return typeof value === "string" ? Number(value.replace(/[,\s]/g, "")) : value;
    },
    z
      .number({
        error: (issue) => (issue.input === undefined ? `${label} is required` : `${label} must be a number`),
      })
      .min(0, `${label} cannot be negative`)
      .max(MAX_MONEY, `${label} is unrealistically large`),
  );

export const projectInputSchema = z
  .object({
    name: requiredText("Project name", 2, 120),
    client: requiredText("Client", 1, 120),
    description: z.preprocess(
      (v) => (typeof v === "string" ? v : ""),
      z.string().trim().max(2000, "Description must be 2,000 characters or fewer"),
    ),
    projectManager: requiredText("Project manager", 2, 80),
    startDate: isoDate("Start date"),
    targetEndDate: isoDate("Target end date"),
    budget: money("Budget"),
    actualSpend: money("Actual expenditure"),
    status: z.enum(PROJECT_STATUSES, { error: "Choose a valid status" }),
    health: z.enum(HEALTH_VALUES, { error: "Choose a valid health rating" }),
  })
  .refine((p) => p.targetEndDate >= p.startDate, {
    path: ["targetEndDate"],
    error: DATE_ORDER_ERROR,
  });

export type ParseResult =
  | { success: true; data: ProjectInput }
  | { success: false; fieldErrors: ProjectFieldErrors; values: ProjectFormValues };

export function formValues(formData: FormData): ProjectFormValues {
  const values: ProjectFormValues = {};
  for (const field of PROJECT_FIELDS) {
    const v = formData.get(field);
    if (typeof v === "string") values[field] = v;
  }
  return values;
}

export function parseProjectForm(formData: FormData): ParseResult {
  const values = formValues(formData);
  const result = projectInputSchema.safeParse(values);
  if (result.success) return { success: true, data: result.data };

  const fieldErrors = z.flattenError(result.error).fieldErrors as ProjectFieldErrors;
  if (dateOrderError(values.startDate, values.targetEndDate) && !fieldErrors.targetEndDate) {
    fieldErrors.targetEndDate = [DATE_ORDER_ERROR];
  }
  return { success: false, fieldErrors, values };
}

/** Converts a stored project into string form values for editing. */
export function projectToFormValues(project: ProjectInput): ProjectFormValues {
  return {
    name: project.name,
    client: project.client,
    description: project.description,
    projectManager: project.projectManager,
    startDate: project.startDate,
    targetEndDate: project.targetEndDate,
    budget: String(project.budget),
    actualSpend: String(project.actualSpend),
    status: project.status,
    health: project.health,
  };
}
