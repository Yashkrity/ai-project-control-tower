"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export default function WorkspaceError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const message =
    error instanceof Error && process.env.NODE_ENV !== "production"
      ? error.message
      : "The data for this page could not be loaded.";

  return (
    <Card>
      <EmptyState
        icon={AlertTriangle}
        title="Something went wrong"
        description={message}
        action={
          <button
            type="button"
            onClick={() => retry()}
            className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          >
            Try again
          </button>
        }
      />
    </Card>
  );
}
