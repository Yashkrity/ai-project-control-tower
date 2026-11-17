"use client";

import { useFormStatus } from "react-dom";
import { Archive, ArchiveRestore, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Submit button for the archive / restore forms; shows pending state. */
export function ArchiveSubmitButton({ archived }: { archived: boolean }) {
  const { pending } = useFormStatus();
  const Icon = pending ? Loader2 : archived ? ArchiveRestore : Archive;
  return (
    <Button type="submit" variant="secondary" disabled={pending}>
      <Icon className={pending ? "size-4 animate-spin" : "size-4"} aria-hidden />
      {archived ? (pending ? "Restoring…" : "Restore") : pending ? "Archiving…" : "Archive"}
    </Button>
  );
}
