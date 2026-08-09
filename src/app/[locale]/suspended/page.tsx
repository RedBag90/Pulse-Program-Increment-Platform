import { redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { getPrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { listUserTenants } from "@/server/services/tenant";
import type { TenantId } from "@/modules/core/kernel/domain/types";
import { SuspendedActions } from "@/features/platform/components/suspended-actions";

/**
 * Sperr-Seite für Nutzer, deren aktiver Tenant `suspended`/`archived` ist.
 * Bewusst AUSSERHALB der `(dashboard)`-Gruppe — das Dashboard-Layout leitet
 * gesperrte Tenants hierher um; läge die Seite darunter, gäbe es einen
 * Redirect-Loop. Bietet Wechsel in einen aktiven Bereich oder Abmelden.
 */
export default async function SuspendedPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const principal = await getPrincipal();
  if (!principal) redirect(`/${locale}/sign-in`);
  // Aktiver Tenant doch aktiv? Dann gehört der Nutzer nicht hierher.
  if (principal.tenantStatus === "active") redirect(`/${locale}/start`);

  const db = createPrismaClient({ userId: principal.id, tenantId: "" as TenantId });
  const tenants = await listUserTenants(db, principal.id);

  const archived = principal.tenantStatus === "archived";

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md space-y-6 rounded-xl border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10">
          <ShieldAlert className="size-6 text-destructive" aria-hidden />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold">
            {archived ? "Bereich archiviert" : "Bereich gesperrt"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {archived
              ? "Dieser Bereich wurde vom Plattform-Admin archiviert und ist nicht mehr zugänglich."
              : "Dieser Bereich wurde vom Plattform-Admin gesperrt. Bitte wende dich an den Support."}
          </p>
        </div>
        <div className="border-t pt-4 text-left">
          <SuspendedActions tenants={tenants} />
        </div>
      </div>
    </main>
  );
}
