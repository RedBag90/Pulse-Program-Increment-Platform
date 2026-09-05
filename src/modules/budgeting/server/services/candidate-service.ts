/**
 * PB-Listen-Kandidaten einer Kachel (Kachel-Modell). Ein Kandidat ist ein Epic ODER
 * eine Run-the-Business-Position. `valueStreamId`/`artId` werden denormalisiert
 * mitgeführt (für die VS-/ART-Ableitung). Kuratierung + RtB-Snapshot nur in
 * `draft`; ab `running` eingefroren.
 */

import type { Prisma } from "@/generated/prisma";
import type { RequestContext } from "@/server/http/mutation-handler";
import { withAuditedTransaction, toMutationContext } from "@/modules/core/kernel/server/mutation";
import { ok, err, type Result } from "@/modules/core/kernel/domain/errors";
import { InitiativeLevel } from "@/modules/core/kernel/domain/types";
import {
  classifyEpic,
  derivePbInfo,
  isPbEligible,
  type EpicClassState,
} from "@/modules/work/domain/pb-submission";
import { loadDefaultHypothesisEffort } from "@/modules/budgeting/server/services/pb-list";
import { rtbCycleAmount } from "@/modules/budgeting/domain/rtb-interval";

/**
 * Materialisiert die **RtB**-Kandidaten einer Kachel — **eine Zeile je
 * Wertstrom** (beim Start, in derselben tx).
 *
 * Ein Wertstrom beantragt sein Run-the-Business-Budget als **eine** Summe:
 * Betrieb und die ART-Epic-Budgets seiner ARTs zusammen. Vorher stand jede
 * Position einzeln auf der PB-Liste — zwölf bis fünfzehn Zeilen, über die eine
 * Gruppe einzeln entscheiden musste, obwohl die Entscheidung eine ist.
 *
 * Wie sich der Zuspruch danach auf die Positionen verteilt, entscheidet der
 * Wertstrom selbst (`RtbItemAward`). Daraus entsteht auch der Topf, den ein ART
 * auf seine ART-Epics verteilen darf — die Runde legt die Summe fest, der
 * Wertstrom den Anteil, der ART die Verwendung.
 *
 * Der Ask ist der Betrag **einer** Kachel — eine Kachel deckt ein Halbjahr ab,
 * die Position trägt aber ihre eigene Periode. `rtbCycleAmount` ist die einzige
 * Stelle, die daraus rechnet.
 *
 * Idempotent je (roundId, valueStreamId). Nicht über `roundId_rtbItemId`, denn
 * die Sammelzeile trägt keinen: mehrere NULLs sind im Unique-Index erlaubt, ein
 * Upsert darauf träfe nie. Die Eindeutigkeit liegt deshalb im Service — dasselbe
 * Muster wie bei `GroupAllocation`.
 */
export async function materializeRtbCandidates(
  tx: Prisma.TransactionClient,
  tenantId: string,
  roundId: string,
  actorId: string,
): Promise<void> {
  const [items, valueStreams] = await Promise.all([
    tx.runTheBusinessItem.findMany({
      where: { tenantId, active: true },
      select: { plannedAmount: true, interval: true, valueStreamId: true },
    }),
    tx.valueStream.findMany({
      where: { tenantId, deletedAt: null },
      select: { id: true, name: true },
    }),
  ]);

  const askByValueStream = new Map<string, number>();
  for (const it of items) {
    const cycle = rtbCycleAmount(Number(it.plannedAmount), it.interval);
    askByValueStream.set(it.valueStreamId, (askByValueStream.get(it.valueStreamId) ?? 0) + cycle);
  }

  for (const vs of valueStreams) {
    const ask = askByValueStream.get(vs.id);
    // Ein Wertstrom ohne aktive Positionen beantragt nichts — eine 0-Zeile wäre
    // ein Antrag über nichts, kein fehlender Antrag.
    if (ask == null) continue;

    const data = {
      title: vs.name,
      ask,
      valueStreamId: vs.id,
      // Die Sammelzeile gehört dem Wertstrom, keinem einzelnen ART.
      artId: null,
      updatedBy: actorId,
    };
    const existing = await tx.budgetCandidate.findFirst({
      where: { tenantId, roundId, kind: "rtb", valueStreamId: vs.id },
      select: { id: true },
    });
    if (existing) {
      await tx.budgetCandidate.update({ where: { id: existing.id }, data });
    } else {
      await tx.budgetCandidate.create({
        data: { ...data, kind: "rtb", tenantId, roundId, rtbItemId: null, createdBy: actorId },
      });
    }
  }
}

/** Fügt ein Epic als PB-Listen-Kandidat zu dieser Kachel hinzu (Kuratierung). */
/**
 * Was der Aufrufer beisteuern muss, damit die Einordnung entschieden werden kann.
 *
 * Ein **Port**, kein Import: die Grundlage stammt aus `work` (Practice-Schalter
 * und Portfolio-Limits) und wurde vorher mitten in der Transaktion geladen —
 * mit zwei `tx as unknown as PrismaClient`-Casts, weil die fremden Loader einen
 * vollen Client erwarten. Fremdes Prisma hielt damit Budgetings Transaktion
 * offen, und getestet war es auf **keiner** Seite der Naht.
 *
 * Jetzt beschafft der Aufrufer sie **vor** der Transaktion. Zwei Adapter
 * rechtfertigen die Naht: die Action reicht die echten Loader herein, ein Test
 * reicht Zahlen herein.
 */
