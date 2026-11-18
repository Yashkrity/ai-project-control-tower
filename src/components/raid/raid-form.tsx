"use client";

import { useActionState, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import {
  DEPENDENCY_DIRECTIONS,
  PRIORITIES,
  RAID_STATUSES_BY_TYPE,
  RAID_TYPES,
  type RaidStatus,
  type RaidType,
  type RiskRating,
} from "@/lib/types";
import {
  isClosedStatus,
  OWNER_LABEL,
  PLAN_LABEL,
  RAID_TYPE_LABEL,
  riskLevel,
  STATUS_TRANSITIONS,
  TARGET_DATE_LABEL,
} from "@/lib/raid/rules";
import { formatDate } from "@/lib/utils/dates";
import { cn, humanize } from "@/lib/utils/format";
import type { RaidField, RaidFormState, RaidFormValues } from "@/lib/validation/raid";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormField, fieldAria, inputClass } from "@/components/ui/form-field";
import { SeverityBadge } from "./raid-badges";

type RaidAction = (state: RaidFormState, formData: FormData) => Promise<RaidFormState>;

const RATING_LABELS: Record<"probability" | "impact", string[]> = {
  probability: ["1 · Rare", "2 · Unlikely", "3 · Possible", "4 · Likely", "5 · Almost certain"],
  impact: ["1 · Negligible", "2 · Minor", "3 · Moderate", "4 · Major", "5 · Severe"],
};

