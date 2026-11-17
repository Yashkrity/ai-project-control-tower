"use client";

import { useActionState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { HEALTH_VALUES, PROJECT_STATUSES } from "@/lib/types";
import { humanize } from "@/lib/utils/format";
import type { ProjectField, ProjectFormState, ProjectFormValues } from "@/lib/validation/project";
import { Button, LinkButton } from "@/components/ui/button";
import { FormField, fieldAria, inputClass } from "@/components/ui/form-field";
import { Card } from "@/components/ui/card";

type ProjectAction = (state: ProjectFormState, formData: FormData) => Promise<ProjectFormState>;

export function ProjectForm({
  action,
  initialValues,
  submitLabel,
  cancelHref,
}: {
  action: ProjectAction;
  initialValues: ProjectFormValues;
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState(action, { values: initialValues });
  const values = state.values ?? initialValues;
  const errors = state.fieldErrors ?? {};
  const v = (field: ProjectField) => values[field] ?? "";

  const text = (field: ProjectField, label: string, opts: { required?: boolean; hint?: string; maxLength?: number; placeholder?: string } = {}) => (
    <FormField id={field} label={label} required={opts.required} hint={opts.hint} errors={errors[field]}>
      <input
        type="text"
        {...fieldAria(field, errors[field], opts.hint)}
        defaultValue={v(field)}
        required={opts.required}
        maxLength={opts.maxLength}
        placeholder={opts.placeholder}
        className={inputClass(!!errors[field])}
      />
    </FormField>
  );

  const date = (field: ProjectField, label: string) => (
    <FormField id={field} label={label} required errors={errors[field]}>
      <input type="date" {...fieldAria(field, errors[field])} defaultValue={v(field)} required className={inputClass(!!errors[field])} />
    </FormField>
  );

  const money = (field: ProjectField, label: string, hint: string) => (
    <FormField id={field} label={label} required hint={hint} errors={errors[field]}>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-slate-500">$</span>
        <input
          type="number"
          inputMode="decimal"
          min={0}
          step="any"
          {...fieldAria(field, errors[field], hint)}
          defaultValue={v(field)}
          required
          className={`${inputClass(!!errors[field])} pl-7`}
        />
      </div>
    </FormField>
  );

  const select = (field: ProjectField, label: string, options: readonly string[]) => (
    <FormField id={field} label={label} required errors={errors[field]}>
      <select {...fieldAria(field, errors[field])} defaultValue={v(field)} required className={inputClass(!!errors[field])}>
        {options.map((o) => (
          <option key={o} value={o}>
            {humanize(o)}
          </option>
        ))}
      </select>
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
        <h2 className="text-sm font-semibold text-slate-900">Overview</h2>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          {text("name", "Project name", { required: true, maxLength: 120, placeholder: "e.g. ERP Cloud Migration" })}
          {text("client", "Client", { required: true, maxLength: 120 })}
          {text("projectManager", "Project manager", { required: true, maxLength: 80 })}
          <div className="sm:col-span-2">
            <FormField id="description" label="Description" hint="Scope and objectives (optional, up to 2,000 characters)" errors={errors.description}>
              <textarea
                {...fieldAria("description", errors.description, "Scope and objectives (optional, up to 2,000 characters)")}
                defaultValue={v("description")}
                rows={3}
                maxLength={2000}
                className={inputClass(!!errors.description)}
              />
            </FormField>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-slate-900">Schedule, budget and status</h2>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          {date("startDate", "Start date")}
          {date("targetEndDate", "Target end date")}
          {money("budget", "Budget", "Approved budget in USD")}
          {money("actualSpend", "Actual expenditure", "Spend to date in USD")}
          {select("status", "Status", PROJECT_STATUSES)}
          {select("health", "Health (RAG)", HEALTH_VALUES)}
        </div>
        <p className="mt-4 text-xs text-slate-500">
          Progress is not entered here: it is calculated from the project&apos;s tasks.
        </p>
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
