"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { signUp } from "../actions/sign-up";
import type { SignUpResult } from "../actions/sign-up";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function SignUpForm() {
  const t = useTranslations("auth");
  const [state, action, isPending] = useActionState<SignUpResult | null, FormData>(signUp, null);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">{t("email")}</Label>
        <Input id="email" name="email" type="email" required autoComplete="email" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">{t("password")}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="new-password"
          minLength={8}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tenantCode">{t("tenantCode")}</Label>
        <Input
          id="tenantCode"
          name="tenantCode"
          type="text"
          required
          minLength={3}
          maxLength={50}
        />
      </div>

      {state && !state.ok && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "…" : t("signUp")}
      </Button>
    </form>
  );
}
