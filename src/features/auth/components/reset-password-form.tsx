"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { resetPassword } from "../actions/reset-password";
import type { ResetPasswordState } from "../actions/reset-password";

export function ResetPasswordForm() {
  const t = useTranslations("auth");
  const [state, action, isPending] = useActionState<ResetPasswordState | null, FormData>(
    resetPassword,
    null,
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm font-medium">
          {t("newPassword")}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {state && !state.ok && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity disabled:opacity-60"
      >
        {isPending ? "…" : t("resetPassword")}
      </button>
    </form>
  );
}
