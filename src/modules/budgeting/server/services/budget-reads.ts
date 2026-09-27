/**
 * **Ein Lader je Gegenstand** (REQ-5 der Konsolidierungs-Spec).
 *
 * Drei Tabellen werden auf jeder Budget-Fläche mehrfach gelesen — der
 * Budget-Kandidat bis zu **sechsmal** je Seitenaufruf, jedes Mal mit einem
 * anderen `where` und einem anderen `select`, jedes Mal eine eigene Rundreise.
 * Und die Rundreise ist der Treiber: die schwerste dieser Abfragen läuft in
 * 0,26 ms, die Reise nach `eu-west-1` dauert 40–95 ms.
 *
 * Hier steht deshalb je Gegenstand **ein** Lader, `cache()`-gewickelt und
 * **mandantenweit**. Die Aufrufer schneiden im Speicher zu.
 *
 * **Warum mandantenweit und nicht je Wertstrom** — dieselbe Begründung, die
 * `getValueStreamBudgets` (`budgeting.ts:213`) für sich schon führt: ein engerer
 * Schnitt macht den Lader unteilbar. Die ART-Liste liest über Wertströme
 * hinweg; `loadArtBudgetDetail` filtert nur nach `artId`, ohne Wertstrom. Ein
 * wertstromweiter Lader müsste sich darauf verlassen, dass ein Kandidat immer
 * den Wertstrom seines ARTs trägt — heute stimmt das (gemessen: 0 Abweichungen
 * auf 254 Zeilen), aber es ist nirgends erzwungen. Mandantenweit braucht es die
 * Annahme gar nicht.
 *
 * Die Menge trägt das: im grössten Bestand stehen 282 Kandidaten, 18
 * Betriebspositionen und rund 90 Zusprüche **je Mandant**.
 *
 * **Die Falle, und warum die Signaturen hier festgezurrt sind:** `react.cache`
 * dedupliziert nur bei **identischen** Argumenten. Ein Lader, den einer mit
 * `cycleKey` und ein anderer ohne ruft, dedupliziert nicht — er verdoppelt. Die
 * Argumente sind deshalb überall `(db, tenantId)` und **nichts sonst**; alles
 * Weitere ist Sache des Aufrufers.
 *
 * Und: ausserhalb eines React-Requests greift `cache()` **nicht** (jeder Aufruf
 * ist ein Fehlschlag). Skripte und Tests sehen die Deduplizierung also nicht —
 * gemessen wird am laufenden Server mit `PRISMA_DEBUG=1`.
 */

import { cache } from "react";
import type { PrismaClient } from "@/generated/prisma";
import type { TenantId } from "@/modules/core/kernel/domain/types";

// ---------------------------------------------------------------------------
// BudgetCandidate
// ---------------------------------------------------------------------------

/**
 * Eine Kandidatenzeile in der Form, die **alle** Leser zusammen brauchen —
 * Vereinigung der sechs bisherigen `select`s, mit dem Halbjahr der Kachel schon
 * flachgezogen und den Decimals schon in Zahlen. Jeder Aufrufer rechnete
 * `Number(...)` ohnehin; einmal reicht.
 */
export interface CandidateRead {
  id: string;
  /** `"epic"` = Epic-Zuteilung, `"rtb"` = Run-the-Business-Zuspruch. */
  kind: string;
  epicId: string | null;
  artId: string | null;
  valueStreamId: string | null;
  rtbItemId: string | null;
  title: string;
  ask: number;
  /** `null`, solange die Kachel nicht festgeschrieben ist. */
  finalAmount: number | null;
  roundId: string;
  /** Das Halbjahr der Kachel — flachgezogen aus `round`. */
  cycleKey: string;
  /** `"closed"`, wenn die Kachel abgeschlossen ist. */
  roundStatus: string;
}

/** Der Ausschnitt des Clients, den dieser Lader braucht. */
export type CandidateReader = Pick<PrismaClient, "budgetCandidate">;

