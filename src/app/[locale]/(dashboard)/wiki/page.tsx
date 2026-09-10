import { redirect } from "next/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { getTenantPractices } from "@/server/services/target-model";
import { GUIDES } from "@/modules/wiki/domain/guides";
import { visibleGuides } from "@/modules/wiki/domain/guide-filter";
import { WikiHub } from "@/modules/wiki/features/wiki/components/wiki-hub";
import { Page, PageHeader } from "@/components/layout";
import type { Role } from "@/modules/core/kernel/domain/roles";
import type { ModuleKey } from "@/modules/core/kernel/domain/modules";

/**
 * Das **Wiki** — die Abläufe von Pulse als Anleitungen, geordnet nach ihrem
 * Rhythmus (der „Bogen").
 *
 * Das Segment steht in `CORE_SEGMENTS` und hängt damit an keinem Entitlement:
 * eine Fläche, die erklärt, darf nie fail-closed weggeleitet werden — dieselbe
 * Begründung wie bei `/meine-rolle` (ADR-0017). Gefiltert wird stattdessen **je
 * Anleitung**: was der Mandant nicht gebucht hat, wird auch nicht erklärt.
 */
export default async function WikiPage() {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const practices = await getTenantPractices(db, principal.tenantId);

  const guides = visibleGuides(GUIDES, {
    enabledModules: principal.enabledModules as ModuleKey[],
    practices,
    roles: principal.roles as Role[],
  });

  return (
    <Page>
      <PageHeader
        title="Wiki"
        subtitle="Wie in Pulse gearbeitet wird — die Abläufe als Anleitungen, nach ihrem Rhythmus geordnet."
      />
      <WikiHub guides={guides} roles={principal.roles as Role[]} />
    </Page>
  );
}
