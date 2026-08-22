import type { PrismaClient } from "@/generated/prisma";
import { InitiativeLevel } from "@/modules/core/kernel/domain/types";
import { classifyZones, type Zone, type Majority } from "@/modules/budgeting/domain/three-zone";
import { scarcityFactor, passesScarcityGate } from "@/modules/budgeting/domain/scarcity";
import { getRound } from "@/modules/budgeting/server/services/round-service";

export interface BallotEpic {
  id: string;
  title: string;
  cost: number;
}

export interface EpicZoneRow {
  epicId: string;
  title: string;
  cost: number;
  yes: number;
  total: number;
  zone: Zone;
  majority: Majority;
}

export interface ZonesModel {
  roundId: string;
  status: string;
  groups: { id: string; name: string }[];
  epics: EpicZoneRow[];
  /** `${groupId}:${epicId}` → funded — für die Erfassungs-Matrix. */
  votes: Record<string, boolean>;
  consensusSum: number;
  rejectionCount: number;
  spreadSum: number;
  scarcity: { demand: number; distributable: number; factor: number; passes: boolean };
}

export interface BuildZonesInput {
  roundId: string;
  status: string;
  groups: { id: string; name: string }[];
  ballot: BallotEpic[];
  votes: { groupId: string; epicId: string; funded: boolean }[];
  distributable: number;
}

/** Reine Ableitung des Zonen-Modells (Zonen + Knappheit). */
export function buildZonesModel(input: BuildZonesInput): ZonesModel {
  const { roundId, status, groups, ballot, votes, distributable } = input;
  const groupCount = groups.length;

  const zones = classifyZones(votes, ballot.map((e) => e.id), groupCount);
  const zoneById = new Map(zones.map((z) => [z.epicId, z]));

  const epics: EpicZoneRow[] = ballot.map((e) => {
    const z = zoneById.get(e.id)!;
    return { epicId: e.id, title: e.title, cost: e.cost, yes: z.yes, total: z.total, zone: z.zone, majority: z.majority };
  });

  const voteLookup: Record<string, boolean> = {};
  for (const v of votes) if (v.funded) voteLookup[`${v.groupId}:${v.epicId}`] = true;

  const consensusSum = epics.filter((e) => e.zone === "consensus").reduce((s, e) => s + e.cost, 0);
  const rejectionCount = epics.filter((e) => e.zone === "rejection").length;
  const spreadSum = epics.filter((e) => e.zone === "spread").reduce((s, e) => s + e.cost, 0);

  const demand = ballot.reduce((s, e) => s + e.cost, 0);
  const factor = scarcityFactor(demand, distributable);

  return {
    roundId,
    status,
    groups,
    epics,
    votes: voteLookup,
    consensusSum,
    rejectionCount,
    spreadSum,
    scarcity: { demand, distributable, factor, passes: passesScarcityGate(factor) },
  };
}

/** Lädt Runde + Ballot + Stimmen und baut das Zonen-Modell. */
export async function loadZonesModel(
  db: PrismaClient,
  tenantId: string,
  roundId: string,
): Promise<ZonesModel | null> {
  const round = await getRound(db, tenantId, roundId);
  if (!round) return null;

  const [ballotEpics, votes, mandatoryEpics] = await Promise.all([
    db.initiative.findMany({
      where: {
        tenantId,
        level: InitiativeLevel.EPIC,
        deletedAt: null,
        stagedForBudgeting: true,
        mandatory: false,
      },
      select: { id: true, title: true, costToMvp: true },
      orderBy: { title: "asc" },
    }),
    db.groupAllocation.findMany({
      where: { roundId },
      select: { groupId: true, epicId: true, funded: true },
    }),
    db.initiative.findMany({
      where: { tenantId, level: InitiativeLevel.EPIC, deletedAt: null, mandatory: true },
      select: { costToMvp: true },
    }),
  ]);

  const mandatorySum = mandatoryEpics.reduce((s, e) => s + (e.costToMvp ? Number(e.costToMvp) : 0), 0);
  const distributable = Number(round.poolTotal) - mandatorySum;

  return buildZonesModel({
    roundId,
    status: round.status,
    groups: round.groups.map((g) => ({ id: g.id, name: g.name })),
    ballot: ballotEpics.map((e) => ({ id: e.id, title: e.title, cost: e.costToMvp ? Number(e.costToMvp) : 0 })),
    votes,
    distributable,
  });
}
