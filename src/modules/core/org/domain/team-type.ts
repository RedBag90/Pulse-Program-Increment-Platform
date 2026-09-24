/** Agile team archetypes (Team Topologies, as used in SAFe). Pure, no I/O. */

import { makeTypeGuard } from "@/modules/core/kernel/domain/type-guards";

export const TEAM_TYPES = [
  "stream_aligned",
  "complicated_subsystem",
  "platform",
  "enabling",
] as const;
export type TeamType = (typeof TEAM_TYPES)[number];

export const TEAM_TYPE_KEYS: Record<TeamType, string> = {
  stream_aligned: "org.teamType.streamAligned",
  complicated_subsystem: "org.teamType.complicatedSubsystem",
  platform: "org.teamType.platform",
  enabling: "org.teamType.enabling",
};

export const isTeamType = makeTypeGuard(TEAM_TYPES);
