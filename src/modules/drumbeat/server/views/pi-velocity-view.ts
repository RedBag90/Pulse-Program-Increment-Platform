import type { PrismaClient } from "@/generated/prisma";
import { loadArtPiRows } from "@/modules/drumbeat/server/views/umsetzung-cockpit-view";
import {
  artVelocity,
  streamVelocity,
  type ArtVelocity,
  type StreamVelocity,
  type VelocityWindow,
} from "@/modules/drumbeat/domain/pi-velocity";

/**
 * **PI-Velocity je ART und für den Wertstrom** — für den Reiter
 * „Budget-KPIs". Budgeting darf Drumbeat nicht importieren (ADR-0013); die
 * Wertstrom-Seite unter `src/app` ruft diesen Lader und reicht das Ergebnis
 * als Slot in die Budgeting-Karten.
 *
 * Kapazität und Lieferung je PI lädt dieselbe Funktion wie das Cockpit
 * (`loadArtPiRows`): Kapazität dieses ARTs, Σ Job Size seiner abgeschlossenen
 * Features.
 */
export interface PiVelocityModel {
  arts: (ArtVelocity & { artId: string; name: string })[];
  stream: StreamVelocity;
}

export async function loadPiVelocity(
  db: PrismaClient,
  tenantId: string,
  arts: readonly { id: string; name: string; timelineId: string | null }[],
  window: VelocityWindow,
): Promise<PiVelocityModel> {
  const perArt = await Promise.all(
    arts.map(async (art) => ({
      artId: art.id,
      name: art.name,
      ...artVelocity(await loadArtPiRows(db, tenantId, art), window),
    })),
  );
  return { arts: perArt, stream: streamVelocity(perArt) };
}
