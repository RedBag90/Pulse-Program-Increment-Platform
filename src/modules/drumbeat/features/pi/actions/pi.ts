"use server";

import { z } from "zod";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import {
  startPi,
  completePi,
  deletePi,
  setPiCapacity,
  setPiClosureMeta,
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

export async function transitionPiAction(
  piId: string,
  targetStatus: "active" | "completed",
): Promise<PiActionState> {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) return { error: "Not authenticated" };

  const action = targetStatus === "active" ? "pi.start" : "pi.complete";
  if (!authorize(action, { tenantId: principal.tenantId }, principal).allow) {
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

  const result =
    targetStatus === "active"
      ? await startPi(ctx, { id: piId as PiId })
      : await completePi(ctx, { id: piId as PiId });

  if (isErr(result)) {
    return {
      error: result.error.kind === "conflict" ? result.error.reason : "Failed to update PI status",
    };
  }

  revalidateFor("pi");
  return { success: true };
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

/**
 * Schreibt die PI-Closure-Metadaten — System-Demo, Inspect & Adapt,
 * Retrospektive-Notizen. Wird vom Closure-Wizard pro Step aufgerufen;
 * leere Strings für Notes → null (löschen).
 */
export const setPiClosureMetaAction = createServerAction({
  schema: z.object({
    id: z.string().uuid(),
    systemDemoAt: z.string().date().nullable().optional(),
    inspectAdaptAt: z.string().date().nullable().optional(),
    retrospectiveNotes: z.string().max(10_000).nullable().optional(),
  }),
  action: "pi.update",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => {
    const f = fields(fd);
    const demo = f.nonEmptyString("systemDemoAt");
    const ia = f.nonEmptyString("inspectAdaptAt");
    const notes = fd.get("retrospectiveNotes");
    return {
      id: f.string("id"),
      ...(demo !== undefined ? { systemDemoAt: demo } : {}),
      ...(ia !== undefined ? { inspectAdaptAt: ia } : {}),
      ...(notes !== null ? { retrospectiveNotes: String(notes) } : {}),
    };
  },
  service: (ctx, input) =>
    setPiClosureMeta(ctx, {
      id: input.id as PiId,
      ...(input.systemDemoAt !== undefined
        ? { systemDemoAt: input.systemDemoAt ? new Date(input.systemDemoAt) : null }
        : {}),
      ...(input.inspectAdaptAt !== undefined
        ? { inspectAdaptAt: input.inspectAdaptAt ? new Date(input.inspectAdaptAt) : null }
        : {}),
      ...(input.retrospectiveNotes !== undefined
        ? { retrospectiveNotes: input.retrospectiveNotes || null }
        : {}),
    }),
  revalidate: "pi",
  mapError: (e) =>
    e.kind === "not_found"
      ? "PI nicht gefunden"
      : e.kind === "conflict"
        ? e.reason
        : "Closure-Metadaten konnten nicht gespeichert werden",
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
