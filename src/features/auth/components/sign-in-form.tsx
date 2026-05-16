"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { signIn } from "../actions/sign-in";
import type { SignInResult } from "../actions/sign-in";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function SignInForm() {
  const t = useTranslations("auth");
  const [state, action, isPending] = useActionState<SignInResult | null, FormData>(signIn, null);

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
          autoComplete="current-password"
          minLength={8}
        />
      </div>

      {state && !state.ok && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "…" : t("signIn")}
      </Button>
    </form>
  );
}
