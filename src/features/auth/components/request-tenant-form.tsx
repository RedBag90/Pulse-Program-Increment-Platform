"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import {
  submitProvisionAction,
  type SubmitProvisionState,
} from "@/features/auth/actions/submit-provision";

/**
 * Öffentliches Formular „Organisation anfragen". Nach Erfolg zeigt es eine
 * Bestätigung; der platform_admin genehmigt den Antrag separat.
 */
export function RequestTenantForm() {
  const t = useTranslations();
  const [state, action, isPending] = useActionState<SubmitProvisionState, FormData>(
    submitProvisionAction,
    {},
  );

  if (state.success) {
    return (
      <div className="rounded-lg bg-card shadow-card p-6 text-center">
        <p className="text-sm font-medium">{t("auth.ui.antragUebermittelt")}</p>
        <p className="mt-2 text-xs text-muted-foreground">{t("auth.ui.wirMeldenUnsPer")}</p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="rt-name" className="mb-1 block text-sm font-medium">
          {t("auth.ui.nameDerOrganisation")}
        </label>
        <input
          id="rt-name"
          name="desiredName"
          required
          minLength={2}
          placeholder={t("auth.ui.acmeGmbh")}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>
      <div>
        <label htmlFor="rt-email" className="mb-1 block text-sm font-medium">
          {t("auth.ui.deineEMail")}
        </label>
        <input
          id="rt-email"
          name="email"
          type="email"
          required
          placeholder={t("auth.ui.duFirmaDe")}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>
      <div>
        <label htmlFor="rt-note" className="mb-1 block text-sm font-medium">
          {t("auth.ui.notiz")} <span className="text-muted-foreground">(optional)</span>
        </label>
        <textarea
          id="rt-note"
          name="note"
          rows={3}
          placeholder={t("auth.ui.kurzZumKontext")}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
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
        {isPending ? "Wird gesendet…" : "Anfrage senden"}
      </button>
    </form>
  );
}
