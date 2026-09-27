import type { Prisma } from "@/generated/prisma";
import type { MutationContext } from "@/modules/core/kernel/server/mutation";
import { emitAuditEvent } from "@/server/audit/emit";
import { actualWsjf } from "@/modules/drumbeat/domain/pi-feedback";

/**
 * **Den bestätigten Business Value an ein Feature schreiben** — der Ist-Wert
 * und der WSJF mit Ist-Wert, dazu ein Eintrag in der Historie des Features.
 *
 * Eigene Datei, weil sie als einzige im PI-Feedback ein Feature schreibt: der
 * Wächter des Planungs-Tors (`planning-gate-guard.test.ts`) sucht Dateien, die
 * Features schreiben und dabei ein PI nennen. Die Runden-Logik nennt PIs, fasst
 * aber keine Feature-Zeile an; hier ist es umgekehrt.
 */
export async function writeBvActual(
  tx: Prisma.TransactionClient,
  mctx: MutationContext,
  feature: {
    id: string;
    wsjfBusinessValueActual: number | null;
    wsjfTimeCriticality: number | null;
    wsjfRiskReduction: number | null;
    wsjfJobSize: number | null;
  },
  businessValue: number,
): Promise<void> {
  await tx.initiative.update({
    where: { id: feature.id },
    data: {
      wsjfBusinessValueActual: businessValue,
      wsjfComputedActual: actualWsjf(feature, businessValue),
    },
  });
  await emitAuditEvent(tx, {
    tenantId: mctx.tenantId,
    actorId: mctx.actorId,
    action: "initiative.bv_actual.applied",
    resourceType: "initiative",
    resourceId: feature.id,
    changes: {
      wsjfBusinessValueActual: { before: feature.wsjfBusinessValueActual, after: businessValue },
    },
    ipAddress: mctx.ipAddress,
    userAgent: mctx.userAgent,
  });
}
