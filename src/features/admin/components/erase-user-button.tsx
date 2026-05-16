"use client";

import { useState, useTransition } from "react";
import { eraseUserAction } from "@/features/admin/actions/gdpr";

/** GDPR erasure trigger for the admin user-detail page. */
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
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
      >
        {isPending ? "Erasing…" : "Erase user (GDPR)"}
      </button>
    </div>
  );
}
