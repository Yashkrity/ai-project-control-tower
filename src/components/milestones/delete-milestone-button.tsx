"use client";

import { useActionState, useState } from "react";
import { AlertCircle, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/form-field";
import type { SimpleActionState } from "@/app/(workspace)/milestones/actions";

type Action = (state: SimpleActionState, formData: FormData) => Promise<SimpleActionState>;

/**
 * Two-step delete. When tasks are linked, the user must choose to unlink them
 * or move them to another milestone in the same project; the server enforces it.
 */
export function DeleteMilestoneButton({
  action,
  linkedTasks,
  otherMilestones,
}: {
  action: Action;
  linkedTasks: number;
  otherMilestones: { id: string; name: string; completed: boolean }[];
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"unlink" | "reassign">("unlink");
  const [state, formAction, pending] = useActionState(action, {});

  if (!open) {
    return (
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        <Trash2 className="size-4" aria-hidden />
        Delete
      </Button>
    );
  }

  return (
    <form action={formAction} className="w-full max-w-md space-y-3 rounded-md border border-red-200 bg-red-50/60 p-4 text-sm sm:w-96">
      <p className="font-medium text-slate-900">Delete this milestone permanently?</p>
      {linkedTasks > 0 && (
        <fieldset className="space-y-2">
          <legend className="text-slate-700">
            {linkedTasks} linked task{linkedTasks === 1 ? "" : "s"} will be kept. What should happen to {linkedTasks === 1 ? "it" : "them"}?
          </legend>
          <label className="flex items-center gap-2">
            <input type="radio" name="taskHandling" value="unlink" checked={mode === "unlink"} onChange={() => setMode("unlink")} className="accent-indigo-600" />
            Unlink (keep in the project with no milestone)
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="taskHandling"
              value="reassign"
              checked={mode === "reassign"}
              onChange={() => setMode("reassign")}
              disabled={otherMilestones.length === 0}
              className="accent-indigo-600"
            />
            Move to another milestone{otherMilestones.length === 0 ? " (none in this project)" : ""}
          </label>
          {mode === "reassign" && (
            <select name="reassignTo" required defaultValue="" aria-label="Milestone to move tasks to" className={inputClass(false)}>
              <option value="" disabled>
                Choose a milestone…
              </option>
              {otherMilestones.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                  {m.completed ? " (completed)" : ""}
                </option>
              ))}
            </select>
          )}
        </fieldset>
      )}
      {state.message && (
        <p role="alert" className="flex items-start gap-1.5 text-xs font-medium text-red-700">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {state.message}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" className="bg-red-600 hover:bg-red-500" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Trash2 className="size-4" aria-hidden />}
          {pending ? "Deleting…" : "Confirm delete"}
        </Button>
      </div>
    </form>
  );
}
