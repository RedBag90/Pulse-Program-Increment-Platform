/** Agile team archetypes (Team Topologies, as used in SAFe). Pure, no I/O. */

import { makeTypeGuard } from "@/domain/type-guards";

export const TEAM_TYPES = [
  "stream_aligned",
  "complicated_subsystem",
  "platform",
  "enabling",
] as const;
export type TeamType = (typeof TEAM_TYPES)[number];

export const TEAM_TYPE_LABELS: Record<TeamType, string> = {
  stream_aligned: "Stream-aligned",
  complicated_subsystem: "Complicated Subsystem",
  platform: "Platform",
  enabling: "Enabling",
};

export const isTeamType = makeTypeGuard(TEAM_TYPES);

/** Display label for a stored team type, or an em dash when unset/unknown. */
export function teamTypeLabel(v: string | null | undefined): string {
  return v && isTeamType(v) ? TEAM_TYPE_LABELS[v] : "—";
}
