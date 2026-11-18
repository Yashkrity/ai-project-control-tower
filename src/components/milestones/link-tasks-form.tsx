"use client";

import { useActionState } from "react";
import { AlertCircle, Link2, Loader2 } from "lucide-react";
import type { TaskStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { TaskStatusBadge } from "@/components/ui/badge";
import type { SimpleActionState } from "@/app/(workspace)/milestones/actions";

type Action = (state: SimpleActionState, formData: FormData) => Promise<SimpleActionState>;

export interface LinkCandidate {
  id: string;
  title: string;
  status: TaskStatus;
  /** Name of the milestone it is currently linked to, if any. */
  currentMilestone: string | null;
}

export function LinkTasksForm({ action, candidates, milestoneCompleted }: { action: Action; candidates: LinkCandidate[]; milestoneCompleted: boolean }) {
  // React resets the (uncontrolled) checkboxes after the action completes.
  const [state, formAction, pending] = useActionState(action, {});

  if (candidates.length === 0) {
    return <p className="px-5 py-4 text-sm text-slate-500">Every task in this project is already linked to this milestone.</p>;
  }

  return (
    <form action={formAction} className="space-y-3 px-5 py-4">
      {milestoneCompleted && (
        <p className="text-xs text-amber-700">This milestone is completed: only tasks that are already done can be added.</p>
      )}
      <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-md border border-slate-200">
        {candidates.map((t) => (
          <li key={t.id}>
            <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-slate-50">
              <input type="checkbox" name="taskIds" value={t.id} className="size-4 accent-indigo-600" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-slate-800">{t.title}</span>
                {t.currentMilestone && <span className="block text-xs text-slate-500">Moves from “{t.currentMilestone}”</span>}
              </span>
              <TaskStatusBadge status={t.status} />
            </label>
          </li>
        ))}
      </ul>
      {state.message && (
        <p role="alert" className="flex items-start gap-1.5 text-xs font-medium text-red-600">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {state.message}
        </p>
      )}
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Link2 className="size-4" aria-hidden />}
        {pending ? "Linking…" : "Link selected tasks"}
      </Button>
    </form>
  );
}
