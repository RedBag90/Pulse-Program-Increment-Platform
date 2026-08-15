import { redirect } from "next/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { getActiveTargetModel } from "@/server/services/target-model";
import { effectivePractices } from "@/modules/core/kernel/domain/operating-model";
import { buildRolePlaybookModel } from "@/modules/onboarding/server/views/role-onboarding";
import { RolePlaybookPanel } from "@/modules/onboarding/features/onboarding/components/role-playbook-panel";

/**
 * „Meine Rolle" — die Nachschlage-Fläche des Rollen-Onboardings.
 *
 * Bewusst ein Core-Segment ohne Entitlement (ADR-0017): die Erklärung der
 * eigenen Verantwortung muss in jedem Workspace erreichbar sein, auch im
 * persönlichen Free-Bereich. Aus demselben Grund steht sie **nicht** in
 * `NAV_GROUPS` — der Nav-Filter blendet Core-Segmente im persönlichen Tenant
 * aus; der Einstieg läuft über das Benutzermenü.
 */
export default async function MeineRollePage() {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const targetModel = await getActiveTargetModel(db, principal.tenantId);
  const { entries } = await buildRolePlaybookModel(db, principal, effectivePractices(targetModel));

  return (
    <div className="space-y-5 p-6">
      <header>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Meine Rolle</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {entries.length > 1
            ? "Du hast mehrere Rollen. Jede bringt ihre eigene Verantwortung mit."
            : "Was deine Rolle verantwortet und wo du die zugehörigen Aufgaben findest."}
        </p>
      </header>

      {entries.length === 0 ? (
        <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          Dir ist in diesem Workspace noch keine Rolle zugewiesen. Sobald ein Administrator das
          tut, findest du hier deine Aufgaben.
        </p>
      ) : (
        entries.map((e) => (
          <RolePlaybookPanel
            key={e.role}
            role={e.role}
            tour={e.tour}
            seenStepKeys={e.seenStepKeys}
          />
        ))
      )}
    </div>
  );
}
