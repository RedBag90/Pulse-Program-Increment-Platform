"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { createValueStream, softDeleteValueStream } from "@/server/services/value-stream";
import { authorize } from "@/server/auth/authorize";
import { headers } from "next/headers";
import { extractRequestMeta } from "@/server/audit/emit";
import { isErr } from "@/domain/errors";
import type { ValueStreamId } from "@/domain/types";

const createSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  budgetAmount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/)
    .optional(),
  budgetCurrency: z.string().length(3).optional(),
});

export interface ValueStreamActionState {
  error?: string;
  success?: boolean;
}

export async function createValueStreamAction(
  _prev: ValueStreamActionState,
  formData: FormData,
): Promise<ValueStreamActionState> {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) return { error: "Not authenticated" };

  if (!authorize("value_stream.create", { tenantId: principal.tenantId }, principal).allow) {
    return { error: "Insufficient permissions" };
  }

  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? undefined,
    budgetAmount: formData.get("budgetAmount") ?? undefined,
    budgetCurrency: formData.get("budgetCurrency") ?? undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { ipAddress, userAgent } = extractRequestMeta(await headers());
  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const result = await createValueStream(db, {
    tenantId: principal.tenantId,
    actorId: principal.id,
    name: parsed.data.name,
    description: parsed.data.description,
    budgetAmount: parsed.data.budgetAmount,
    budgetCurrency: parsed.data.budgetCurrency,
    ipAddress,
    userAgent,
  });

  if (isErr(result)) {
    return { error: result.error.kind === "conflict" ? result.error.reason : "Failed to create" };
  }

  revalidatePath("/portfolio/value-streams");
  return { success: true };
}

export async function deleteValueStreamAction(
  _prev: ValueStreamActionState,
  formData: FormData,
): Promise<ValueStreamActionState> {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) return { error: "Not authenticated" };

  if (!authorize("value_stream.update", { tenantId: principal.tenantId }, principal).allow) {
    return { error: "Insufficient permissions" };
  }

  const id = formData.get("id") as string;
  if (!id) return { error: "Missing ID" };

  const { ipAddress, userAgent } = extractRequestMeta(await headers());
  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const result = await softDeleteValueStream(
    db,
    principal.tenantId,
    id as ValueStreamId,
    principal.id,
    ipAddress,
    userAgent,
  );

  if (isErr(result)) {
    return {
      error: result.error.kind === "not_found" ? "Value stream not found" : "Failed to delete",
    };
  }

  revalidatePath("/portfolio/value-streams");
  return { success: true };
}
