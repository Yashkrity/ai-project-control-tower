"use client";

import { useActionState, useState } from "react";
import { AlertCircle, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DeleteTaskState } from "@/app/(workspace)/tasks/actions";

type DeleteAction = (state: DeleteTaskState, formData: FormData) => Promise<DeleteTaskState>;

/** Two-step delete: the first click asks for confirmation inside the page. */
export function DeleteTaskButton({ action, successorCount }: { action: DeleteAction; successorCount: number }) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <div className="flex flex-col items-end gap-2">
      {!confirming ? (
        <Button type="button" variant="secondary" onClick={() => setConfirming(true)}>
          <Trash2 className="size-4" aria-hidden />
          Delete
        </Button>
      ) : (
        <form action={formAction} className="flex flex-wrap items-center justify-end gap-2">
          <span className="text-sm text-slate-600">
            {successorCount > 0 ? `${successorCount} task(s) depend on this.` : "Delete permanently?"}
          </span>
          <Button type="button" variant="ghost" onClick={() => setConfirming(false)} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" className="bg-red-600 hover:bg-red-500" disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Trash2 className="size-4" aria-hidden />}
            {pending ? "Deleting…" : "Confirm delete"}
          </Button>
        </form>
      )}
      {state.message && (
        <p role="alert" className="flex max-w-md items-start gap-1.5 text-right text-xs font-medium text-red-600">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {state.message}
        </p>
      )}
    </div>
  );
}
