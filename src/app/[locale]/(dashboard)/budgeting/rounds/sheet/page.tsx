import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { loadRoundSetup } from "@/modules/budgeting/server/views/round-view";
import { BallotSheets } from "@/modules/budgeting/features/components/round/ballot-sheets";
import { Page, PageHeader } from "@/components/layout";
import { Link } from "@/i18n/navigation";
import { redirect } from "next/navigation";

/**
 * Verteilbögen (F-B3) — druckbare Bögen je Gruppe für die unabhängige
 * Verteilung. Eigene Route (kein Nav-Eintrag) mit Deep-Link aus der Runde.
 */
export default async function BallotSheetPage() {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const model = await loadRoundSetup(db, principal);

  return (
    <Page>
      <div className="print:hidden">
        <PageHeader
          eyebrow="Participatory Budgeting"
          title="Verteilbögen"
          subtitle="Ein druckbarer Bogen je Gruppe — Ballot-Epics, Kosten und verteilbarer Topf."
          actions={
            <Link
              href="/budgeting/rounds"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Zurück zur Runde
            </Link>
          }
        />
      </div>
      <BallotSheets model={model} />
    </Page>
  );
}
