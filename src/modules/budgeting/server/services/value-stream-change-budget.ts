import type { PrismaClient } from "@/generated/prisma";
import type { TenantId } from "@/modules/core/kernel/domain/types";
import { loadChangeMoney } from "@/modules/budgeting/server/services/change-money";
import { readArts } from "@/modules/budgeting/server/services/budget-reads";

/**
 * **Das Veränderungsgeld eines Wertstroms in einer Budget-Kachel** — die
 * Gruppe „Veränderung" der ART-Budget-Übersicht (`domain/art-budget-origin.ts`),
 * summiert über die ARTs des Wertstroms, plus die Portfolio-Epics der Kachel.
 *
 *  - **portfolio** — Σ `finalAmount` der Epic-Kandidaten des Wertstroms in der
 *    Runde mit diesem `cycleKey`: das Geld von der Portfolio-Kachel.
 *  - **toEpics / toOwnWork / open** — der ART-Rahmen seiner ARTs: an ART-Epics
 *    vergeben, für ART-eigene Arbeit vergeben, noch nicht vergeben. Dieselbe
 *    Quelle wie die ART-Übersicht (`loadArtEpicBudgets`). `open` bleibt
 *    **ungekappt**: ein negativer Rest zeigt einen nachträglich gekürzten
 *    Rahmen, statt ihn zu verstecken.
 *
 * Die Zahlen kommen aus der Faltung des Veränderungsgeldes
 * (`domain/change-money.ts`), dieselbe Quelle wie ART-Reiter und Verteil-Matrix.
 *
 * Betrieb gehört nicht hinein — Veränderung und Betrieb stehen nie in einer
 * Summe (REQ-10).
 */
export interface ValueStreamChangeBudget {
  valueStreamId: string;
  name: string;
  portfolio: number;
  toEpics: number;
  toOwnWork: number;
  open: number;
}

export async function getValueStreamChangeBudgets(
  db: PrismaClient,
  tenantId: TenantId,
  cycleKey: string,
): Promise<ValueStreamChangeBudget[]> {
  const [streams, arts, money] = await Promise.all([
    db.valueStream.findMany({ where: { tenantId }, select: { id: true, name: true } }),
    readArts(db, tenantId).then((all) => all.filter((a) => a.deletedAt == null)),
    loadChangeMoney(db, tenantId),
  ]);
  return (
    streams
      .map((s) => {
        const artIds = arts.filter((a) => a.valueStreamId === s.id).map((a) => a.id);
        const { portfolio, toEpics, toOwnWork, open } = money.valueStream(s.id, artIds, cycleKey);
        return { valueStreamId: s.id, name: s.name, portfolio, toEpics, toOwnWork, open };
      })
      // Nur Wertströme mit Geld in dieser Kachel — auch solche nur mit Rahmen.
      .filter((r) => r.portfolio !== 0 || r.toEpics !== 0 || r.toOwnWork !== 0 || r.open !== 0)
  );
}
