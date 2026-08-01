"use client";

import { useActionState, useEffect, type MouseEvent } from "react";
import { useRouter } from "@/i18n/navigation";
import {
  setPlatformRoleAction,
  suspendUserAction,
  reactivateUserAction,
} from "@/features/platform/actions/user-actions";
import type { ActionState } from "@/features/platform/actions/tenant-actions";

/**
 * Aktionen je Nutzer-Zeile: Plattform-Admin-Rolle vergeben/entziehen und Konto
 * sperren/entsperren. Selbst-Sperrung ist ausgeblendet (zusätzlich im Service
 * blockiert). Destruktive Aktionen sind confirm-gated.
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

  useEffect(() => {
    if (rState.success || sState.success || aState.success) router.refresh();
  }, [rState, sState, aState, router]);

  const confirmOr = (msg: string) => (e: MouseEvent<HTMLButtonElement>) => {
    if (!window.confirm(msg)) e.preventDefault();
  };
  const who = email ?? userId;
  const error = rState.error ?? sState.error ?? aState.error;
  const busy = rPending || sPending || aPending;

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
          {isPlatformAdmin ? "Admin entziehen" : "Zum Admin"}
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
              Sperren
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
            Entsperren
          </button>
        </form>
      )}

      {error && <span className="w-full text-right text-xs text-destructive">{error}</span>}
    </div>
  );
}