export interface ClassificationBasis {
  /** Ist die Practice `artEpics` aktiv? Ohne sie gibt es die Trennung nicht. */
  artEpicsPractice: boolean;
  /** Das Portfolio-Limit dieses Wertstroms — geerbt, wo keines gesetzt ist. */
  thresholdFor: (valueStreamId: string | null) => number;
}

/**
 * Ist dieses Epic ein ART-Epic? Dann gehört es nicht auf die PB-Liste.
 *
 * Nur wirksam, wenn die Practice `artEpics` läuft — ohne sie gibt es die
 * Trennung nicht, und jedes Epic geht über die PB-Liste.
 *
 * `null` = in Ordnung.
 */
function assertNotArtEpic(
  basis: ClassificationBasis,
  epic: EpicClassState & { valueStreamId: string | null; title: string },
): Result<never> | null {
  if (!basis.artEpicsPractice) return null;
  if (classifyEpic(epic, basis.thresholdFor(epic.valueStreamId)).epicClass !== "art") return null;
  return err({
    kind: "conflict" as const,
    reason:
      `„${epic.title}" ist ein ART-Epic und wird aus dem ART-Epic-Budget seines ARTs ` +
      "finanziert — es steht deshalb nicht auf der PB-Liste.",
  });
}

export async function addEpicCandidate(
  ctx: RequestContext,
  input: { roundId: string; epicId: string },
  basis: ClassificationBasis,
): Promise<Result<{ id: string }>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    const round = await tx.budgetRound.findFirst({
      where: { id: input.roundId, tenantId: mctx.tenantId },
      select: { status: true },
    });
    if (!round)
      return err({ kind: "not_found" as const, resourceType: "BudgetRound", id: input.roundId });
    if (round.status !== "draft") {
      return err({
        kind: "conflict" as const,
        reason: "Die PB-Liste ist nur im Status draft kuratierbar.",
      });
    }

    const epic = await tx.initiative.findFirst({
      where: {
        id: input.epicId,
        tenantId: mctx.tenantId,
        level: InitiativeLevel.EPIC,
        deletedAt: null,
      },
      select: {
        id: true,
        title: true,
        valueStreamId: true,
        artId: true,
        businessCase: true,
        benefitHypothesis: true,
        businessCaseApprovedAt: true,
        hypothesisApprovedAt: true,
        // Für die Einordnung (REQ-18): ein bewusst zur Portfolio-Sache
        // erklärtes Epic bleibt Portfolio-Epic, egal wie klein es ist.
        portfolioOverrideAt: true,
      },
    });
    if (!epic)
      return err({ kind: "not_found" as const, resourceType: "Initiative", id: input.epicId });
    if (!isPbEligible(epic)) {
      return err({
        kind: "conflict" as const,
        reason:
          "Epic ist noch nicht budgeting-reif — es braucht eine freigegebene Benefit-Hypothese oder einen freigegebenen Lean Business Case.",
      });
    }

    // Ein Epic gehört in **genau eine** Quelle. Ein ART-Epic wird aus dem
    // ART-Epic-Budget seines ARTs finanziert und hat auf der PB-Liste nichts zu
    // suchen — stünde es auf beiden, überschriebe die zuletzt geschriebene
    // Zuteilung die andere (`mergeEpicAllocation` setzt, statt zu addieren),
    // und Gate-Prüfung und Wertstrom-Tabelle sähen verschiedene Zahlen.
    const denied = assertNotArtEpic(basis, epic);
    if (denied) return denied;

    // Kosten-Richtwert aus den Artefakten ableiten (LBC → Σ costSlices; sonst
    // Hypothese → tenant-Default-Aufwand).
    const defaultEffort = await loadDefaultHypothesisEffort(tx, mctx.tenantId);
    const data = {
      kind: "epic",
      title: epic.title,
      ask: derivePbInfo(epic, defaultEffort).cost,
      valueStreamId: epic.valueStreamId,
      artId: epic.artId,
      updatedBy: mctx.actorId,
    };
    const row = await tx.budgetCandidate.upsert({
      where: { roundId_epicId: { roundId: input.roundId, epicId: input.epicId } },
      update: data,
      create: {
        ...data,
        tenantId: mctx.tenantId,
        roundId: input.roundId,
        epicId: input.epicId,
        createdBy: mctx.actorId,
      },
      select: { id: true },
    });

    return ok({
      result: { id: row.id },
      audit: {
        action: "budget.candidate.curated" as const,
        resourceType: "budget_candidate" as const,
        resourceId: row.id,
        changes: { epicId: { before: null, after: input.epicId } },
      },
    });
  });
}

/** Entfernt einen Kandidaten aus der PB-Liste dieser Kachel (nur in `draft`). */
export async function removeCandidate(
  ctx: RequestContext,
  input: { id: string },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    const row = await tx.budgetCandidate.findFirst({
      where: { id: input.id, tenantId: mctx.tenantId },
      select: { id: true, round: { select: { status: true } } },
    });
    if (!row)
      return err({ kind: "not_found" as const, resourceType: "BudgetCandidate", id: input.id });
    if (row.round.status !== "draft") {
      return err({
        kind: "conflict" as const,
        reason: "Die PB-Liste ist nur im Status draft kuratierbar.",
      });
    }
    await tx.budgetCandidate.delete({ where: { id: input.id } });
    return ok({
      result: undefined,
      audit: {
        action: "budget.candidate.removed" as const,
        resourceType: "budget_candidate" as const,
        resourceId: input.id,
        changes: {},
      },
    });
  });
}
