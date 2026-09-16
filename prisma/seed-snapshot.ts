/**
 * Der **ART-Block** einer geseedeten Budget-Plan-Revision.
 *
 * Eine Revision ist ein eingefrorener Beleg: „so stand es, als entschieden
 * wurde". Die drei Seeds bauten ihn bis hierher zur Hälfte selbst — sie
 * übergaben `features: []` und schrieben das ART-Budget als Formel
 * (`130_000 + i * 12_000`). Damit zeigte die Fläche „Budget vs. Demand je
 * Halbjahr" eine Bedarfszeile aus lauter „—" neben einer Budgetzeile, die mit
 * den Budget-Kacheln desselben Mandanten nichts zu tun hatte.
 *
 * Diese Helfer leiten beides aus den Daten ab, die der Seed ohnehin erzeugt —
 * nach derselben Regel wie der echte Erfassungspfad
 * (`budget-plan-revision.ts`), nur aus dem Speicher statt aus der Datenbank,
 * weil die Revisionen im Seed entstehen, bevor alles geschrieben ist.
 *
 * **Der Schnitt `asOf` / `upToCycle` ist der Punkt.** Der Seed legt sechs
 * Revisionen von 2024-H1 bis 2026-H2 in einem Lauf an. Ohne Schnitt kennte der
 * in 2024 eingefrorene Beleg das Budget von 2026 — sechs gleiche Blöcke unter
 * verschiedenen Überschriften. Die Historie wäre eine Behauptung.
 */

import { compareCycles } from "@/modules/budgeting/domain/cycle";
import { addHalfYears, halfYearKey, parseHalfYearKey } from "@/modules/core/kernel/domain/calendar";
import type {
  ArtSnapshotInput,
  BudgetPlanSnapshot,
  FeatureSnapshotInput,
} from "@/modules/budgeting/domain/budget-plan-snapshot";

// ---------------------------------------------------------------------------
// Features → Last je ART
// ---------------------------------------------------------------------------

/** Was der Snapshot von einem PI wissen muss. */
export interface SeedPiMeta {
  name: string;
  startDate: Date;
  endDate: Date;
}

/**
 * Die Feature-Zeile, wie der Seed sie ohnehin für `createMany` baut. Bewusst
 * strukturell und nicht `Prisma.InitiativeCreateManyInput`: hier zählt, was
 * der Snapshot braucht, nicht was die Tabelle alles kann.
 */
export interface SeedFeatureRow {
  id?: string | undefined;
  parentId?: string | null | undefined;
  title?: string | undefined;
  status?: string | undefined;
  artId?: string | null | undefined;
  piId?: string | null | undefined;
  wsjfJobSize?: number | null | undefined;
  createdAt?: Date | string | undefined;
}

export interface SnapshotFeatureContext {
  artNameById: ReadonlyMap<string, string>;
  piById: ReadonlyMap<string, SeedPiMeta>;
  /** Der Erfassungszeitpunkt der Revision. Später Angelegtes gibt es noch nicht. */
  asOf: Date;
  /**
   * Der erfasste Zyklus. Sichtbar ist die Einplanung bis **einschliesslich des
   * folgenden** Halbjahres — dieselben zwei, auf denen auch Budgeting arbeitet
   * (`openCycles`: das laufende und das naechste).
   *
   * Ohne diesen Deckel zeigte jede der sechs Revisionen eines Laufs dieselbe
   * Last: `createdAt` allein reicht nicht, weil ein 2024 angelegtes Feature erst
   * 2026 in ein PI kommt — und **die Einplanung** ist es, die den Bedarf ins
   * Halbjahr setzt, nicht der Anlagetag.
   */
  cycleKey: string;
}

/** Das Halbjahr hinter dem Zyklus — die Grenze dessen, was eine Erfassung sieht. */
function planningHorizon(cycleKey: string): string {
  const start = parseHalfYearKey(cycleKey);
  return start ? halfYearKey(addHalfYears(start, 1)) : cycleKey;
}

/**
 * Die Features, die ein Einfrieren zum Zeitpunkt `asOf` gesehen hätte.
 *
 * Verworfen wird dieselbe Menge wie im Erfassungspfad
 * (`loadFeatureSnapshotInputs`): ohne PI, ohne ART, ohne Eltern-Epic. Ein
 * Feature ohne PI ist nicht „Last im Halbjahr null", sondern unverplant — es
 * gehört in den Backlog-Eimer, und den füllt `aggregateArtFeatureLoad` selbst.
 */
