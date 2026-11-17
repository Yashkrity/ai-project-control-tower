"use client";

import { useActionState, useMemo, useState } from "react";
import { AlertCircle, AlertTriangle, Loader2 } from "lucide-react";
import { PRIORITIES, TASK_STATUSES, type Task, type TaskStatus } from "@/lib/types";
import { dependentsClosure } from "@/lib/tasks/rules";
import { formatDate } from "@/lib/utils/dates";
import { cn, humanize } from "@/lib/utils/format";
import type { TaskFormState, TaskFormValues, TaskTextField } from "@/lib/validation/task";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormField, fieldAria, inputClass } from "@/components/ui/form-field";
import { TaskStatusBadge } from "@/components/ui/badge";

type TaskAction = (state: TaskFormState, formData: FormData) => Promise<TaskFormState>;
export type TaskOption = Pick<Task, "id" | "projectId" | "title" | "status" | "dependsOn">;

export function TaskForm({
  action,
  initialValues,
  submitLabel,
  cancelHref,
  projects,
  milestones,
  tasks,
  owners,
  currentTaskId,
  today,
}: {
  action: TaskAction;
  initialValues: TaskFormValues;
  submitLabel: string;
  cancelHref: string;
  projects: { id: string; name: string }[];
  milestones: { id: string; projectId: string; name: string }[];
  tasks: TaskOption[];
  owners: string[];
  currentTaskId?: string;
  today: string;
}) {
  const [state, formAction, pending] = useActionState(action, { values: initialValues });
  const values = state.values ?? initialValues;
  const errors = state.fieldErrors ?? {};
  const v = (field: TaskTextField) => values[field] ?? "";

  // Controlled fields: they drive what else the form shows.
  const [projectId, setProjectId] = useState(initialValues.projectId ?? "");
  const [milestoneId, setMilestoneId] = useState(initialValues.milestoneId ?? "");
  const [status, setStatus] = useState<TaskStatus>((initialValues.status as TaskStatus) ?? "not_started");
  const [dependsOn, setDependsOn] = useState<string[]>(initialValues.dependsOn ?? []);
  const [override, setOverride] = useState(false);

  const projectMilestones = milestones.filter((m) => m.projectId === projectId);
  const candidates = tasks.filter((t) => t.projectId === projectId && t.id !== currentTaskId);
  const wouldCycle = useMemo(
    () => (currentTaskId ? dependentsClosure(currentTaskId, tasks) : new Set<string>()),
    [currentTaskId, tasks],
  );
  const openPredecessors = candidates.filter((t) => dependsOn.includes(t.id) && t.status !== "done");
  const wasDone = initialValues.status === "done";

  function changeProject(next: string) {
    setProjectId(next);
    if (!milestones.some((m) => m.id === milestoneId && m.projectId === next)) setMilestoneId("");
    setDependsOn((ids) => ids.filter((id) => tasks.some((t) => t.id === id && t.projectId === next)));
  }

  function toggleDependency(id: string, checked: boolean) {
    setDependsOn((ids) => (checked ? [...ids, id] : ids.filter((x) => x !== id)));
  }

  const textInput = (field: TaskTextField, label: string, opts: { maxLength?: number; placeholder?: string; list?: string } = {}) => (
    <FormField id={field} label={label} required errors={errors[field]}>
      <input
        type="text"
        {...fieldAria(field, errors[field])}
        defaultValue={v(field)}
        required
        maxLength={opts.maxLength}
        placeholder={opts.placeholder}
        list={opts.list}
        className={inputClass(!!errors[field])}
      />
    </FormField>
  );

  const dateInput = (field: TaskTextField, label: string) => (
    <FormField id={field} label={label} required errors={errors[field]}>
      <input type="date" {...fieldAria(field, errors[field])} defaultValue={v(field)} required className={inputClass(!!errors[field])} />
    </FormField>
  );

  return (
    <form action={formAction} className="space-y-6">
      {state.message && (
        <div role="alert" className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {state.message}
        </div>
      )}

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-slate-900">Task</h2>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">{textInput("title", "Title", { maxLength: 200, placeholder: "e.g. Configure GL and cost centres" })}</div>

          <FormField id="projectId" label="Project" required errors={errors.projectId}>
            <select
              {...fieldAria("projectId", errors.projectId)}
              value={projectId}
              onChange={(e) => changeProject(e.target.value)}
              required
              className={inputClass(!!errors.projectId)}
            >
              <option value="" disabled>
                Choose a project…
              </option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </FormField>

          <FormField id="milestoneId" label="Milestone" hint={projectId ? undefined : "Choose a project first"} errors={errors.milestoneId}>
            <select
              {...fieldAria("milestoneId", errors.milestoneId)}
              value={milestoneId}
              onChange={(e) => setMilestoneId(e.target.value)}
              disabled={!projectId}
              className={inputClass(!!errors.milestoneId)}
            >
              <option value="">No milestone</option>
              {projectMilestones.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </FormField>

          {textInput("owner", "Owner", { maxLength: 80, list: "owner-options" })}
          <datalist id="owner-options">
            {owners.map((o) => (
              <option key={o} value={o} />
            ))}
          </datalist>

          <FormField id="priority" label="Priority" required errors={errors.priority}>
            <select {...fieldAria("priority", errors.priority)} defaultValue={v("priority") || "medium"} required className={inputClass(!!errors.priority)}>
              {[...PRIORITIES].reverse().map((p) => (
                <option key={p} value={p}>
                  {humanize(p)}
                </option>
              ))}
            </select>
          </FormField>

          <div className="sm:col-span-2">
            <FormField id="description" label="Description" hint="Optional, up to 4,000 characters" errors={errors.description}>
              <textarea
                {...fieldAria("description", errors.description, "Optional, up to 4,000 characters")}
                defaultValue={v("description")}
                rows={3}
                maxLength={4000}
                className={inputClass(!!errors.description)}
              />
            </FormField>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-slate-900">Schedule and status</h2>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          {dateInput("startDate", "Start date")}
          {dateInput("dueDate", "Due date")}
          <FormField id="status" label="Status" required errors={errors.status}>
            <select
              {...fieldAria("status", errors.status)}
              value={status}
              onChange={(e) => setStatus(e.target.value as TaskStatus)}
              required
              className={inputClass(!!errors.status)}
            >
              {TASK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {humanize(s)}
                </option>
              ))}
            </select>
          </FormField>
          {status === "done" ? (
            <FormField
              id="completedDate"
              label="Actual completion date"
              hint={wasDone ? "Leave as is to keep the recorded date" : `Leave blank to record today (${formatDate(today)})`}
              errors={errors.completedDate}
            >
              <input
                type="date"
                {...fieldAria("completedDate", errors.completedDate, "completion")}
                defaultValue={v("completedDate")}
                max={today}
                className={inputClass(!!errors.completedDate)}
              />
            </FormField>
          ) : (
            wasDone && (
              <p className="self-end text-xs text-amber-700">
                Reopening clears the recorded completion date. The previous date stays in the project&apos;s activity log.
              </p>
            )
          )}
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-slate-900">Dependencies</h2>
        <p className="mt-1 text-xs text-slate-500">
          Predecessors must be done before this task can be marked done. Only tasks in the same project can be selected.
        </p>
        {errors.dependsOn && (
          <p id="dependsOn-error" className="mt-2 text-xs font-medium text-red-600">
            {errors.dependsOn[0]}
          </p>
        )}
        {!projectId ? (
          <p className="mt-4 text-sm text-slate-500">Choose a project to see its tasks.</p>
        ) : candidates.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">This project has no other tasks yet.</p>
        ) : (
          <fieldset className="mt-4" aria-describedby={errors.dependsOn ? "dependsOn-error" : undefined}>
            <legend className="sr-only">Predecessor tasks</legend>
            <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-md border border-slate-200">
              {candidates.map((t) => {
                const cyclic = wouldCycle.has(t.id);
                const checked = dependsOn.includes(t.id);
                return (
                  <li key={t.id}>
                    <label className={cn("flex items-center gap-3 px-3 py-2 text-sm", cyclic ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-slate-50")}>
                      <input
                        type="checkbox"
                        name="dependsOn"
                        value={t.id}
                        checked={checked}
                        disabled={cyclic && !checked}
                        onChange={(e) => toggleDependency(t.id, e.target.checked)}
                        className="size-4 rounded border-slate-300 accent-indigo-600"
                      />
                      <span className="min-w-0 flex-1 truncate text-slate-800">{t.title}</span>
                      {cyclic && <span className="text-xs text-slate-500">depends on this task</span>}
                      <TaskStatusBadge status={t.status} />
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        )}

        {status === "done" && openPredecessors.length > 0 && !wasDone && (
          <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="flex items-center gap-2 font-medium">
              <AlertTriangle className="size-4" aria-hidden />
              {openPredecessors.length === 1 ? "A predecessor is" : `${openPredecessors.length} predecessors are`} not done
            </p>
            <ul className="mt-1 list-disc pl-6 text-amber-800">
              {openPredecessors.map((p) => (
                <li key={p.id}>
                  {p.title} ({humanize(p.status)})
                </li>
              ))}
            </ul>
            <label className="mt-3 flex items-start gap-2">
              <input
                type="checkbox"
                name="overrideDependencies"
                checked={override}
                onChange={(e) => setOverride(e.target.checked)}
                className="mt-0.5 size-4 accent-amber-600"
              />
              <span>
                <span className="font-medium">Complete anyway.</span> The override is recorded in the project&apos;s activity log.
              </span>
            </label>
          </div>
        )}
      </Card>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <LinkButton href={cancelHref} variant="secondary">
          Cancel
        </LinkButton>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {pending ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
