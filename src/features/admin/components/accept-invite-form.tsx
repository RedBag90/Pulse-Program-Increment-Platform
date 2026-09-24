"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { acceptInviteAction } from "@/features/admin/actions/accept-invite";

interface Props {
  token: string;
  email: string;
}

export function AcceptInviteForm({ token, email }: Props) {
  const t = useTranslations();
  const [state, action, isPending] = useActionState(acceptInviteAction, {});

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="email" value={email} />

      <div>
        <label htmlFor="password" className="block text-sm font-medium mb-1">
          {t("admin.ui.password")}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>

      {state.error && (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {isPending ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
