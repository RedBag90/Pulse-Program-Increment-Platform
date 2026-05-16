"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { resetPassword } from "../actions/reset-password";
import type { ResetPasswordState } from "../actions/reset-password";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function ResetPasswordForm() {
  const t = useTranslations("auth");
  const [state, action, isPending] = useActionState<ResetPasswordState | null, FormData>(
    resetPassword,
    null,
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">{t("newPassword")}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>

      {state && !state.ok && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "…" : t("resetPassword")}
      </Button>
    </form>
  );
}
