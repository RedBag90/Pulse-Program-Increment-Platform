"use client";

import { useActionState } from "react";
import { submitJoinAction, type SubmitJoinState } from "@/features/auth/actions/submit-join";

/**
 * Öffentliches Beitritts-Formular. Zwei Modi: mit fixem `token` (aus dem
 * Einladungslink) nur E-Mail; ohne Token ein Code-Feld + E-Mail. Nach Erfolg
 * zeigt es je nach `autoAccepted` „beigetreten" oder „wartet auf Freigabe".
 */
export function JoinForm({ token }: { token?: string }) {
  const [state, action, isPending] = useActionState<SubmitJoinState, FormData>(
    submitJoinAction,
    {},
  );

  if (state.success) {
    return (
      <div className="rounded-lg border bg-card p-6 text-center">
        <p className="text-sm font-medium">
          {state.autoAccepted
            ? "Du bist dem Bereich beigetreten."
            : "Deine Anfrage wurde übermittelt und wartet auf Freigabe."}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          {state.autoAccepted
            ? "Melde dich an, um loszulegen."
            : "Du erhältst Zugang, sobald ein Admin die Anfrage bestätigt."}
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      {token && <input type="hidden" name="token" value={token} />}

      {!token && (
        <div>
          <label htmlFor="join-code" className="mb-1 block text-sm font-medium">
            Beitrittscode
          </label>
          <input
            id="join-code"
            name="code"
            required
            placeholder="z. B. K7P2M9QX"
            autoCapitalize="characters"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      )}

      <div>
        <label htmlFor="join-email" className="mb-1 block text-sm font-medium">
          E-Mail-Adresse
        </label>
        <input
          id="join-email"
          name="email"
          type="email"
          required
          placeholder="du@firma.de"
          className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        {isPending ? "Wird gesendet…" : "Beitreten"}
      </button>
    </form>
  );
}
