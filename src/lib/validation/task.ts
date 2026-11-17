import { z } from "zod";
import { PRIORITIES, TASK_STATUSES, type Task, type TaskInput } from "@/lib/types";
import { dateOrderError, isoDate, optionalIsoDate, optionalText, requiredText } from "./common";

export const TASK_TEXT_FIELDS = [
  "title",
  "description",
  "projectId",
  "milestoneId",
  "owner",
  "priority",
  "status",
  "startDate",
  "dueDate",
  "completedDate",
] as const;

export type TaskTextField = (typeof TASK_TEXT_FIELDS)[number];
export type TaskField = TaskTextField | "dependsOn";
export type TaskFieldErrors = Partial<Record<TaskField | "form", string[]>>;

export type TaskFormValues = Partial<Record<TaskTextField, string>> & {
  dependsOn?: string[];
  overrideDependencies?: boolean;
};

export interface TaskFormState {
  message?: string;
  fieldErrors?: TaskFieldErrors;
  values?: TaskFormValues;
}

const DUE_ORDER_ERROR = "Due date cannot be before the start date";
const MAX_DEPENDENCIES = 50;

export const taskInputSchema = z
  .object({
    title: requiredText("Title", 2, 200),
    description: optionalText("Description", 4000),
    projectId: z.string({ error: "Choose a project" }).trim().min(1, "Choose a project").max(100),
    milestoneId: z.preprocess(
      (v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : null),
      z.string().max(100).nullable(),
    ),
    owner: requiredText("Owner", 2, 80),
    priority: z.enum(PRIORITIES, { error: "Choose a valid priority" }),
    status: z.enum(TASK_STATUSES, { error: "Choose a valid status" }),
    startDate: isoDate("Start date"),
    dueDate: isoDate("Due date"),
    completedDate: optionalIsoDate("Completion date"),
    dependsOn: z
      .array(z.string().trim().min(1).max(100))
      .max(MAX_DEPENDENCIES, `A task can have at most ${MAX_DEPENDENCIES} predecessors`),
  })
  .refine((t) => t.dueDate >= t.startDate, { path: ["dueDate"], error: DUE_ORDER_ERROR });

export function taskFormValues(formData: FormData): TaskFormValues {
  const values: TaskFormValues = {};
  for (const field of TASK_TEXT_FIELDS) {
    const v = formData.get(field);
    if (typeof v === "string") values[field] = v;
  }
  values.dependsOn = formData.getAll("dependsOn").filter((v): v is string => typeof v === "string");
  values.overrideDependencies = formData.get("overrideDependencies") === "on";
  return values;
}

export type TaskParseResult =
  | { success: true; data: TaskInput; overrideDependencies: boolean }
  | { success: false; fieldErrors: TaskFieldErrors; values: TaskFormValues };

export function parseTaskForm(formData: FormData): TaskParseResult {
  const values = taskFormValues(formData);
  const { overrideDependencies = false, ...raw } = values;
  const result = taskInputSchema.safeParse(raw);
  if (result.success) return { success: true, data: result.data, overrideDependencies };

  const fieldErrors = z.flattenError(result.error).fieldErrors as TaskFieldErrors;
  if (dateOrderError(values.startDate, values.dueDate) && !fieldErrors.dueDate) {
    fieldErrors.dueDate = [DUE_ORDER_ERROR];
  }
  return { success: false, fieldErrors, values };
}

export function taskToFormValues(task: Task): TaskFormValues {
  return {
    title: task.title,
    description: task.description,
    projectId: task.projectId,
    milestoneId: task.milestoneId ?? "",
    owner: task.owner,
    priority: task.priority,
    status: task.status,
    startDate: task.startDate,
    dueDate: task.dueDate,
    completedDate: task.completedDate ?? "",
    dependsOn: task.dependsOn,
    overrideDependencies: false,
  };
}
