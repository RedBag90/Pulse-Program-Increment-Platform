"use client";

import { useActionState, useEffect, type MouseEvent } from "react";
import { useRouter } from "@/i18n/navigation";
import {
  setTenantStatusAction,
  deleteTenantAction,
  type ActionState,
} from "@/features/platform/actions/tenant-actions";

/**
 * Lifecycle-Steuerung eines Tenants: Sperren · Archivieren · Reaktivieren ·
 * Löschen. Alle destruktiven Aktionen sind mit `window.confirm` bestätigt.
 * Löschen greift nur bei leeren Tenants (Service-Guardrail) — sonst ist
 * Archivieren der Ersatz.
 */
export function TenantLifecycleControls({
  tenantId,
  status,
  name,
}: {
  tenantId: string;
  status: string;
  name: string;
}) {
  const router = useRouter();
  const [sState, sAction, sPending] = useActionState<ActionState, FormData>(
    setTenantStatusAction,
    {},
  );
  const [dState, dAction, dPending] = useActionState<ActionState, FormData>(deleteTenantAction, {});

  useEffect(() => {
    if (sState.success) router.refresh();
  }, [sState, router]);
  useEffect(() => {
    if (dState.success) router.push("/platform/tenants");
  }, [dState, router]);

  const confirmOr = (msg: string) => (e: MouseEvent<HTMLButtonElement>) => {
    if (!window.confirm(msg)) e.preventDefault();
  };

  const active = status === "active";
  const error = sState.error ?? dState.error;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <form action={sAction} className="contents">
          <input type="hidden" name="tenantId" value={tenantId} />
          {active ? (
            <>
              <button
                type="submit"
                name="status"
                value="suspended"
                disabled={sPending}
                onClick={confirmOr(
                  `„${name}" sperren? Mitglieder können sich nicht mehr anmelden.`,
                )}
                className="rounded-md border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
              >
                Sperren
              </button>
              <button
                type="submit"
                name="status"
                value="archived"
                disabled={sPending}
                onClick={confirmOr(`„${name}" archivieren? Der Bereich wird stillgelegt.`)}
                className="rounded-md border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
              >
                Archivieren
              </button>
            </>
          ) : (
            <button
              type="submit"
              name="status"
              value="active"
              disabled={sPending}
              className="rounded-md border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
            >
              Reaktivieren
            </button>
          )}
        </form>

        <form action={dAction} className="contents">
          <input type="hidden" name="tenantId" value={tenantId} />
          <button
            type="submit"
            disabled={dPending}
            onClick={confirmOr(
              `„${name}" endgültig löschen? Das geht nur bei komplett leeren Bereichen und ist nicht umkehrbar.`,
            )}
            className="rounded-md border border-destructive/40 px-3 py-1.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
          >
            Löschen
          </button>
        </form>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
