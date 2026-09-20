/**
 * **Was in diesem Halbjahr an einer Solution investiert wird** — plus die Zahl
 * ihrer Primär-Epics.
 *
 * Bis September 2026 stand hier die **Life-Time-Summe**: Σ Umsetzungskosten
 * aller freigegebenen, nicht abgeschlossenen Primär-Epics, ohne jeden
 * Zeitbezug. Ein Epic, das 2024 freigegeben wurde und bis 2029 läuft, zählte in
 * jedem Halbjahr vollständig — die Struktur-Fläche zeigte daneben einen
 * Jahreswert für den Betrieb. Zwei Zahlen, zwei Perioden, keine davon benannt.
 *
 * Jetzt steht beides auf **derselben Periode: dem angewandten Budget-Zyklus**.
 * Der Betrag ist die **Zuteilung** dieses Halbjahres — was entschieden ist,
 * nicht was geplant war. Genau die Rechnung, die der Horizont-Trichter der
 * Portfolio-Übersicht seit seinem eigenen Umbau macht
 * (`work/server/services/horizon-funnel.ts`); sie steht hier ein zweites Mal
 * nur deshalb, weil sie hier je **Solution-Id-Liste** gefragt wird statt für
 * den ganzen Mandanten.
 *
 * **Ein Euro, ein Topf.** Ein Epic wird entweder aus dem Portfolio-Topf oder
 * aus dem Rahmen seines ARTs finanziert; `chooseAllocation` wählt, ein leerer
 * Topf tritt zurück. Zu addieren wäre in einem Mandanten eine glatte
 * Verdopplung.
 *
 * **Die Zuteilungen kommen als Ports herein.** Sie liegen in Budgeting, und
 * Work darf nicht aufwärts importieren (ADR-0013) — die Route komponiert.
 * Deshalb sieht diese Datei nur `Record<epicId, €>`.
 *
 * `epicCount` bleibt ohne Periode: eine Anzahl hat keine.
 */

import type { PrismaClient } from "@/generated/prisma";
import { InitiativeLevel } from "@/modules/core/kernel/domain/types";
import { parseBusinessCase, computeBusinessCaseTotals } from "@/modules/work/domain/business-case";
import { isPbEligible } from "@/modules/work/domain/pb-submission";
import { chooseAllocation, type EpicClassLike } from "@/modules/work/domain/epic-allocation-choice";

export interface SolutionGrow {
  /** Σ Zuteilung des angewandten Zyklus über die Primär-Epics dieser Solution. */
  grow: number;
  /** Alle Primär-Epics — auch die unreifen und die abgeschlossenen. */
  epicCount: number;
}

export interface SolutionGrowEpic {
  id: string;
  title: string;
  stageGate: string;
  /** `null`, solange der Business Case nicht freigegeben ist. */
  cost: number | null;
}

/**
 * Was Budgeting beisteuert, als schlichte Daten — kein Modul-Bezug.
 *
 * Alle drei Karten gehören zu **einem** Zyklus. Sie gemischt zu übergeben
 * hiesse, Halbjahre zu addieren; die Route holt sie deshalb aus einer Quelle
 * (`getEpicCycleAllocations` liefert den Zyklus, den die beiden anderen dann
 * benutzen).
 */
export interface SolutionInvestPorts {
  /** Zuteilung je Epic aus dem **Portfolio**-Topf. */
  cycleAllocations: Readonly<Record<string, number>>;
  /** Zuteilung je Epic aus dem **ART**-Topf. */
  artAllocations: Readonly<Record<string, number>>;
  /** Die Einordnung je Epic — sie wählt den Topf. */
  epicClasses: ReadonlyMap<string, { epicClass: EpicClassLike }>;
}

/** Die Felder, die die Rechnung braucht — Vertrag für den Lader und die Tests. */
export interface InvestEpicFacts {
  id: string;
  primarySolutionId: string | null;
}

/**
 * Σ Zuteilung und Anzahl je Solution.
 *
 * **Ein Epic ohne Zuteilung trägt 0** — und das ist die Aussage: in diesem
 * Halbjahr fliesst dorthin kein Geld. Vorher trug es seine vollen
 * Life-Time-Kosten, in jedem Halbjahr aufs Neue.
 */
export function investByPrimarySolution(
  epics: readonly InvestEpicFacts[],
  ports: SolutionInvestPorts,
): Map<string, SolutionGrow> {
  const out = new Map<string, SolutionGrow>();
  for (const e of epics) {
    if (e.primarySolutionId == null) continue;
    const cell = out.get(e.primarySolutionId) ?? { grow: 0, epicCount: 0 };
    cell.epicCount += 1;
    cell.grow += chooseAllocation({
      portfolio: ports.cycleAllocations[e.id] ?? 0,
      art: ports.artAllocations[e.id] ?? 0,
      epicClass: ports.epicClasses.get(e.id)?.epicClass ?? null,
    });
    out.set(e.primarySolutionId, cell);
  }
  return out;
}

