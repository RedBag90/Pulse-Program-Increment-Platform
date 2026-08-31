import { notFound, redirect } from "next/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { loadGroupDistribution } from "@/modules/budgeting/server/views/group-distribution-view";
import { GroupDistribute } from "@/modules/budgeting/features/components/period/group-distribute";
import { Page, PageHeader } from "@/components/layout";
import { Link } from "@/i18n/navigation";

interface Props {
  params: Promise<{ id: string; groupId: string }>;
}

/**
 * Gruppen-Verteilseite: Gruppenmitglieder verteilen freie €-Beträge über die
 * Ballot-Kandidaten (Epics + Run-the-Business) bis zur Deadline; der Sprecher
 * reicht ein. Ziel des My-Tasks-Hinweises.
 */
export default async function GroupDistributePage({ params }: Props) {
  const { id, groupId } = await params;
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const model = await loadGroupDistribution(db, principal, id, groupId);
  if (!model) notFound();

  return (
    <Page>
      <PageHeader
        eyebrow="Participatory Budgeting"
        title="Budget verteilen"
        subtitle="Verteile den Topf auf die angemeldeten Positionen — Summe ≤ verteilbarer Topf."
        actions={
          <Link
            // Zurück auf die Verteilung, nicht auf „Setup": von dort kam man
            // her, und dort steht die eigene Abgabe im Zusammenhang.
            href={`/budgeting/periods/${id}?tab=verteilung`}
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Zur Verteilung
          </Link>
        }
      />
      <GroupDistribute model={model} />
    </Page>
  );
}
