/**
 * Die **drei Zonen** einer PB-Liste — welche Epics die Gruppen tragen, welche
 * sie ablehnen, und wo sie auseinandergehen.
 *
 * Lag bis September 2026 in `server/views/zones-view.ts` — einer „View", die
 * keine Fläche ansah: ihr einziger Aufrufer war ein Service. Der reine Falter
 * steht jetzt bei den anderen reinen Faltern, der Lader bei den Ladern.
 *
 * Rein, kein I/O.
 */

import { classifyZones, type Zone, type Majority } from "@/modules/budgeting/domain/three-zone";
import { scarcityFactor, passesScarcityGate } from "@/modules/budgeting/domain/scarcity";

export interface PbListEpic {
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
  ballot: PbListEpic[];
  votes: { groupId: string; epicId: string; funded: boolean }[];
  distributable: number;
}

/** Reine Ableitung des Zonen-Modells (Zonen + Knappheit). */
export function buildZonesModel(input: BuildZonesInput): ZonesModel {
  const { roundId, status, groups, ballot, votes, distributable } = input;
  const groupCount = groups.length;

  const zones = classifyZones(
    votes,
    ballot.map((e) => e.id),
    groupCount,
  );
  const zoneById = new Map(zones.map((z) => [z.epicId, z]));

  const epics: EpicZoneRow[] = ballot.map((e) => {
    const z = zoneById.get(e.id)!;
    return {
      epicId: e.id,
      title: e.title,
      cost: e.cost,
      yes: z.yes,
      total: z.total,
      zone: z.zone,
      majority: z.majority,
    };
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
