"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { forgotPassword } from "../actions/forgot-password";
import type { ForgotPasswordState } from "../actions/forgot-password";

export function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [state, action, isPending] = useActionState<ForgotPasswordState | null, FormData>(
    forgotPassword,
    null,
  );

  if (state?.ok) {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        {t("resetLinkSent")}
      </p>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="locale" value={locale} />
      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium">
          {t("email")}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {state && !state.ok && state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity disabled:opacity-60"
      >
        {isPending ? "…" : t("sendResetLink")}
      </button>
    </form>
  );
}
