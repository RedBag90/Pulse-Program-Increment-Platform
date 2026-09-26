"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { inviteUserAction } from "@/features/admin/actions/invite-user";
import { ROLES, ROLE_LABELS } from "@/modules/core/kernel/domain/roles";
import type { Role } from "@/modules/core/kernel/domain/roles";

/**
 * Invite-by-email form. Embedded in the master-detail "Einladen"-Pane.
 * `inviteUserAction` returns `{ success: true }` on a successful invite;
 * the parent shell clears the selection back to the list on success.
 */
export function InviteUserForm() {
  const t = useTranslations();
  const [state, action, isPending] = useActionState(inviteUserAction, {});
  const locale = useLocale();

  return (
    <form action={action} className="space-y-4">
      {/* Locale des aktiven URL-Segments mitsenden — das Action-Schema verlangt
          `locale: z.enum(["en","de"])` (bestimmt die Sprache der Einladungs-Mail). */}
      <input type="hidden" name="locale" value={locale} />
      <div>
        <label htmlFor="email" className="block text-sm font-medium mb-1">
          {t("admin.ui.eMailAdresse")}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          placeholder={t("admin.ui.kollegInFirmaDe")}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>

      <div>
        <label htmlFor="role" className="block text-sm font-medium mb-1">
          {t("admin.ui.rolle")}
        </label>
        <select
          id="role"
          name="role"
          required
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {(Object.values(ROLES) as Role[]).map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </select>
      </div>

      {state.error && (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      )}

      {state.success && (
        <p role="status" className="text-sm text-success">
          {t("admin.ui.einladungErfolgreichVersendet")}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {isPending ? t("admin.ui.einladungWirdVersendet") : t("admin.ui.einladungVersenden")}
      </button>
    </form>
  );
}
