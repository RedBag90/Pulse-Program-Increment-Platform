/**
 * Read-Model der Kachel-Detailseite (`/budgeting/periods/[id]`), Setup-Tab:
 * Rahmen + Beteiligte-Roster + Gruppen + Ballot-Kuratierung. Impurer Loader
 * (eine parallele Welle), die Ableitung (verteilbarer Topf, kuratierbare Epics)
 * ist trivial und inline.
 */

import type { PrismaClient } from "@/generated/prisma";
import type { Principal } from "@/server/auth/principal";
import { hasCapability } from "@/server/auth/authorize";
import { getRound } from "@/modules/budgeting/server/services/round-service";
import { loadRoundBallot } from "@/modules/budgeting/server/services/ballot";
import { getTenantPractices } from "@/server/services/target-model";
import { classifyEpics } from "@/modules/work/server/services/epic-class";
import { listTenantUserLabels } from "@/server/services/tenant-users";
import { listRtbItems } from "@/modules/budgeting/server/services/rtb-item-service";
import { rtbCycleAmount } from "@/modules/budgeting/domain/rtb-interval";

export interface PeriodMemberView {
  id: string;
  userId: string;
  label: string;
  isSubmitter: boolean;
  hasRead: boolean;
}

export interface PeriodGroupView {
  id: string;
  name: string;
  spokespersonId: string | null;
  members: PeriodMemberView[];
}

/**
 * Eine Ballot-Zeile mit allem, was die Gliederung braucht.
 *
 * Der **Wertstrom** steht auf dem Kandidaten (dort eingefroren, weil die
 * Finalisierung ihn zum Rechnen braucht); die **Solution** wird beim Lesen
 * aufgelöst — sie gliedert nur, sie rechnet nicht.
 */
export interface BallotEntry {
  id: string;
  /** Bei Epics die Epic-Id, bei RtB die Positions-Id — für Entfernen/Deeplink. */
  sourceId: string;
  kind: string;
  title: string;
  ask: number;
  valueStreamName: string | null;
  solutionName: string | null;
}

export interface PeriodDetailModel {
  round: {
    id: string;
    cycleKey: string;
    status: string;
    poolTotal: number;
    startDate: Date | null;
    endDate: Date | null;
    submissionDeadline: Date | null;
  };
  /** Verteilbarer Topf = poolTotal (Pflichtvorhaben-Abzug entfällt). */
  distributable: number;
  participants: { id: string; userId: string; label: string }[];
  groups: PeriodGroupView[];
  /** Budgeting-reife Epics, die noch NICHT auf dem Ballot dieser Kachel sind. */
  eligibleEpics: { id: string; title: string; cost: number }[];
  /**
   * Wie viele vorgemerkte Epics als **ART-Epics** ausgefiltert wurden — sie
   * werden von ihren ARTs finanziert, nicht über die Kachel. `0`, solange die
   * Practice `artEpics` aus ist.
   */
  artEpicsFilteredOut: number;
  /** Bereits kuratierte Epic-Kandidaten dieser Kachel. */
  epicCandidates: BallotEntry[];
  /**
   * Die Run-the-Business-Seite des Ballots. Im Entwurf eine **Vorschau** der
   * aktiven Positionen mit ihrem Kachel-Ask — sie werden erst beim Start zu
   * Kandidaten. Ohne diese Vorschau bliebe die Run-Gruppe im Entwurf leer und
   * die Gliederung sähe kaputt aus.
   */
  rtbCandidates: BallotEntry[];
  /** `true`, solange die RtB-Zeilen nur eine Vorschau sind (Status `draft`). */
  rtbIsPreview: boolean;
  /** Tenant-Nutzer (Id → E-Mail) für Beteiligte-/Mitglieder-/Sprecher-Auswahl. */
  users: { id: string; label: string }[];
  canManage: boolean;
}

