"use server";

import { z } from "zod";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import {
  startPi,
  advanceCadence,
  deletePi,
  setPiCapacity,
} from "@/modules/drumbeat/server/services/pi";
import { authorize } from "@/server/auth/authorize";
import { headers } from "next/headers";
import { extractRequestMeta } from "@/server/audit/emit";
import { isErr } from "@/modules/core/kernel/domain/errors";
import { createServerAction } from "@/server/http/server-action";
import { fields } from "@/server/http/form-data";
import { revalidateFor } from "@/server/http/revalidation";
import type { RequestContext } from "@/server/http/mutation-handler";
import type { PiId } from "@/modules/core/kernel/domain/types";

export interface PiActionState {
  error?: string;
  success?: boolean;
}

// PI-Erstellung ist seit dem Timeline-Rollout zentralisiert: PIs entstehen
// ausschließlich aus `applyPiStandard(timelineId, standardId, year)` —
// `addStandardPisAction` in `src/features/structure/actions/pi-standard.ts`.
// Eine `createPiAction` gibt es bewusst nicht mehr; der zugrundeliegende
// Service `createPi(...)` bleibt intern und wird vom Standard-Pfad
// verwendet.

/**
 * Startet ein geplantes PI (planned → active). Das Abschließen läuft
 * ausschließlich über `advanceCadenceAction` („PI abschließen & nächstes
 * öffnen") — der strenge Complete-PI-Weg ist aus dem UI entfallen (Spec WP2).
 * Der programmatische `completePi`-Service bleibt für die v1-REST-API.
 */
export async function transitionPiAction(piId: string): Promise<PiActionState> {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) return { error: "Not authenticated" };

  if (!authorize("pi.start", { tenantId: principal.tenantId }, principal).allow) {
    return { error: "Insufficient permissions" };
  }

  const { ipAddress, userAgent } = extractRequestMeta(await headers());
  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const ctx: RequestContext = {
    principal,
    db,
    ...(ipAddress !== undefined && { ipAddress }),
    ...(userAgent !== undefined && { userAgent }),
  };

  const result = await startPi(ctx, { id: piId as PiId });

  if (isErr(result)) {
    return {
      error: result.error.kind === "conflict" ? result.error.reason : "Failed to start PI",
    };
  }

  revalidateFor("pi");
  return { success: true };
}

/**
 * Schreibt die Kadenz fort: schließt das aktive PI ab und öffnet das nächste
 * (leichtes Weiterrollen). Gibt die nicht-blockierenden Closure-Warnungen zurück,
 * damit die UI „trotz offener Punkte fortgeschrieben" anzeigen kann.
 */
export async function advanceCadenceAction(
  piId: string,
): Promise<PiActionState & { warnings?: string[]; toName?: string }> {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) return { error: "Not authenticated" };

  if (!authorize("pi.advance", { tenantId: principal.tenantId }, principal).allow) {
    return { error: "Insufficient permissions" };
  }

  const { ipAddress, userAgent } = extractRequestMeta(await headers());
  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const ctx: RequestContext = {
    principal,
    db,
    ...(ipAddress !== undefined && { ipAddress }),
    ...(userAgent !== undefined && { userAgent }),
  };

  const result = await advanceCadence(ctx, { piId: piId as PiId });
  if (isErr(result)) {
    return {
      error: result.error.kind === "conflict" ? result.error.reason : "Fortschreiben fehlgeschlagen",
    };
  }

  revalidateFor("pi");
  return { success: true, warnings: result.value.warnings, toName: result.value.to };
}

/**
 * Sets the per-PI capacity overrides used by the PI-Planning overlay
 * (Job Size + €-Budget). Empty values clear the respective override; the
 * service interprets `null` as a deliberate clear.
 */
export const setPiCapacityAction = createServerAction({
  schema: z.object({
    id: z.string().uuid(),
    artId: z.string().uuid(),
    capacityJobSize: z.number().nonnegative().nullable(),
    capacityAmount: z.number().nonnegative().nullable(),
  }),
  action: "pi.update",
  resource: (input, p) => ({ tenantId: p.tenantId, artId: input.artId }),
  parseFormData: (fd) => {
    const f = fields(fd);
    const job = f.nonEmptyString("capacityJobSize");
    const amount = f.nonEmptyString("capacityAmount");
    return {
      id: f.string("id"),
      artId: f.string("artId"),
      capacityJobSize: job === undefined ? null : Number(job),
      capacityAmount: amount === undefined ? null : Number(amount),
    };
  },
  service: (ctx, input) =>
    setPiCapacity(ctx, {
      id: input.id as PiId,
      capacityJobSize: input.capacityJobSize,
      capacityAmount: input.capacityAmount,
    }),
  revalidate: "pi",
  mapError: (e) =>
    e.kind === "conflict"
      ? e.reason
      : e.kind === "not_found"
        ? "PI nicht gefunden"
        : "Kapazität konnte nicht gespeichert werden",
});

export const deletePiAction = createServerAction({
  schema: z.object({ id: z.string().uuid(), artId: z.string().uuid() }),
  action: "pi.delete",
  resource: (input, p) => ({ tenantId: p.tenantId, artId: input.artId }),
  service: (ctx, input) => deletePi(ctx, { id: input.id as PiId }),
  revalidate: "pi",
  mapError: (e) =>
    e.kind === "conflict"
      ? e.reason
      : e.kind === "not_found"
        ? "PI not found"
        : "Failed to delete PI",
});
