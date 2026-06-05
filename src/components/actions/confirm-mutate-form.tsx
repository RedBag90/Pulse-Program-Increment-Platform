"use client";

import { useActionState, useEffect, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { ActionState } from "@/server/http/server-action";

/**
 * Generic wrapper for the "confirm-then-mutate" client pattern that recurs
 * across delete-X / disconnect-X / remove-X buttons: a `<form action>` driven
 * by `useActionState`, hidden fields carrying the row's identifiers, native
 * `confirm()` on submit, and an inline error span when the action returns one.
 *
 * Covers the dominant shape only — single button, single confirm. Two-action
 * variants (approval-actions, approval-controls) and form-reveal patterns
 * (impediment-row resolve, dashboard inline editors) intentionally stay
 * hand-rolled; their state is genuinely different and the `makeForm`/dispatch
 * helpers are already factored where they recur (see ADR-0006).
 *
 * The interface is small on purpose: callers pass the Action + hidden fields
 * + labels and get back identical pending/error/confirm behaviour. Sites that
 * need to react to success (e.g. router.replace after deleting the page's
 * own resource) pass `onSuccess`; everything else relies on the server-action
 * runtime's `revalidate`.
 */
type ServerAction = (state: ActionState, fd: FormData) => Promise<ActionState>;

interface Props {
  /** Server action returned by `createServerAction`. */
  action: ServerAction;
  /** Hidden form fields (single-value). The action's Zod schema reads them. */
  fields: Record<string, string>;
  /** Submit-button label. Pending state replaces it with `pendingLabel`. */
  label: ReactNode;
  /** Label shown while the action is in flight. */
  pendingLabel?: ReactNode;
  /** Native `confirm()` prompt. Omit to skip confirmation (rare). */
  confirmPrompt?: string;
  /** Trigger button variant — defaults to "ghost" for inline delete affordances. */
  variant?: "ghost" | "outline" | "default";
  /** Adds the destructive tone (red text/border) on top of the variant. */
  destructive?: boolean;
  /** Compact size for inline rows. */
  size?: "sm" | "default";
  /** Optional className appended to the trigger button. */
  className?: string;
  /** Optional leading icon inside the button. */
  icon?: ReactNode;
  /** Fires once after a successful action — used by sites that own the page
   *  being deleted and must navigate away. Revalidation is already handled by
   *  the action runtime; don't refetch here. */
  onSuccess?: () => void;
}

const DESTRUCTIVE_CLASS = "text-destructive border-destructive/30 hover:bg-destructive/10";

export function ConfirmMutateForm({
  action,
  fields,
  label,
  pendingLabel,
  confirmPrompt,
  variant = "ghost",
  destructive = false,
  size = "sm",
  className,
  icon,
  onSuccess,
}: Props) {
  const [state, formAction, isPending] = useActionState(action, {});

  useEffect(() => {
    if (state.success) onSuccess?.();
  }, [state.success, onSuccess]);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (confirmPrompt && !window.confirm(confirmPrompt)) e.preventDefault();
      }}
      className="inline-flex items-center gap-2"
    >
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {state.error && (
        <span role="alert" className="text-destructive text-xs">
          {state.error}
        </span>
      )}
      <Button
        type="submit"
        variant={variant}
        size={size}
        disabled={isPending}
        className={[destructive ? DESTRUCTIVE_CLASS : "", className ?? ""].join(" ").trim()}
      >
        {icon}
        {isPending && pendingLabel ? pendingLabel : label}
      </Button>
    </form>
  );
}