/** Zuteilung und Anzahl je Solution für eine Menge von Solution-Ids. */
export async function loadSolutionCycleInvest(
  db: PrismaClient,
  tenantId: string,
  solutionIds: readonly string[],
  ports: SolutionInvestPorts,
): Promise<Map<string, SolutionGrow>> {
  if (solutionIds.length === 0) return new Map();
  const epics = await db.initiative.findMany({
    where: {
      tenantId,
      level: InitiativeLevel.EPIC,
      deletedAt: null,
      primarySolutionId: { in: [...solutionIds] },
    },
    // Kein Reifegrad-Filter: `epicCount` zaehlt **alle** Primaer-Epics, und das
    // Geld braucht keinen — die Zuteilung selbst ist die genauere Auskunft als
    // eine Schwelle, die danebenliegen kann.
    select: { id: true, primarySolutionId: true },
  });
  return investByPrimarySolution(epics, ports);
}

/**
 * Die Primär-Epics **einer** Solution, für den Epics-Reiter der Detailseite.
 *
 * Sie trägt **keine Summe mehr.** Die Liste zeigt je Epic seine
 * Umsetzungskosten — eine Life-Time-Zahl, und als Angabe zum einzelnen Vorhaben
 * ist sie richtig. Aufaddiert war sie die Zahl, die auf der Kachel „Grow" hiess
 * und keine Periode hatte. Die Kachel nennt jetzt die Zuteilung des laufenden
 * Halbjahres (`loadSolutionCycleInvest`); zwei Summen mit einem Namen und
 * verschiedenen Bedeutungen soll es nicht geben.
 */
export async function loadSolutionEpics(
  db: PrismaClient,
  tenantId: string,
  solutionId: string,
): Promise<{ epics: SolutionGrowEpic[] }> {
  const rows = await db.initiative.findMany({
    where: {
      tenantId,
      level: InitiativeLevel.EPIC,
      deletedAt: null,
      primarySolutionId: solutionId,
    },
    select: {
      id: true,
      title: true,
      stageGate: true,
      businessCaseApprovedAt: true,
      businessCase: true,
    },
    orderBy: { title: "asc" },
  });
  const epics = rows.map((e) => {
    // Der Reiter listet **alle** zugeordneten Epics — auch die, die noch keine
    // freigegebene Zahl haben. Die zeigen dann keinen Betrag statt einer Null:
    // „noch nicht freigegeben" ist etwas anderes als „kostet nichts".
    const cost = isPbEligible(e)
      ? computeBusinessCaseTotals(parseBusinessCase(e.businessCase).current).implementationCost
      : null;
    return { id: e.id, title: e.title, stageGate: e.stageGate, cost };
  });
  return { epics };
}

/**
 * Die Features **einer** Solution — für den Epics-Reiter der Detailseite.
 *
 * Gemeint sind die Features, die ihre Solution **selbst** tragen. Features, die
 * sie nur über ihr Epic erben, stehen nicht hier: sie hängen unter einem Epic,
 * das die Liste darüber ohnehin zeigt, und doppelt aufgeführt wäre die Solution
 * scheinbar doppelt belastet.
 *
 * Sie tragen **kein Geld**. Grow ist die Summe der Umsetzungskosten der
 * Primär-Epics; ein Feature hat keinen Business Case. Die Liste beantwortet
 * deshalb „was wird an dieser Solution gebaut", nicht „was kostet sie".
 */
export interface SolutionFeature {
  id: string;
  title: string;
  status: string;
  /** `null` = eigenständig, hängt an keinem Epic. */
  epic: { id: string; title: string } | null;
  artName: string | null;
}

export async function loadSolutionFeatures(
  db: PrismaClient,
  tenantId: string,
  solutionId: string,
): Promise<SolutionFeature[]> {
  const rows = await db.initiative.findMany({
    where: {
      tenantId,
      level: InitiativeLevel.FEATURE,
      deletedAt: null,
      primarySolutionId: solutionId,
    },
    select: {
      id: true,
      title: true,
      status: true,
      parent: { select: { id: true, title: true } },
      art: { select: { name: true } },
    },
    orderBy: { title: "asc" },
  });
  return rows.map((f) => ({
    id: f.id,
    title: f.title,
    status: f.status,
    epic: f.parent ? { id: f.parent.id, title: f.parent.title } : null,
    artName: f.art?.name ?? null,
  }));
}
