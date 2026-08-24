/**
 * PB-Runden-Snapshot (F-B6/F-C3) — die eingefrorene Ergebnis-Schicht der
 * Participatory-Budgeting-Runde: Zonen, Entscheidungen, Report-outs und Reserve.
 * Wird beim Erfassen einer Budget-Plan-Revision zusätzlich zum €/ART-Snapshot in
 * die `payload` gefaltet, sodass **ein** Protokoll beide Schichten umfasst.
 *
 * Rein: kein I/O, kein Prisma. Der Service lädt die Zonen/Entscheidungen/
 * Report-outs und ruft `buildPbRoundSnapshot`.
 */

export interface PbRoundSnapshotEpic {
  epicId: string;
  title: string;
  cost: number;
  zone: string;
  yes: number;
  total: number;
  /** Streuzonen-Entscheidung (funded/rejected/deferred_with_review) oder null. */
  outcome: string | null;
  /** Effektiv finanziert = Konsens ∪ Entscheidung funded. */
  funded: boolean;
}

export interface PbRoundSnapshotReportOut {
  costliestYes: string | null;
  costliestYesReason: string | null;
  clearestNo: string | null;
  clearestNoReason: string | null;
  biggestDispute: string | null;
  disputeReason: string | null;
}

export interface PbRoundSnapshotGroup {
  name: string;
  spokesperson: string | null;
  reportOut: PbRoundSnapshotReportOut | null;
}

export interface PbRoundSnapshot {
  cycleKey: string;
  status: string;
  poolTotal: number;
  reserve: number | null;
  fundedSum: number;
  epics: PbRoundSnapshotEpic[];
  groups: PbRoundSnapshotGroup[];
}

export interface PbRoundSnapshotZoneEpic {
  epicId: string;
  title: string;
  cost: number;
  zone: string;
  yes: number;
  total: number;
}

export interface BuildPbRoundSnapshotInput {
  cycleKey: string;
  status: string;
  poolTotal: number;
  reserve: number | null;
  zoneEpics: PbRoundSnapshotZoneEpic[];
  decisions: { epicId: string; outcome: string }[];
  groups: PbRoundSnapshotGroup[];
}

/**
 * Faltet Zonen + Entscheidungen + Gruppen/Report-outs in den unveränderlichen
 * Runden-Snapshot. Finanziert = Konsens (alle Gruppen Ja) ∪ Streuzonen-
 * Entscheidung `funded` — spiegelt die Close-Logik (`computeCloseOutcome`).
 */
export function buildPbRoundSnapshot(i: BuildPbRoundSnapshotInput): PbRoundSnapshot {
  const outcomeByEpic = new Map(i.decisions.map((d) => [d.epicId, d.outcome]));

  let fundedSum = 0;
  const epics: PbRoundSnapshotEpic[] = i.zoneEpics.map((e) => {
    const outcome = outcomeByEpic.get(e.epicId) ?? null;
    const consensus = e.zone === "consensus";
    const funded = consensus || outcome === "funded";
    if (funded) fundedSum += e.cost;
    return {
      epicId: e.epicId,
      title: e.title,
      cost: e.cost,
      zone: e.zone,
      yes: e.yes,
      total: e.total,
      outcome,
      funded,
    };
  });

  return {
    cycleKey: i.cycleKey,
    status: i.status,
    poolTotal: i.poolTotal,
    reserve: i.reserve,
    fundedSum,
    epics,
    groups: i.groups,
  };
}
