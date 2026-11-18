"use client";

import { useActionState } from "react";
import { AlertCircle, Info, Loader2 } from "lucide-react";
import { PRIORITIES, type MilestoneStatus } from "@/lib/types";
import { formatDate } from "@/lib/utils/dates";
import { humanize } from "@/lib/utils/format";
import type { MilestoneField, MilestoneFormState, MilestoneFormValues } from "@/lib/validation/milestone";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormField, fieldAria, inputClass } from "@/components/ui/form-field";
import { MilestoneStatusBadge } from "@/components/ui/badge";

type MilestoneAction = (state: MilestoneFormState, formData: FormData) => Promise<MilestoneFormState>;

export interface CurrentMilestoneStatus {
  status: MilestoneStatus;
  explanation: string;
  linkedTasks: number;
  openTasks: number;
}

export function MilestoneForm({
  action,
  initialValues,
  submitLabel,
  cancelHref,
  projects,
  owners,
  today,
  current,
}: {
  action: MilestoneAction;
  initialValues: MilestoneFormValues;
  submitLabel: string;
  cancelHref: string;
  projects: { id: string; name: string }[];
  owners: string[];
  today: string;
  /** Present when editing: the calculated status, shown read-only. */
  current?: CurrentMilestoneStatus;
}) {
  const [state, formAction, pending] = useActionState(action, { values: initialValues });
  const values = state.values ?? initialValues;
  const errors = state.fieldErrors ?? {};
  const v = (field: MilestoneField) => values[field] ?? "";

  const text = (field: MilestoneField, label: string, opts: { maxLength: number; placeholder?: string; list?: string }) => (
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
  const date = (field: MilestoneField, label: string, required: boolean, hint?: string, max?: string) => (
    <FormField id={field} label={label} required={required} hint={hint} errors={errors[field]}>
      <input
        type="date"
        {...fieldAria(field, errors[field], hint)}
        defaultValue={v(field)}
        required={required}
        max={max}
        className={inputClass(!!errors[field])}
      />
    </FormField>
  );
  const textarea = (field: MilestoneField, label: string, hint: string, max: number) => (
    <FormField id={field} label={label} hint={hint} errors={errors[field]}>
      <textarea {...fieldAria(field, errors[field], hint)} defaultValue={v(field)} rows={3} maxLength={max} className={inputClass(!!errors[field])} />
    </FormField>
  );

  const completionHint = current
    ? current.linkedTasks === 0
      ? "No tasks are linked, so it can be completed by recording the date."
      : current.openTasks > 0
        ? `Can be recorded once all ${current.linkedTasks} linked tasks are done (${current.openTasks} still open).`
        : "All linked tasks are done: record the date to complete the milestone. Clear it to reopen."
    : "Leave blank. Record it once every linked task is done.";

  return (
    <form action={formAction} className="space-y-6">
      {state.message && (
        <div role="alert" className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {state.message}
        </div>
      )}

      {current && (
        <div className="flex items-start gap-3 rounded-md border border-slate-200 bg-white px-4 py-3 text-sm">
          <Info className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden />
          <div className="space-y-1">
            <p className="flex flex-wrap items-center gap-2 text-slate-700">
              Calculated status: <MilestoneStatusBadge status={current.status} />
            </p>
            <p className="text-slate-500">
              {current.explanation} Status is not edited directly: it follows the linked tasks, the planned dates and the
              actual completion date.
            </p>
          </div>
        </div>
      )}

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-slate-900">Milestone</h2>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">{text("name", "Title", { maxLength: 160, placeholder: "e.g. Finance module SIT complete" })}</div>
          <FormField
            id="projectId"
            label="Project"
            required
            hint={current?.linkedTasks ? "Unlink or move its tasks before changing the project." : undefined}
            errors={errors.projectId}
          >
            <select {...fieldAria("projectId", errors.projectId)} defaultValue={v("projectId")} required className={inputClass(!!errors.projectId)}>
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
          {text("owner", "Owner", { maxLength: 80, list: "milestone-owner-options" })}
          <datalist id="milestone-owner-options">
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
          <div className="sm:col-span-2">{textarea("description", "Description", "What this milestone delivers (optional)", 2000)}</div>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-slate-900">Schedule and completion</h2>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          {date("plannedStartDate", "Planned start", true)}
          {date("plannedDate", "Planned completion", true)}
          <div className="sm:col-span-2">
            {date("actualDate", "Actual completion", false, completionHint, today)}
          </div>
        </div>
        <p className="mt-4 text-xs text-slate-500">
          Progress is calculated from linked tasks (completed ÷ total) and cannot be typed in. Today is {formatDate(today)}.
        </p>
      </Card>

      <Card className="p-5">
        {textarea("notes", "Notes", "Decisions, dependencies or context for this milestone (optional)", 4000)}
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
