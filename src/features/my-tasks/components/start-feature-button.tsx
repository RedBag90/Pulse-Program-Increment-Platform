"use client";

import { useActionState, startTransition } from "react";
import { startFeatureAction } from "@/features/art/actions/feature";

/**
 * Inline "Umsetzung starten" trigger used by the "Bereit zu starten" bucket on
 * `/my-tasks`. One click, no popover — the bucket itself certifies that all
 * preconditions are met (PI assigned, Epic in L4/L5, status approved).
 */
export function StartFeatureButton({ featureId }: { featureId: string }) {
  const [state, action, pending] = useActionState(startFeatureAction, {});
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          const fd = new FormData();
          fd.set("id", featureId);
          startTransition(() => action(fd));
        }}
        className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {pending ? "…" : "Umsetzung starten"}
      </button>
      {state.error && (
        <p role="alert" className="text-[11px] text-red-600">
          {state.error}
        </p>
      )}
    </div>
  );
}
