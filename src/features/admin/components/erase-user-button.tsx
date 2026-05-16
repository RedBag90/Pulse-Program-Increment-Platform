"use client";

import { useState, useTransition } from "react";
import { eraseUserAction } from "@/features/admin/actions/gdpr";
import { Button } from "@/components/ui/button";

export function EraseUserButton({ userId }: { userId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    if (
      !confirm(
        "Permanently erase this user? Their account and role assignments are removed. " +
          "Audit history is retained with an anonymised reference. This cannot be undone.",
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await eraseUserAction(userId);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="space-y-1">
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleClick}
        disabled={isPending}
        className="text-destructive border-destructive/30 hover:bg-destructive/10"
      >
        {isPending ? "Erasing…" : "Erase user (GDPR)"}
      </Button>
    </div>
  );
}
