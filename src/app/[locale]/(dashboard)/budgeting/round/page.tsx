import { Suspense } from "react";
import { requirePrincipal } from "@/server/auth/principal";
import { authorize, hasCapability } from "@/server/auth/authorize";
import { createPrismaClient } from "@/server/db/prisma";
import { loadBudgetingBoardModel } from "@/modules/budgeting/server/views/budgeting-board";
import { loadArtBudgetModel } from "@/modules/budgeting/server/views/art-budget-breakdown";
import { listBudgetingCandidates } from "@/modules/budgeting/server/services/budgeting";
import {
  loadProcessRailInputs,
  buildProcessRail,
} from "@/modules/budgeting/server/views/process-rail";
import { getLatestBudgetPlanRevision } from "@/modules/budgeting/server/services/budget-plan-revision";
import { listValueStreams } from "@/modules/core/org/server/services/value-stream";
import { halfYearLabel } from "@/modules/core/kernel/domain/calendar";
import {
  RoundWorkspace,
  type ArtByValueStream,
} from "@/modules/budgeting/features/components/round/round-workspace";
import { Page, PageHeader } from "@/components/layout";
import { Link } from "@/i18n/navigation";
import { redirect } from "next/navigation";
import type { ValueStreamId } from "@/modules/core/kernel/domain/types";

/**
 * Budget-Runde — die vereinte Arbeitsfläche des Budget-Zyklus: Topf & Epics
 * verteilen, Wertströme prüfen, auf ARTs herunterbrechen. Ersetzt das frühere
 * `/budgeting/board` (das hierhin redirectet). Gated wie zuvor per `budget.manage`.
 */
export default async function BudgetRoundPage() {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  if (!authorize("budget.manage", { tenantId: principal.tenantId }, principal).allow) {
    redirect("/budgeting");
  }

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  // Vormerken läuft über `epic.update` (Work); ohne das Recht keine Kandidaten.
  const canStage = hasCapability(principal, "epic.update", { tenantId: principal.tenantId });
  const canAdvance = hasCapability(principal, "budget.cycle.advance", {
    tenantId: principal.tenantId,
  });

  const [boardModel, valueStreams, candidates, railBase, latestRev] = await Promise.all([
    loadBudgetingBoardModel(db, principal.tenantId),
    listValueStreams(db, principal.tenantId),
    canStage ? listBudgetingCandidates(db, principal.tenantId) : Promise.resolve([]),
    loadProcessRailInputs(db, principal.tenantId),
    getLatestBudgetPlanRevision(db, principal.tenantId),
  ]);

  // Der aktive Zyklus ist der gespeicherte Anker (aus dem Board-Modell), nicht `now`.
  const activeCycle = boardModel.activeCycleKey;
  const snapshotCurrent = latestRev?.cycleKey === activeCycle;
  const railSteps = buildProcessRail({ ...railBase, latestIsCurrentCycle: snapshotCurrent });

  // Je Wertstrom sein ART-Breakdown + Editier-Recht (Finance-Approver oder
  // `art_budget.manage`; der Service prüft am Seam final nach).
  const artByVs: ArtByValueStream[] = await Promise.all(
    valueStreams.map(async (vs) => ({
      vsId: vs.id,
      name: vs.name,
      model: await loadArtBudgetModel(db, principal.tenantId, vs.id as ValueStreamId),
      canEdit:
        vs.financeApproverId === principal.id ||
        hasCapability(principal, "art_budget.manage", {
          tenantId: principal.tenantId,
          valueStreamId: vs.id,
        }),
    })),
  );

  const cycleLabel = halfYearLabel(activeCycle);

  return (
    <Page>
      <PageHeader
        eyebrow="Participatory Budgeting"
        title="Budget-Runde"
        subtitle="Topf verteilen, Wertströme prüfen, auf ARTs herunterbrechen — alles im aktiven Zyklus."
        actions={
          <Link
            href="/budgeting"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Übersicht
          </Link>
        }
      />

      <Suspense fallback={null}>
        <RoundWorkspace
          cycleLabel={cycleLabel}
          boardModel={boardModel}
          artByVs={artByVs}
          canManage
          candidates={candidates}
          railSteps={railSteps}
          snapshotCurrent={snapshotCurrent}
          canAdvance={canAdvance}
        />
      </Suspense>
    </Page>
  );
}