/** **Alle** Budget-Kandidaten des Mandanten, beide Sorten. */
export const readBudgetCandidates = cache(async function readBudgetCandidates(
  db: CandidateReader,
  tenantId: TenantId,
): Promise<CandidateRead[]> {
  const rows = await db.budgetCandidate.findMany({
    where: { tenantId },
    select: {
      id: true,
      kind: true,
      epicId: true,
      artId: true,
      valueStreamId: true,
      rtbItemId: true,
      title: true,
      ask: true,
      finalAmount: true,
      roundId: true,
      round: { select: { cycleKey: true, status: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    epicId: r.epicId,
    artId: r.artId,
    valueStreamId: r.valueStreamId,
    rtbItemId: r.rtbItemId,
    title: r.title,
    ask: Number(r.ask),
    finalAmount: r.finalAmount == null ? null : Number(r.finalAmount),
    roundId: r.roundId,
    cycleKey: r.round.cycleKey,
    roundStatus: r.round.status,
  }));
});

// ---------------------------------------------------------------------------
// RunTheBusinessItem
// ---------------------------------------------------------------------------

/** Eine Betriebsposition — die Vereinigung der drei bisherigen `select`s. */
export interface RtbItemRead {
  id: string;
  name: string;
  /** `"run"` = Betrieb, `"art_change"` = ART-Rahmen (`rtb-kind.ts`). */
  kind: string;
  artId: string | null;
  solutionId: string | null;
  valueStreamId: string;
  plannedAmount: number;
  interval: string;
  active: boolean;
}

export type RtbItemReader = Pick<PrismaClient, "runTheBusinessItem">;

/**
 * **Alle** Betriebspositionen des Mandanten — auch die stillgelegten. Wer nur
 * die aktiven will, filtert selbst: die Solutions-Liste zählt auch die
 * abgeschalteten, der Zuspruch nicht.
 */
export const readRtbItems = cache(async function readRtbItems(
  db: RtbItemReader,
  tenantId: TenantId,
): Promise<RtbItemRead[]> {
  const rows = await db.runTheBusinessItem.findMany({
    where: { tenantId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      kind: true,
      artId: true,
      solutionId: true,
      valueStreamId: true,
      plannedAmount: true,
      interval: true,
      active: true,
    },
  });
  return rows.map((r) => ({ ...r, plannedAmount: Number(r.plannedAmount) }));
});

// ---------------------------------------------------------------------------
// RtbItemAward
// ---------------------------------------------------------------------------

/**
 * Ein Zuspruch an eine Betriebsposition, je Halbjahr.
 *
 * **Ohne** die Position daran: wer wissen will, zu welchem ART ein Zuspruch
 * gehört, verbindet ihn mit `readRtbItems` — beides ist ohnehin schon geladen,
 * und der Lader bleibt eine Form statt zweier.
 */
export interface RtbAwardRead {
  rtbItemId: string;
  cycleKey: string;
  amount: number;
}

export type RtbAwardReader = Pick<PrismaClient, "rtbItemAward">;

/** **Alle** Zusprüche des Mandanten, über alle Halbjahre. */
export const readRtbAwards = cache(async function readRtbAwards(
  db: RtbAwardReader,
  tenantId: TenantId,
): Promise<RtbAwardRead[]> {
  const rows = await db.rtbItemAward.findMany({
    where: { tenantId },
    select: { rtbItemId: true, cycleKey: true, amount: true },
  });
  return rows.map((r) => ({
    rtbItemId: r.rtbItemId,
    cycleKey: r.cycleKey,
    amount: Number(r.amount),
  }));
});

// ---------------------------------------------------------------------------
// Solution
// ---------------------------------------------------------------------------

/**
 * Eine Solution, soweit das Geld sie braucht.
 *
 * **`artId` ist der Grund, warum sie hier steht:** über ihn löst sich eine
 * Betriebsposition auf ein ART auf (`rtb-art-resolution.ts`). Vorher las die
 * Wertstromseite Solutions nur für das Auswahlfeld der Positionen — Name und
 * Id, ohne ART.
 */
export interface SolutionRead {
  id: string;
  name: string;
  artId: string | null;
  valueStreamId: string;
}

export type SolutionReader = Pick<PrismaClient, "solution">;

/** Alle nicht gelöschten Solutions des Mandanten. */
export const readSolutions = cache(async function readSolutions(
  db: SolutionReader,
  tenantId: TenantId,
): Promise<SolutionRead[]> {
  return db.solution.findMany({
    where: { tenantId, deletedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true, artId: true, valueStreamId: true },
  });
});

// ---------------------------------------------------------------------------
// ArtEpicAllocation · ArtOwnWorkAllocation
// ---------------------------------------------------------------------------

/**
 * Was ein ART aus seinem Rahmen weitergegeben hat — an ein Epic oder an
 * ART-eigene Arbeit —, je Halbjahr.
 *
 * Beide Tabellen wurden auf dem ART-Reiter bis zu sechsmal gelesen, jede
 * Lesung mit eigenem `where` (ein ART, ein Halbjahr, ein Epic). Mandantenweit
 * sind es wenige Hundert Zeilen; einmal reicht.
 */
export interface ArtAllocationRead {
  artId: string;
  cycleKey: string;
  amount: number;
  /** Richtwert, eingefroren beim ersten Zuteilen. */
  ask: number;
  /** Nur bei Epic-Zuteilungen gesetzt. */
  epicId: string | null;
}

/** **Alle** Zuteilungen an ART-Epics, über alle Halbjahre. */
export const readArtEpicAllocations = cache(async function readArtEpicAllocations(
  db: Pick<PrismaClient, "artEpicAllocation">,
  tenantId: TenantId,
): Promise<ArtAllocationRead[]> {
  const rows = await db.artEpicAllocation.findMany({
    where: { tenantId },
    select: { artId: true, cycleKey: true, amount: true, ask: true, epicId: true },
  });
  return rows.map((r) => ({ ...r, amount: Number(r.amount), ask: Number(r.ask) }));
});

/** **Alle** Reservierungen für ART-eigene Arbeit, über alle Halbjahre. */
export const readArtOwnWork = cache(async function readArtOwnWork(
  db: Pick<PrismaClient, "artOwnWorkAllocation">,
  tenantId: TenantId,
): Promise<ArtAllocationRead[]> {
  const rows = await db.artOwnWorkAllocation.findMany({
    where: { tenantId },
    select: { artId: true, cycleKey: true, amount: true, ask: true },
  });
  return rows.map((r) => ({ ...r, amount: Number(r.amount), ask: Number(r.ask), epicId: null }));
});

// ---------------------------------------------------------------------------
// Art
// ---------------------------------------------------------------------------

/**
 * Ein ART, soweit das Geld ihn braucht — **auch die gelöschten**: wer nur Namen
 * auflöst, soll den eines seither gelöschten ARTs zeigen; wer zählt, filtert
 * `deletedAt` selbst.
 *
 * Der ART-Reiter las die ARTs seines Wertstroms bis September 2026 dreimal
 * (Finanzierungskette, Business Case, Deckung) und dazu alle ARTs des
 * Mandanten für die Namen.
 */
export interface ArtRead {
  id: string;
  name: string;
  valueStreamId: string;
  deletedAt: Date | null;
}

/** **Alle** ARTs des Mandanten, nach Namen. */
export const readArts = cache(async function readArts(
  db: Pick<PrismaClient, "art">,
  tenantId: TenantId,
): Promise<ArtRead[]> {
  return db.art.findMany({
    where: { tenantId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, valueStreamId: true, deletedAt: true },
  });
});

/** Die lebenden ARTs eines Wertstroms, nach Namen. */
export async function readValueStreamArts(
  db: Pick<PrismaClient, "art">,
  tenantId: TenantId,
  valueStreamId: string,
): Promise<ArtRead[]> {
  return (await readArts(db, tenantId)).filter(
    (a) => a.valueStreamId === valueStreamId && a.deletedAt == null,
  );
}
