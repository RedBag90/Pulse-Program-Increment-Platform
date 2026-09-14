import type { Prisma, PrismaClient } from "@/generated/prisma";
import type { TenantId, EpicId } from "@/modules/core/kernel/domain/types";
import { parsePeriodAmountMap } from "@/modules/budgeting/domain/budgeting";
import { sumPeriods } from "@/modules/budgeting/domain/period-map";
import { appliedPeriod } from "@/modules/budgeting/domain/period-validity";
import {
  chooseAllocations,
  type EpicClassLike,
} from "@/modules/work/domain/epic-allocation-choice";
import {
  epicBudgetStanding,
  type EpicBudgetStanding,
} from "@/modules/budgeting/domain/epic-budget-standing";

/**
 * The Epic's budget-allocation summary. Budgeting owns the `budgetAllocation`
 * table; the Epic route consumes this via a port so Work never reads it directly
 * (ADR-0013). `allocatedSum` is the total of the per-period allocations — the
 * Budget-Panel des Overview-Reiters zeigt den Zustand, wenn er > 0 ist.
 * `allocatedByPeriod`
 * carries the per-half-year map (`"YYYY-H1|H2" → €`) for the cost-over-time
 * calculation (Business-case-calculation tab).
 */
export async function getEpicBudgetAllocation(
  db: PrismaClient,
  tenantId: TenantId,
  epicId: EpicId,
): Promise<{ allocatedSum: number; allocatedByPeriod: Record<string, number> } | null> {
  const row = await db.budgetAllocation.findUnique({
    where: { epicId },
    select: { allocations: true, tenantId: true },
  });
  // Tenant-scope defensively — findUnique is by epicId (globally unique), so a
  // cross-tenant epicId must not leak an allocation.
  if (!row || row.tenantId !== tenantId) return null;
  // Parse + sum via the module's shared period-map primitives, so malformed
  // cells are dropped consistently rather than hand-checked here.
  const allocatedByPeriod = parsePeriodAmountMap(row.allocations);
  return { allocatedSum: sumPeriods(allocatedByPeriod), allocatedByPeriod };
}

export interface AppliedCycleAllocations {
  /** `null` = es gilt gerade kein Budget-Rahmen. */
  cycleKey: string | null;
  byEpic: Record<string, number>;
  /** Der Zeitraum ist abgelaufen; die Kachel gilt weiter, bis die nächste beginnt. */
  extended: boolean;
}

/**
 * Pro Epic der Allokationsbetrag des **angewandten** Budget-Zyklus — der
 * Kachel, deren Zeitraum den heutigen Tag abdeckt und die finalisiert ist
 * (`appliedPeriod`).
 *
 * **Nicht** die Kachel, an der gerade gearbeitet wird.** Genau diese
 * Verwechslung stand hier bis September 2026: `activeCycleFromRounds` liefert
 * die Kachel mit `status === "running"`, also die in Phase 5 „Verteilen". In
 * Large Test Corp war das eine Kachel, deren Zeitraum erst vier Monate später
 * beginnt und die kein Geld trägt — der Horizont-Trichter der
 * Portfolio-Übersicht blieb deshalb leer, während die geltende Kachel 1,00 Mio €
 * führte. Wer wissen will, *woran gearbeitet wird*, fragt weiterhin
 * `activeCycleFromRounds`; wer Geld **misst**, fragt hier.
 *
 * Speist die Horizont-Budget-Zeilen des Portfolio-Kanbans über den
 * `BudgetingDataPort` (ADR-0013: Work liest die `budgetAllocation`-Tabelle nie
 * direkt). Nur Nicht-Null-Beträge landen in `byEpic`.
 */