export async function loadPeriodDetail(
  db: PrismaClient,
  principal: Principal,
  roundId: string,
): Promise<PeriodDetailModel | null> {
  const round = await getRound(db, principal.tenantId, roundId);
  if (!round) return null;

  const draft = round.status === "draft";

  const [ballot, participants, candidates, rtbRows, rtbItems, userLabels] = await Promise.all([
    loadRoundBallot(db, principal.tenantId),
    db.budgetParticipant.findMany({ where: { roundId }, select: { id: true, userId: true } }),
    db.budgetCandidate.findMany({
      where: { roundId, kind: "epic" },
      // Der Kandidat trägt nur Ids; die Namen holt die zweite Welle unten.
      select: { id: true, epicId: true, title: true, ask: true, valueStreamId: true },
    }),
    // Ab `running` tragen die RtB-Positionen echte Kandidatenzeilen.
    draft
      ? Promise.resolve([])
      : db.budgetCandidate.findMany({
          where: { roundId, kind: "rtb" },
          select: { id: true, rtbItemId: true, title: true, ask: true, valueStreamId: true },
        }),
    // Im Entwurf die Vorschau: was beim Start dazukommt.
    draft ? loadRtbPreview(db, principal.tenantId) : Promise.resolve([]),
    listTenantUserLabels(db, principal.tenantId),
  ]);

  const labelOf = (id: string): string => userLabels[id] ?? id;
  const candidateEpicIds = new Set(
    candidates.map((c) => c.epicId).filter((x): x is string => x != null),
  );

  // Quellen-Trennung (Practice `artEpics`): ART-Epics gehören nicht auf den
  // Portfolio-Ballot — sie werden aus dem Rahmen ihres ARTs finanziert.
  //
  // Gefiltert wird **hier**, an der Ableitung des wählbaren Pools, und nicht in
  // `loadRoundBallot`: die Query hat vier Konsumenten, darunter die
  // Finalisierung. Eine Klassenfilterung dort änderte stillschweigend deren
  // Bedeutung mit.
  //
  // Epics **ohne** Klasse bleiben im Pool: ohne freigegebenen Business Case ist
  // nicht entschieden, wie groß das Vorhaben ist — und genau dieses Geld
  // braucht es, um den Business Case zu schreiben.
  const unpicked = ballot.ballot.filter((e) => !candidateEpicIds.has(e.id));
  const practices = await getTenantPractices(db, principal.tenantId);
  let pool = unpicked;
  let filteredOut = 0;

  if (practices.artEpics && unpicked.length > 0) {
    const classes = await classifyEpics(
      db,
      principal.tenantId,
      unpicked.map((e) => e.id),
    );
    // Ein Epic, zu dem keine Zeile kam, bleibt im Pool — ausgeschlossen wird
    // nur, was nachweislich ART-Sache ist.
    pool = unpicked.filter((e) => classes.get(e.id)?.epicClass !== "art");
    filteredOut = unpicked.length - pool.length;
  }

  // Zweite Welle: die Namen für die Gliederung. Der **Wertstrom** steht auf dem
  // Kandidaten (dort eingefroren, weil die Finalisierung ihn zum Rechnen
  // braucht); die **Solution** wird hier aufgelöst — sie gliedert nur.
  const names = await loadBallotNames(db, principal.tenantId, {
    epicIds: [...candidateEpicIds],
    rtbItemIds: rtbRows.map((c) => c.rtbItemId).filter((x): x is string => x != null),
    valueStreamIds: [...candidates, ...rtbRows]
      .map((c) => c.valueStreamId)
      .filter((x): x is string => x != null),
  });

  const users = Object.entries(userLabels)
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return {
    round: {
      id: round.id,
      cycleKey: round.cycleKey,
      status: round.status,
      poolTotal: Number(round.poolTotal),
      startDate: round.startDate,
      endDate: round.endDate,
      submissionDeadline: round.submissionDeadline,
    },
    distributable: Number(round.poolTotal),
    participants: participants.map((p) => ({
      id: p.id,
      userId: p.userId,
      label: labelOf(p.userId),
    })),
    groups: round.groups.map((g) => ({
      id: g.id,
      name: g.name,
      spokespersonId: g.spokespersonId,
      members: g.members.map((m) => ({
        id: m.id,
        userId: m.userId,
        label: labelOf(m.userId),
        isSubmitter: m.isSubmitter,
        hasRead: m.hasRead,
      })),
    })),
    eligibleEpics: pool,
    artEpicsFilteredOut: filteredOut,
    epicCandidates: candidates.map((c) => ({
      id: c.id,
      sourceId: c.epicId ?? "",
      kind: "epic",
      title: c.title,
      ask: Number(c.ask),
      valueStreamName: names.valueStream(c.valueStreamId),
      solutionName: names.solutionOfEpic(c.epicId),
    })),
    rtbCandidates: draft
      ? rtbItems
      : rtbRows.map((c) => ({
          id: c.id,
          sourceId: c.rtbItemId ?? "",
          kind: "rtb",
          title: c.title,
          ask: Number(c.ask),
          valueStreamName: names.valueStream(c.valueStreamId),
          solutionName: names.solutionOfRtbItem(c.rtbItemId),
        })),
    rtbIsPreview: draft,
    users,
    canManage: hasCapability(principal, "budget.round.manage", { tenantId: principal.tenantId }),
  };
}

