"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { ActionState } from "@/server/http/server-action";

/**
 * Generic "watch a useActionState result" hook: on the first transition into
 * `state.success`, fire a sonner toast and call `onSuccess` (typically
 * `() => setOpen(false)` plus any form-field reset). Each distinct state
 * object is handled once — re-runs after the success toast won't double-fire.
 *
 * Concentrates the `useEffect(() => { if (state.success) { toast.success(...);
 * setOpen(false); } }, [state])` snippet that lived inline in ~6 edit / link
 * dialogs (edit-art, edit-team, edit-value-stream, link-dependency,
 * epic-impact-confirm, wsjf-score). A future change (e.g. switching from
 * sonner to another toast lib, or adding error-toast behaviour) flips here.
 *
 * For *create* flows that emit `state.created.href` and need an "Open" CTA
 * in the toast, use `useCreateResult` (mirrors this hook plus the Open-link).
 */
export function useActionResult(
  state: ActionState,
  successMessage: string,
  onSuccess: () => void,
): void {
  const handled = useRef<ActionState | null>(null);

  useEffect(() => {
    if (!state.success || handled.current === state) return;
    handled.current = state;
    toast.success(successMessage);
    onSuccess();
  }, [state, successMessage, onSuccess]);
}
