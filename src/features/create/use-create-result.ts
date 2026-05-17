"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import type { ActionState } from "@/server/http/server-action";

/**
 * Watches a create action's state. On success it closes the dialog and shows a
 * `sonner` toast — with an "Open" link to the new entity when the action
 * returned a `created.href`. Each distinct state object is handled once.
 */
export function useCreateResult(state: ActionState, onClose: () => void): void {
  const router = useRouter();
  const handled = useRef<ActionState | null>(null);

  useEffect(() => {
    if (!state.success || handled.current === state) return;
    handled.current = state;

    const created = state.created;
    const href = created?.href;
    toast.success(created ? `${created.label} created` : "Created", {
      duration: 6000,
      ...(href && { action: { label: "Open", onClick: () => router.push(href) } }),
    });
    onClose();
  }, [state, onClose, router]);
}