export function RaidForm({
  action,
  initialValues,
  submitLabel,
  cancelHref,
  projects,
  milestones,
  tasks,
  owners,
  today,
  editing,
}: {
  action: RaidAction;
  initialValues: RaidFormValues;
  submitLabel: string;
  cancelHref: string;
  projects: { id: string; name: string }[];
  milestones: { id: string; projectId: string; name: string }[];
  tasks: { id: string; projectId: string; title: string }[];
  owners: string[];
  today: string;
  /** When editing: type is locked and status options follow the allowed transitions. */
  editing?: { type: RaidType; status: RaidStatus };
}) {
  const [state, formAction, pending] = useActionState(action, { values: initialValues });
  const values = state.values ?? initialValues;
  const errors = state.fieldErrors ?? {};
  const v = (f: RaidField) => values[f] ?? "";

  const [type, setType] = useState<RaidType>((initialValues.type as RaidType) ?? "risk");
  const [status, setStatus] = useState<string>(initialValues.status ?? RAID_STATUSES_BY_TYPE[type][0]);
  const [projectId, setProjectId] = useState(initialValues.projectId ?? "");
  const [milestoneId, setMilestoneId] = useState(initialValues.milestoneId ?? "");
  const [taskId, setTaskId] = useState(initialValues.taskId ?? "");
  const [probability, setProbability] = useState(Number(initialValues.probability) || 3);
  const [impact, setImpact] = useState(Number(initialValues.impact) || 3);

  const statusOptions: readonly string[] = editing
    ? [editing.status, ...(STATUS_TRANSITIONS[editing.type][editing.status] ?? [])]
    : RAID_STATUSES_BY_TYPE[type];
  const closed = isClosedStatus(type, status as RaidStatus);
  const score = (probability as RiskRating) * (impact as RiskRating);

  function changeType(next: RaidType) {
    setType(next);
    setStatus(RAID_STATUSES_BY_TYPE[next][0]);
  }
  function changeProject(next: string) {
    setProjectId(next);
    if (!milestones.some((m) => m.id === milestoneId && m.projectId === next)) setMilestoneId("");
    if (!tasks.some((t) => t.id === taskId && t.projectId === next)) setTaskId("");
  }

  const text = (f: RaidField, label: string, opts: { required?: boolean; maxLength: number; placeholder?: string; list?: string; hint?: string }) => (
    <FormField id={f} label={label} required={opts.required} hint={opts.hint} errors={errors[f]}>
      <input
        type="text"
        {...fieldAria(f, errors[f], opts.hint)}
        defaultValue={v(f)}
        required={opts.required}
        maxLength={opts.maxLength}
        placeholder={opts.placeholder}
        list={opts.list}
        className={inputClass(!!errors[f])}
      />
    </FormField>
  );
  const area = (f: RaidField, label: string, opts: { required?: boolean; hint?: string; max?: number; rows?: number } = {}) => (
    <FormField id={f} label={label} required={opts.required} hint={opts.hint} errors={errors[f]}>
      <textarea
        {...fieldAria(f, errors[f], opts.hint)}
        defaultValue={v(f)}
        rows={opts.rows ?? 3}
        maxLength={opts.max ?? 4000}
        required={opts.required}
        className={inputClass(!!errors[f])}
      />
    </FormField>
  );
  const date = (f: RaidField, label: string, opts: { required?: boolean; hint?: string; max?: string } = {}) => (
    <FormField id={f} label={label} required={opts.required} hint={opts.hint} errors={errors[f]}>
      <input
        type="date"
        {...fieldAria(f, errors[f], opts.hint)}
        defaultValue={v(f)}
        required={opts.required}
        max={opts.max}
        className={inputClass(!!errors[f])}
      />
    </FormField>
  );
  const prioritySelect = (label: string) => (
    <FormField id="priority" label={label} required errors={errors.priority}>
      <select {...fieldAria("priority", errors.priority)} defaultValue={v("priority") || "medium"} className={inputClass(!!errors.priority)}>
        {[...PRIORITIES].reverse().map((p) => (
          <option key={p} value={p}>
            {humanize(p)}
          </option>
        ))}
      </select>
    </FormField>
  );
  const ratingSelect = (f: "probability" | "impact", value: number, set: (n: number) => void) => (
    <FormField id={f} label={humanize(f)} required errors={errors[f]}>
      <select {...fieldAria(f, errors[f])} value={value} onChange={(e) => set(Number(e.target.value))} className={inputClass(!!errors[f])}>
        {RATING_LABELS[f].map((l, i) => (
          <option key={l} value={i + 1}>
            {l}
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

      {/* Type */}
      {editing ? (
        <input type="hidden" name="type" value={type} />
      ) : (
        <fieldset>
          <legend className="text-sm font-medium text-slate-700">Type</legend>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {RAID_TYPES.map((t) => (
              <label
                key={t}
                className={cn(
                  "flex cursor-pointer items-center justify-center rounded-md border px-3 py-2 text-sm font-medium",
                  type === t ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
                )}
              >
                <input type="radio" name="type" value={t} checked={type === t} onChange={() => changeType(t)} className="sr-only" />
                {RAID_TYPE_LABEL[t]}
              </label>
            ))}
          </div>
          {errors.type && <p className="mt-1.5 text-xs font-medium text-red-600">{errors.type[0]}</p>}
        </fieldset>
      )}

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-slate-900">{RAID_TYPE_LABEL[type]}</h2>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">{text("title", "Title", { required: true, maxLength: 160 })}</div>
          <div className="sm:col-span-2">
            {area("description", type === "assumption" ? "Assumption statement" : "Description", {
              required: type === "assumption",
              hint: type === "assumption" ? "What is being treated as true, stated so it can be validated" : undefined,
            })}
          </div>
          <FormField id="projectId" label="Project" required errors={errors.projectId}>
            <select {...fieldAria("projectId", errors.projectId)} value={projectId} onChange={(e) => changeProject(e.target.value)} required className={inputClass(!!errors.projectId)}>
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
          {text("owner", OWNER_LABEL[type], { required: true, maxLength: 80, list: "raid-owner-options" })}
          <datalist id="raid-owner-options">
            {owners.map((o) => (
              <option key={o} value={o} />
            ))}
          </datalist>

          {type === "risk" ? (
            <>
              {ratingSelect("probability", probability, setProbability)}
              {ratingSelect("impact", impact, setImpact)}
              <p className="flex items-center gap-2 text-sm text-slate-600 sm:col-span-2">
                Risk score <SeverityBadge severity={riskLevel(score)} score={score} />
                <span className="text-xs text-slate-500">calculated as probability × impact</span>
              </p>
            </>
          ) : (
            prioritySelect(type === "issue" ? "Severity" : "Priority")
          )}

          {type === "dependency" && (
            <>
              <FormField id="direction" label="Internal or external" required errors={errors.direction}>
                <select {...fieldAria("direction", errors.direction)} defaultValue={v("direction") || "external"} className={inputClass(!!errors.direction)}>
                  {DEPENDENCY_DIRECTIONS.map((d) => (
                    <option key={d} value={d}>
                      {humanize(d)}
                    </option>
                  ))}
                </select>
              </FormField>
              {text("requiredFrom", "Required from", { required: true, maxLength: 120, placeholder: "Team, vendor, project or stakeholder" })}
            </>
          )}
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-slate-900">Status and dates</h2>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <FormField
            id="status"
            label="Status"
            required
            hint={editing ? `Allowed from ${humanize(editing.status)}: ${(STATUS_TRANSITIONS[editing.type][editing.status] ?? []).map(humanize).join(", ") || "none"}` : undefined}
            errors={errors.status}
          >
            <select {...fieldAria("status", errors.status, editing ? "transitions" : undefined)} value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass(!!errors.status)}>
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {humanize(s)}
                </option>
              ))}
            </select>
          </FormField>
          {date("targetDate", TARGET_DATE_LABEL[type], { required: true })}
          {closed && date("resolvedDate", "Actual resolution date", { max: today, hint: `Leave blank to record today (${formatDate(today)})` })}
          {type === "issue" && status === "escalated" && (
            <>
              {date("escalatedDate", "Escalation date", { max: today, hint: "Leave blank to record today" })}
              <div className="sm:col-span-2">{area("escalationReason", "Escalation reason", { required: true, rows: 2, max: 2000 })}</div>
            </>
          )}
          {type === "dependency" && text("escalationOwner", "Escalation owner", { maxLength: 80, list: "raid-owner-options", hint: "Required when the dependency is blocked" })}
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-slate-900">Plan and impact</h2>
        <div className="mt-4 grid gap-5">
          {type === "issue" && area("businessImpact", "Business / delivery impact", { rows: 2, max: 2000 })}
          {type === "dependency" && area("impactIfUnfulfilled", "Impact if not fulfilled", { rows: 2, max: 2000 })}
          {area("plan", PLAN_LABEL[type])}
          {type === "risk" && area("contingency", "Contingency plan", { hint: "What happens if the risk materialises" })}
          {type === "assumption" && area("validationNotes", "Evidence / validation notes", { hint: "Required when marking the assumption validated or invalidated" })}
          {area("latestUpdate", "Latest update", { rows: 2, max: 2000, hint: "Changes are recorded in the activity history" })}
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-slate-900">Impacted milestone and task</h2>
        <p className="mt-1 text-xs text-slate-500">
          Optional, and limited to the chosen project.{type === "dependency" && " A RAID dependency tracks something needed from outside the team; task-to-task predecessors are managed on tasks."}
        </p>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <FormField id="milestoneId" label="Milestone" errors={errors.milestoneId}>
            <select {...fieldAria("milestoneId", errors.milestoneId)} value={milestoneId} onChange={(e) => setMilestoneId(e.target.value)} disabled={!projectId} className={inputClass(!!errors.milestoneId)}>
              <option value="">None</option>
              {milestones.filter((m) => m.projectId === projectId).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField id="taskId" label="Task" errors={errors.taskId}>
            <select {...fieldAria("taskId", errors.taskId)} value={taskId} onChange={(e) => setTaskId(e.target.value)} disabled={!projectId} className={inputClass(!!errors.taskId)}>
              <option value="">None</option>
              {tasks.filter((t) => t.projectId === projectId).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </FormField>
        </div>
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
