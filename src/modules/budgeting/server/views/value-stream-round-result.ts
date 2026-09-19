/**
 * **Das Ergebnis der Kachel für einen Wertstrom** — was aus dem Budgeting-
 * Prozess für dieses Halbjahr herausgekommen ist.
 *
 * Es ist das Nachschlagewerk, das die Handlung des Reiters „Dieses Halbjahr"
 * begründet (`art-budget-process-layout.md`, REQ-4): **aufgeteilt** wird ein
 * Zuspruch, und bevor man ihn aufteilt, will man wissen, woraus er besteht und
 * wie viel vom Beantragten durchgekommen ist.
 *
 * Die Schritte 2 und 3 der Kette passieren woanders — auf der Kachel. Diese
 * Fläche zeigt deren **Ergebnis** und verlinkt dorthin; sie schreibt nichts
 * (§8 der Spec: kein zweiter Ort für die Kachel).
 *
 * Impurer Lader **plus** reiner Falter — deshalb `views/` und nicht
 * `services/`.
 */

import type { PrismaClient } from "@/generated/prisma";
import type { TenantId } from "@/modules/core/kernel/domain/types";
import {
  readBudgetCandidates,
  type CandidateRead,
} from "@/modules/budgeting/server/services/budget-reads";

/**
 * Drei Lagen, und jede sagt etwas anderes (REQ-12): es gibt für dieses Halbjahr
 * **keine** Kachel · sie **läuft noch**, entschieden ist nichts · sie ist
 * **abgeschlossen**, die Zahlen stehen fest.
 */
export type RoundResultState = "none" | "running" | "closed";

export interface RoundResultRow {
  key: string;
  label: string;
  /** Was beantragt war. */
  ask: number;
  /** Was die Kachel festgeschrieben hat. */
  amount: number;
  /** Anteil an Σ **dieser Kachel**, 0…1. */
  share: number;
}

export interface ValueStreamRoundResult {
  cycleKey: string;
  state: RoundResultState;
  /** Für den Link auf die Kachel; `null`, wenn es keine gibt. */
  roundId: string | null;
  rows: RoundResultRow[];
  askTotal: number;
  total: number;
}

/**
 * Faltet die Kandidatenzeilen eines Wertstroms in das Ergebnis. Rein.
 *
 * Gegliedert nach dem, was danach mit dem Geld passiert: **Betrieb** geht in
 * die Aufteilung auf die Positionen, **je ART** ist bereits entschieden und
 * wandert in dessen Reiter. Ein Epic **ohne ART** taucht in keiner ART-Sicht
 * auf — deshalb steht es hier als eigene Zeile und nicht in einer Sammelsumme.
 */
export function buildValueStreamRoundResult(
  cycleKey: string,
  candidates: readonly CandidateRead[],
  artName: (id: string) => string,
): ValueStreamRoundResult {
  if (candidates.length === 0) {
    return { cycleKey, state: "none", roundId: null, rows: [], askTotal: 0, total: 0 };
  }

  const roundId = candidates[0]!.roundId;
  const closed = candidates.every((c) => c.roundStatus === "closed");
  if (!closed) {
    return {
      cycleKey,
      state: "running",
      roundId,
      rows: [],
      askTotal: candidates.reduce((s, c) => s + c.ask, 0),
      total: 0,
    };
  }

  const gruppen = new Map<string, RoundResultRow>();
  const zeile = (key: string, label: string) => {
    let row = gruppen.get(key);
    if (!row) {
      row = { key, label, ask: 0, amount: 0, share: 0 };
      gruppen.set(key, row);
    }
    return row;
  };

  for (const c of candidates) {
    const row =
      c.kind === "rtb"
        ? zeile("rtb", "Betrieb und ART-Rahmen")
        : c.artId != null
          ? zeile(`art:${c.artId}`, artName(c.artId))
          : zeile("noArt", "Epics ohne ART");
    row.ask += c.ask;
    row.amount += c.finalAmount ?? 0;
  }

  const rows = [...gruppen.values()].sort((a, b) => b.amount - a.amount);
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const askTotal = rows.reduce((s, r) => s + r.ask, 0);

  return {
    cycleKey,
    state: "closed",
    roundId,
    rows: rows.map((r) => ({ ...r, share: total === 0 ? 0 : r.amount / total })),
    askTotal,
    total,
  };
}

export async function loadValueStreamRoundResult(
  db: PrismaClient,
  tenantId: TenantId,
  valueStreamId: string,
  cycleKey: string,
): Promise<ValueStreamRoundResult> {
  const [candidates, arts] = await Promise.all([
    readBudgetCandidates(db, tenantId),
    // **Ohne `deletedAt`-Filter:** hier werden Namen einer abgeschlossenen
    // Kachel aufgelöst. Ein seither gelöschter ART soll seinen Namen behalten,
    // sonst verliert das Ergebnis seine Beschriftung.
    db.art.findMany({ where: { tenantId }, select: { id: true, name: true } }),
  ]);

  const namen = new Map(arts.map((a) => [a.id, a.name]));
  return buildValueStreamRoundResult(
    cycleKey,
    candidates.filter((c) => c.valueStreamId === valueStreamId && c.cycleKey === cycleKey),
    (id) => namen.get(id) ?? "ART",
  );
}
