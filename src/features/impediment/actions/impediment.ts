"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { requirePrincipal } from "@/server/auth/principal";
import { authorize } from "@/server/auth/authorize";
import { createPrismaClient } from "@/server/db/prisma";
import { extractRequestMeta } from "@/server/audit/emit";
import {
  createImpediment,
  escalateImpediment,
  resolveImpediment,
  setImpedimentRoam,
  type ImpedimentId,
} from "@/server/services/impediment";
import { createServerAction } from "@/server/http/server-action";
import { formatDomainError } from "@/server/http/domain-error-display";
import { revalidateFor } from "@/server/http/revalidation";
import type { RequestContext } from "@/server/http/mutation-handler";
import { isErr } from "@/domain/errors";
import { redirect } from "next/navigation";
import type { ArtId } from "@/domain/types";

export type ImpedimentActionState = { error?: string; success?: boolean };

/** Builds a RequestContext for service calls from the resolved principal. */
async function buildContext(
  principal: Awaited<ReturnType<typeof requirePrincipal>>,
): Promise<RequestContext> {
  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const { ipAddress, userAgent } = extractRequestMeta(await headers());
  return {
    principal,
    db,
    ...(ipAddress !== undefined && { ipAddress }),
    ...(userAgent !== undefined && { userAgent }),
  };
}

export const createImpedimentAction = createServerAction({
  describeCreated: (v: { id: string }) => ({ id: v.id, label: "Impediment" }),
  schema: z.object({
    artId: z.string().uuid(),
    title: z.string().min(1, "Title required").max(300),
    description: z.string().max(5000).optional(),
    severity: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  }),
  action: "impediment.create",
  resource: (input, p) => ({ tenantId: p.tenantId, artId: input.artId }),
  service: (ctx, input) =>
    createImpediment(ctx, {
      artId: input.artId as ArtId,
      title: input.title,
      description: input.description,
      severity: input.severity,
    }),
  revalidate: "impediment",
  mapError: (e) => formatDomainError(e, { fallback: "Failed to log impediment" }),
});

export async function escalateImpedimentAction(
  id: string,
  artId: string,
): Promise<ImpedimentActionState> {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  if (!authorize("impediment.escalate", { tenantId: principal.tenantId, artId }, principal).allow) {
    return { error: "Insufficient permissions" };
  }

  const ctx = await buildContext(principal);
  const result = await escalateImpediment(ctx, { id: id as ImpedimentId });

  if (isErr(result)) {
    return { error: result.error.kind === "conflict" ? result.error.reason : "Failed to escalate" };
  }

  revalidateFor("impediment");
  return { success: true };
}

export async function resolveImpedimentAction(
  id: string,
  artId: string,
  resolution: string,
): Promise<ImpedimentActionState> {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  if (!authorize("impediment.resolve", { tenantId: principal.tenantId, artId }, principal).allow) {
    return { error: "Insufficient permissions" };
  }

  const ctx = await buildContext(principal);
  const result = await resolveImpediment(ctx, { id: id as ImpedimentId, resolution });

  if (isErr(result)) {
    return { error: result.error.kind === "conflict" ? result.error.reason : "Failed to resolve" };
  }

  revalidateFor("impediment");
  return { success: true };
}

/**
 * Bulk resolve — drives the impediments list bulk action bar. Each id is
 * resolved with the shared `resolution` string; the Round 3 batch mode of
 * `createServerAction` early-fails on the first conflict so partial
 * resolutions can't happen.
 */
export const resolveImpedimentBatchAction = createServerAction({
  schema: z.object({
    impedimentIds: z.array(z.string().uuid()).min(1).max(50),
    artId: z.string().uuid(),
    resolution: z.string().min(1).max(2000),
  }),
  action: "impediment.resolve",
  resource: (input, p) => ({ tenantId: p.tenantId, artId: input.artId }),
  batch: {
    iterateOver: "impedimentIds",
    service: (ctx, id, rest) =>
      resolveImpediment(ctx, { id: id as ImpedimentId, resolution: rest.resolution }),
  },
  revalidate: "impediment",
  mapError: (e) => formatDomainError(e, { fallback: "Impediment-Auflösung fehlgeschlagen" }),
});

/**
 * Setzt den ROAM-Status (Resolved/Owned/Accepted/Mitigated) eines
 * Impediments. Gated wie `resolveImpediment` (ART-scoped) — die
 * Capability `impediment.resolve` ist der RTE/SM-Träger und passt zur
 * Closure-Verantwortung.
 */
export const setImpedimentRoamAction = createServerAction({
  schema: z.object({
    id: z.string().uuid(),
    artId: z.string().uuid(),
    roamStatus: z.enum(["open", "resolved", "owned", "accepted", "mitigated"]),
  }),
  action: "impediment.resolve",
  resource: (input, p) => ({ tenantId: p.tenantId, artId: input.artId }),
  service: (ctx, input) =>
    setImpedimentRoam(ctx, {
      id: input.id as ImpedimentId,
      roamStatus: input.roamStatus,
    }),
  revalidate: "impediment",
  mapError: (e) => formatDomainError(e, { fallback: "ROAM-Status konnte nicht gesetzt werden" }),
});

/**
 * Bulk escalate — open → escalated for every id. Mirrors the single-item
 * action's auth gate (`impediment.escalate`).
 */
export const escalateImpedimentBatchAction = createServerAction({
  schema: z.object({
    impedimentIds: z.array(z.string().uuid()).min(1).max(50),
    artId: z.string().uuid(),
  }),
  action: "impediment.escalate",
  resource: (input, p) => ({ tenantId: p.tenantId, artId: input.artId }),
  batch: {
    iterateOver: "impedimentIds",
    service: (ctx, id) => escalateImpediment(ctx, { id: id as ImpedimentId }),
  },
  revalidate: "impediment",
  mapError: (e) => formatDomainError(e, { fallback: "Impediment-Eskalation fehlgeschlagen" }),
});
