"use client";

import { useTranslations } from "next-intl";
import { useActionState, useEffect, type MouseEvent } from "react";
import { useRouter } from "@/i18n/navigation";
import {
  setPlatformRoleAction,
  suspendUserAction,
  reactivateUserAction,
  deleteUserAccountAction,
} from "@/features/platform/actions/user-actions";
import type { ActionState } from "@/features/platform/actions/tenant-actions";

/**
 * Aktionen je Nutzer-Zeile: Plattform-Admin-Rolle vergeben/entziehen, Konto
 * sperren/entsperren und endgültig löschen. Selbst-Sperrung und Selbst-Löschung
 * sind ausgeblendet (zusätzlich im Service blockiert). Destruktive Aktionen sind
 * confirm-gated.
 *
 * **Das endgültige Löschen kam im September 2026 hierher.** Es lag in der
 * *Mandanten*-Verwaltung (`/admin/users`), die ein Mandanten-Recht prüft — und
 * löschte trotzdem ein globales Konto. Der Unterschied zum Sperren daneben ist
 * die Umkehrbarkeit, und deshalb steht der Knopf am Ende der Reihe.
 */
export function UserRowActions({
  userId,
  email,
  isPlatformAdmin,
  status,
  isSelf,
}: {
  userId: string;
  email: string | null;
  isPlatformAdmin: boolean;
  status: "active" | "suspended";
  isSelf: boolean;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [rState, roleAction, rPending] = useActionState<ActionState, FormData>(
    setPlatformRoleAction,
    {},
  );
  const [sState, suspendAction, sPending] = useActionState<ActionState, FormData>(
    suspendUserAction,
    {},
  );
  const [aState, reactivateAction, aPending] = useActionState<ActionState, FormData>(
    reactivateUserAction,
    {},
  );
  const [dState, deleteAction, dPending] = useActionState<ActionState, FormData>(
    deleteUserAccountAction,
    {},
  );

  useEffect(() => {
    if (rState.success || sState.success || aState.success || dState.success) router.refresh();
  }, [rState, sState, aState, dState, router]);

  const confirmOr = (msg: string) => (e: MouseEvent<HTMLButtonElement>) => {
    if (!window.confirm(msg)) e.preventDefault();
  };
  const who = email ?? userId;
  const error = rState.error ?? sState.error ?? aState.error ?? dState.error;
  const busy = rPending || sPending || aPending || dPending;

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      <form action={roleAction} className="contents">
        <input type="hidden" name="userId" value={userId} />
        <input type="hidden" name="grant" value={isPlatformAdmin ? "false" : "true"} />
        <button
          type="submit"
          disabled={busy}
          onClick={confirmOr(
            isPlatformAdmin
              ? `„${who}" die Plattform-Admin-Rolle entziehen?`
              : `„${who}" zum Plattform-Admin machen?`,
          )}
          className="rounded-md border px-2.5 py-1 text-xs transition-colors hover:bg-muted disabled:opacity-50"
        >
          {isPlatformAdmin ? t("platform.ui.adminEntziehen") : t("platform.ui.zumAdminMachen")}
        </button>
      </form>

      {status === "active" ? (
        !isSelf && (
          <form action={suspendAction} className="contents">
            <input type="hidden" name="userId" value={userId} />
            <button
              type="submit"
              disabled={busy}
              onClick={confirmOr(`„${who}" sperren? Der Zugang wird sofort blockiert.`)}
              className="rounded-md border border-destructive/40 px-2.5 py-1 text-xs text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
            >
              {t("platform.ui.sperren")}
            </button>
          </form>
        )
      ) : (
        <form action={reactivateAction} className="contents">
          <input type="hidden" name="userId" value={userId} />
          <button
            type="submit"
            disabled={busy}
            className="rounded-md border px-2.5 py-1 text-xs transition-colors hover:bg-muted disabled:opacity-50"
          >
            {t("platform.ui.entsperren")}
          </button>
        </form>
      )}

      {!isSelf && (
        <form action={deleteAction} className="contents">
          <input type="hidden" name="userId" value={userId} />
          <button
            type="submit"
            disabled={busy}
            onClick={confirmOr(
              `„${who}" endgültig löschen? Das Konto ist danach weg und lässt sich nicht ` +
                `wiederherstellen. Rollenzuweisungen bleiben als verwaiste Zeilen stehen. ` +
                `Zum Aussperren reicht „Sperren".`,
            )}
            className="rounded-md border border-destructive/40 bg-destructive/5 px-2.5 py-1 text-xs font-medium text-destructive transition-colors hover:bg-destructive/15 disabled:opacity-50"
          >
            {t("platform.ui.loeschen")}
          </button>
        </form>
      )}

      {error && <span className="w-full text-right text-xs text-destructive">{error}</span>}
    </div>
  );
}
