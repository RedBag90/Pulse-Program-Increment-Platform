"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { forgotPassword } from "../actions/forgot-password";
import type { ForgotPasswordState } from "../actions/forgot-password";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

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
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">{t("email")}</Label>
        <Input id="email" name="email" type="email" required autoComplete="email" />
      </div>

      {state && !state.ok && state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "…" : t("sendResetLink")}
      </Button>
    </form>
  );
}