export async function getEpicCycleAllocations(
  db: PrismaClient,
  tenantId: TenantId,
  now: Date,
): Promise<AppliedCycleAllocations> {
  const [rounds, rows] = await Promise.all([
    db.budgetRound.findMany({
      where: { tenantId },
      select: { id: true, cycleKey: true, status: true, startDate: true, endDate: true },
    }),
    db.budgetAllocation.findMany({
      where: { tenantId },
      select: { epicId: true, allocations: true },
    }),
  ]);
  const applied = appliedPeriod(rounds, now);
  if (!applied) return { cycleKey: null, byEpic: {}, extended: false };

  const cycleKey = rounds.find((r) => r.id === applied.period.id)!.cycleKey;
  const byEpic: Record<string, number> = {};
  for (const row of rows) {
    const amount = parsePeriodAmountMap(row.allocations)[cycleKey] ?? 0;
    if (amount !== 0) byEpic[row.epicId] = amount;
  }
  return { cycleKey, byEpic, extended: applied.extended };
}

/**
 * Die **vollständige** Halbjahres-Karte je Epic (`epicId → { "YYYY-H1": €, … }`).
 *
 * Der Bruder von `getEpicCycleAllocations`, aber über alle Halbjahre statt nur
 * dem laufenden: das Portfolio-Dashboard zeichnet eine Kostenkurve über die
 * Zeit und braucht deshalb die ganze Reihe, nicht den Stand eines Zyklus.
 *
 * Ohne diesen Port las `work` die Tabelle selbst — auf einer Fläche, die kein
 * Budgeting-Entitlement prüft. Der Port macht den Zugriff sichtbar und
 * abschaltbar: der Composition-Root reicht ihn nur herein, wenn der Mandant
 * Budgeting lizenziert hat.
 *
 * Epics ohne Zuteilung fehlen in der Karte — ein leerer Eintrag und ein
 * fehlender sind dasselbe, und zwei Darstellungen desselben Zustands laufen
 * auseinander.
 */
export async function getEpicAllocationMaps(
  db: PrismaClient,
  tenantId: TenantId,
): Promise<Record<string, Record<string, number>>> {
  const rows = await db.budgetAllocation.findMany({
    where: { tenantId },
    select: { epicId: true, allocations: true },
  });
  const out: Record<string, Record<string, number>> = {};
  for (const row of rows) {
    const map = parsePeriodAmountMap(row.allocations);
    if (Object.keys(map).length > 0) out[row.epicId] = map;
  }
  return out;
}

/**
 * Schreibt den Betrag **eines** Halbjahres in die Zyklus-Karte eines Epics und
 * lässt alle übrigen Zellen stehen.
 *
 * `BudgetAllocation.allocations` ist eine Fortschreibung über alle Halbjahre, in
 * denen das Epic je Geld bekommen hat — nicht der Stand einer Runde. Wer sie
 * schreibt, muss deshalb lesen, die eigene Zelle setzen und den Rest
 * unangetastet zurückschreiben.
 *
 * Bis hierher gab es genau einen Schreiber (die Finalisierung einer Kachel), und
 * die Regel stand inline in ihr. Sie bekommt einen zweiten — die Verteilung des
 * ART-Rahmens —, und zwei Kopien derselben Read-Modify-Write-Regel liefen
 * unweigerlich auseinander. Deshalb hier, an derselben Stelle wie die Leser.
 *
 * Verhalten bewusst unverändert: ein Betrag von 0 schreibt eine 0-Zelle, statt
 * sie zu entfernen — der zweite Schreiber wird das anders brauchen und bekommt
 * dann einen ausdrücklichen Schalter, keine stille Änderung für beide.
 */
/**
 * Aus **welchem der beiden Geldwege** der Betrag stammt. Ein Epic gehört in **genau eine** Quelle (REQ-18);
 * das Argument macht eine Verletzung sichtbar, statt sie stumm zu überschreiben.
 */
export type FundingSource = "pb_list" | "art_epic_budget";

