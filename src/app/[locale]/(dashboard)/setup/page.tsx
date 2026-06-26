import { redirect } from "next/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { hasCapability } from "@/server/auth/authorize";
import { createPrismaClient } from "@/server/db/prisma";
import { listSetupProgress } from "@/server/services/setup-progress";
import { SetupChecklist } from "@/features/setup/components/setup-checklist";

/**
 * Setup-Guide V0.2 — Tenant-weit geteilte Checkliste.
 *
 * - Stand liegt auf dem Server (Tabelle `setup_progress`).
 * - Schreib-Recht: nur Tenant-Admin (Capability `tenant.users.manage`).
 * - Andere User sehen den Stand read-only.
 */
export default async function SetupPage() {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const done = await listSetupProgress(db, principal.tenantId);
  const canEdit = hasCapability(principal, "tenant.users.manage");

  return (
    <div className="p-6">
      <SetupChecklist initialDone={[...done]} canEdit={canEdit} />
    </div>
  );
}
