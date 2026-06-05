"use server";

import { z } from "zod";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { createPi, startPi, completePi, deletePi, setPiCapacity } from "@/server/services/pi";
import { authorize } from "@/server/auth/authorize";
import { headers } from "next/headers";
import { extractRequestMeta } from "@/server/audit/emit";
import { isErr } from "@/domain/errors";
import { createServerAction } from "@/server/http/server-action";
import { fields } from "@/server/http/form-data";
import { revalidateFor } from "@/server/http/revalidation";
import type { RequestContext } from "@/server/http/mutation-handler";
import type { PiId, TimelineId } from "@/domain/types";

export interface PiActionState {
  error?: string;
  success?: boolean;
}

export const createPiAction = createServerAction({
  describeCreated: (v: { id: string }) => ({
    id: v.id,
    label: "Program Increment",
    href: `/pi/${v.id}`,
  }),
  schema: z.object({
    timelineId: z.string().uuid(),
    name: z.string().min(1).max(100),
    startDate: z.string().date(),
    endDate: z.string().date(),
  }),
  action: "pi.create",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) =>
    createPi(ctx, {
      timelineId: input.timelineId as TimelineId,
      name: input.name,
      startDate: new Date(input.startDate),
      endDate: new Date(input.endDate),
    }),
  revalidate: "pi",
  mapError: (e) =>
    e.kind === "conflict"
      ? e.reason
      : e.kind === "not_found"
        ? "Timeline not found"
        : "Failed to create PI",
});

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