export function snapshotFeatures(
  rows: readonly SeedFeatureRow[],
  ctx: SnapshotFeatureContext,
): FeatureSnapshotInput[] {
  const horizon = planningHorizon(ctx.cycleKey);
  const out: FeatureSnapshotInput[] = [];
  for (const r of rows) {
    if (!r.id || !r.parentId || !r.artId || !r.piId) continue;
    if (r.createdAt != null && new Date(r.createdAt) > ctx.asOf) continue;
    const pi = ctx.piById.get(r.piId);
    if (!pi) continue;
    if (compareCycles(halfYearKey(pi.startDate), horizon) > 0) continue;
    out.push({
      featureId: r.id,
      parentEpicId: r.parentId,
      title: r.title ?? "",
      status: r.status ?? "draft",
      artId: r.artId,
      artName: ctx.artNameById.get(r.artId) ?? "",
      wsjfJobSize: r.wsjfJobSize ?? null,
      piId: r.piId,
      piName: pi.name,
      piStartDate: pi.startDate,
      piEndDate: pi.endDate,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Kacheln → ART-Budget je Halbjahr
// ---------------------------------------------------------------------------

/** Ein finaler Betrag einer Kachel, auf den ART seines Epics gebucht. */
export interface SeedArtFinal {
  artId: string;
  cycleKey: string;
  amount: number;
}

/**
 * Die ART-Budgets eines Snapshots — Σ der finalen Kachel-Beträge je ART und
 * Halbjahr, gedeckelt auf `upToCycle`.
 *
 * Dieselbe Ableitung wie `loadArtSnapshotInputs`, inklusive der beiden
 * Eigenheiten, die Treue vor Schönheit stellen: **jeder** ART kommt vor, auch
 * ohne einen einzigen Betrag (dann mit leerem `budgetByPeriod`), und ein
 * finaler Betrag von 0 € legt den Halbjahres-Schlüssel trotzdem an — eine
 * Kachel, in der ein ART nichts bekommen hat, ist eine Aussage.
 */
export function snapshotArtRows(
  arts: readonly { id: string; name: string }[],
  finals: readonly SeedArtFinal[],
  upToCycle: string,
): ArtSnapshotInput[] {
  const byArt = new Map<string, Record<string, number>>();
  for (const f of finals) {
    if (compareCycles(f.cycleKey, upToCycle) > 0) continue;
    const byPeriod = byArt.get(f.artId) ?? {};
    byPeriod[f.cycleKey] = (byPeriod[f.cycleKey] ?? 0) + f.amount;
    byArt.set(f.artId, byPeriod);
  }
  return [...arts]
    .sort((a, b) => a.name.localeCompare(b.name, "de"))
    .map((a) => ({ artId: a.id, name: a.name, budgetByPeriod: byArt.get(a.id) ?? {} }));
}

// ---------------------------------------------------------------------------
// Wächter
// ---------------------------------------------------------------------------

/** Σ Job Size über alle ARTs und Halbjahre eines Snapshots. */
export function snapshotJobSizeSum(snapshot: BudgetPlanSnapshot): number {
  let sum = 0;
  for (const art of snapshot.arts) {
    for (const cell of Object.values(art.loadByPeriod)) sum += cell.jobSizeSum;
  }
  return sum;
}

/**
 * Wirft, wenn **keine einzige** Revision eines Laufs Feature-Last trägt.
 *
 * Nicht je Revision geprüft: die frühen Halbjahre haben im Datensatz keine
 * PIs, und „—" ist dort die Wahrheit. Aber ein ganzer Mandant, der Features mit
 * Job Size und PI anlegt und danach lauter leere Belege einfriert, ist genau
 * der Fehler, der hier jahrelang unbemerkt stand.
 */
export function assertSnapshotLoad(
  snapshots: readonly BudgetPlanSnapshot[],
  tenantLabel: string,
): void {
  if (snapshots.some((s) => snapshotJobSizeSum(s) > 0)) return;
  throw new Error(
    `Seed „${tenantLabel}": keine der ${snapshots.length} Budget-Plan-Revisionen ` +
      `traegt Feature-Last. Entweder wurden die Features nicht durchgereicht, ` +
      `oder keines von ihnen haengt an einem PI.`,
  );
}
