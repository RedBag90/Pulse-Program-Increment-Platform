"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock, Building2, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { switchTenantAction, clearTenantCookieAction } from "@/features/auth/actions/switch-tenant";

interface Tenant {
  id: string;
  name: string;
  kind: string;
}

/**
 * Aktionen auf der Sperr-Seite: in einen anderen (aktiven) Bereich wechseln
 * oder abmelden. Der aktuell gesperrte Tenant taucht hier nicht auf
 * (`listUserTenants` filtert auf aktive Bereiche).
 */
export function SuspendedActions({ tenants }: { tenants: Tenant[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const switchTo = (tenantId: string) => {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("tenantId", tenantId);
      const res = await switchTenantAction({}, fd);
      if (!res.error) router.push("/start");
    });
  };

  const signOut = () => {
    startTransition(async () => {
      await clearTenantCookieAction();
      await createClient().auth.signOut();
      router.push("/sign-in");
    });
  };

  return (
    <div className="space-y-4">
      {tenants.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">In anderen Bereich wechseln</p>
          <ul className="space-y-1.5">
            {tenants.map((t) => {
              const Icon = t.kind === "personal" ? Lock : Building2;
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => switchTo(t.id)}
                    disabled={isPending}
                    className="flex w-full items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors hover:bg-muted disabled:opacity-50"
                  >
                    <Icon className="size-4 shrink-0 opacity-60" aria-hidden />
                    <span className="min-w-0 flex-1 truncate text-left">
                      {t.kind === "personal" ? `Privat (${t.name})` : t.name}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <button
        type="button"
        onClick={signOut}
        disabled={isPending}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
      >
        <LogOut className="size-4" aria-hidden />
        Abmelden
      </button>
    </div>
  );
}
