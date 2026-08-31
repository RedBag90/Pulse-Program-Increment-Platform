import { redirect } from "next/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { hasCapability } from "@/server/auth/authorize";
import { listValueStreams } from "@/modules/core/org/server/services/value-stream";
import { listRtbItems } from "@/modules/budgeting/server/services/rtb-item-service";
import { RtbSection } from "@/modules/budgeting/features/components/rtb/rtb-section";
import { SectionLabel } from "@/components/ui/section-label";
import { Page, PageHeader } from "@/components/layout";

/**
 * Zentrale Run-the-Business-Verwaltung: je Value Stream die stehenden
 * Betriebskosten-Positionen, jede mit eigener Periode und optionaler
 * Solution-Zurechnung. Editierbar für VS-Owner/Finance/Admin (sonst read-only).
 * Aktive Positionen fließen als Ballot-Kandidaten in jede gestartete
 * Budgeting-Kachel.
 */
export default async function RunTheBusinessPage() {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const valueStreams = await listValueStreams(db, principal.tenantId);

  // Zuordenbare Solutions je Wertstrom — die Zurechnung bleibt innerhalb des
  // Wertstroms, weil dort auch das Budget verantwortet wird.
  const solutions = await db.solution.findMany({
    where: { tenantId: principal.tenantId, deletedAt: null },
    select: { id: true, name: true, valueStreamId: true },
    orderBy: { name: "asc" },
  });

  const sections = await Promise.all(
    valueStreams.map(async (vs) => ({
      id: vs.id,
      name: vs.name,
      items: await listRtbItems(db, principal.tenantId, { valueStreamId: vs.id }),
      solutions: solutions
        .filter((s) => s.valueStreamId === vs.id)
        .map((s) => ({ id: s.id, name: s.name })),
      canManage:
        vs.financeApproverId === principal.id ||
        hasCapability(principal, "rtb_item.manage", {
          tenantId: principal.tenantId,
          valueStreamId: vs.id,
        }),
    })),
  );

  return (
    <Page>
      <PageHeader
        eyebrow="Participatory Budgeting"
        title="Run the Business"
        subtitle="Stehende Betriebskosten (Keep the lights on) je Value Stream. Jede Position hat eine eigene Periode und kann einer Solution zugerechnet werden; aktive Positionen kommen als Ballot-Kandidaten in jede gestartete Budgeting-Kachel."
      />

      {sections.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed bg-muted/30 px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">Noch keine Value Streams.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {sections.map((s) => (
            <section key={s.id} className="space-y-2">
              <SectionLabel>{s.name}</SectionLabel>
              <RtbSection
                valueStreamId={s.id}
                items={s.items}
                canManage={s.canManage}
                solutions={s.solutions}
              />
            </section>
          ))}
        </div>
      )}
    </Page>
  );
}