/**
 * Die aktiven Run-the-Business-Positionen als Ballot-Vorschau — mit dem Betrag,
 * den sie in **dieser** Kachel anfragen würden (`rtbCycleAmount`, eine Kachel
 * deckt ein Halbjahr ab).
 */
async function loadRtbPreview(db: PrismaClient, tenantId: string): Promise<BallotEntry[]> {
  const [items, streams, solutions] = await Promise.all([
    listRtbItems(db, tenantId as Parameters<typeof listRtbItems>[1]),
    db.valueStream.findMany({ where: { tenantId }, select: { id: true, name: true } }),
    db.solution.findMany({
      where: { tenantId, deletedAt: null },
      select: { id: true, name: true },
    }),
  ]);
  const vsName = new Map(streams.map((v) => [v.id, v.name]));
  const solName = new Map(solutions.map((s) => [s.id, s.name]));

  return items
    .filter((i) => i.active)
    .map((i) => ({
      id: i.id,
      sourceId: i.id,
      kind: "rtb",
      title: i.name,
      ask: rtbCycleAmount(i.plannedAmount, i.interval),
      valueStreamName: vsName.get(i.valueStreamId) ?? null,
      solutionName: i.solutionId ? (solName.get(i.solutionId) ?? null) : null,
    }));
}

/**
 * Die Namen hinter den Ids einer Ballot-Zeile: Wertstrom, Solution des Epics
 * bzw. Solution der Run-the-Business-Position.
 */
async function loadBallotNames(
  db: PrismaClient,
  tenantId: string,
  ids: { epicIds: string[]; rtbItemIds: string[]; valueStreamIds: string[] },
) {
  const [streams, epics, rtbItems] = await Promise.all([
    ids.valueStreamIds.length > 0
      ? db.valueStream.findMany({
          where: { tenantId, id: { in: ids.valueStreamIds } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    ids.epicIds.length > 0
      ? db.initiative.findMany({
          where: { tenantId, id: { in: ids.epicIds } },
          select: { id: true, primarySolution: { select: { name: true } } },
        })
      : Promise.resolve([]),
    ids.rtbItemIds.length > 0
      ? db.runTheBusinessItem.findMany({
          where: { tenantId, id: { in: ids.rtbItemIds } },
          select: { id: true, solution: { select: { name: true } } },
        })
      : Promise.resolve([]),
  ]);

  const vs = new Map(streams.map((v) => [v.id, v.name]));
  const epicSol = new Map(epics.map((e) => [e.id, e.primarySolution?.name ?? null]));
  const rtbSol = new Map(rtbItems.map((r) => [r.id, r.solution?.name ?? null]));

  return {
    valueStream: (id: string | null) => (id ? (vs.get(id) ?? null) : null),
    solutionOfEpic: (id: string | null) => (id ? (epicSol.get(id) ?? null) : null),
    solutionOfRtbItem: (id: string | null) => (id ? (rtbSol.get(id) ?? null) : null),
  };
}