export async function mergeEpicAllocation(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: TenantId;
    /** Roher Fremdschlüssel aus derselben Transaktion — die Branded-Ids sichern
     *  Modulgrenzen ab, nicht diesen Aufruf. */
    epicId: string;
    cycleKey: string;
    amount: number;
    actorId: string;
    source: FundingSource;
  },
): Promise<void> {
  const existing = await tx.budgetAllocation.findUnique({
    where: { epicId: input.epicId },
    select: { allocations: true },
  });
  const allocations = parsePeriodAmountMap(existing?.allocations);

  // Der Sicherheitsgurt zu REQ-18: die Zuständigkeit wird eine Ebene höher
  // entschieden (ein ART-Epic kommt nicht auf die PB-Liste, ein Kandidat nicht
  // in die Verteilliste). Kippt die Einordnung trotzdem — etwa weil die
  // Kostenschätzung unter das Limit rutscht —, überschriebe die zweite Quelle
  // hier lautlos die erste. Deshalb: laut melden, dann schreiben.
  const previous = allocations[input.cycleKey];
  if (previous != null && previous !== input.amount && previous > 0) {
    console.warn(
      `[budgeting] Zuteilung überschrieben: Epic ${input.epicId} · ${input.cycleKey} · ` +
        `${previous} € → ${input.amount} € (Quelle: ${input.source}). ` +
        "Ein Epic sollte nur aus einer Quelle finanziert werden (REQ-18).",
    );
  }

  allocations[input.cycleKey] = input.amount;
  const json = allocations as unknown as Prisma.InputJsonValue;

  await tx.budgetAllocation.upsert({
    where: { epicId: input.epicId },
    update: { allocations: json, updatedBy: input.actorId },
    create: {
      tenantId: input.tenantId,
      epicId: input.epicId,
      priority: 0,
      allocations: json,
      createdBy: input.actorId,
      updatedBy: input.actorId,
    },
  });
}

/**
 * **Habe ich Budget — und für wann?** Der Stand eines Epics, fertig gefaltet.
 *
 * Liest **beide** Töpfe: `BudgetAllocation` (Portfolio-Epics) und
 * `ArtEpicAllocation` (ART-Epics). Welcher zählt, entscheidet die Klasse des
 * Epics — nie eine Summe (`chooseAllocations`). Ohne den zweiten Topf sagte die
 * Fläche bei vier Epics in Pulse Demo Corp „kein Budget", obwohl ihnen 292 T€
 * zugeteilt sind; mit einer Summe verdoppelte sie in Large Test Corp jeden
 * Betrag, weil dort derselbe Euro in beiden Tabellen steht.
 *
 * Die Kacheln kommen mit, weil der Stand die **Geltung** braucht: „gilt jetzt"
 * ist etwas anderes als „zugeteilt, gilt ab" und als „Rahmen abgelaufen".
 */
export async function getEpicBudgetStanding(
  db: PrismaClient,
  tenantId: TenantId,
  epicId: EpicId,
  epicClass: EpicClassLike,
  now: Date,
): Promise<EpicBudgetStanding> {
  const [allocation, artRows, rounds] = await Promise.all([
    db.budgetAllocation.findUnique({
      where: { epicId },
      select: { allocations: true, tenantId: true },
    }),
    db.artEpicAllocation.findMany({
      where: { epicId, tenantId },
      select: { cycleKey: true, amount: true },
    }),
    db.budgetRound.findMany({
      where: { tenantId },
      select: { id: true, cycleKey: true, status: true, startDate: true, endDate: true },
    }),
  ]);

  // Tenant-scope defensiv — `findUnique` geht über die global eindeutige epicId.
  const portfolio =
    allocation && allocation.tenantId === tenantId
      ? parsePeriodAmountMap(allocation.allocations)
      : {};
  const art: Record<string, number> = {};
  for (const row of artRows) {
    art[row.cycleKey] = (art[row.cycleKey] ?? 0) + Number(row.amount);
  }

  return epicBudgetStanding({
    byCycle: chooseAllocations(portfolio, art, epicClass),
    rounds,
    now,
  });
}
