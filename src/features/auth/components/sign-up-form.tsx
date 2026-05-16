"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { signUp } from "../actions/sign-up";
import type { SignUpResult } from "../actions/sign-up";

export function SignUpForm() {
  const t = useTranslations("auth");
  const [state, action, isPending] = useActionState<SignUpResult | null, FormData>(signUp, null);

  return (
    <form action={action} className="flex flex-col gap-4">
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

      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm font-medium">
          {t("password")}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="new-password"
          minLength={8}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="tenantCode" className="text-sm font-medium">
          {t("tenantCode")}
        </label>
        <input
          id="tenantCode"
          name="tenantCode"
          type="text"
          required
          minLength={3}
          maxLength={50}
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
        {isPending ? "…" : t("signUp")}
      </button>
    </form>
  );
}
