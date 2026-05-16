"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { authorize } from "@/server/auth/authorize";
import { headers } from "next/headers";
import { extractRequestMeta, emitAuditEvent } from "@/server/audit/emit";
import { ok, err, isErr } from "@/domain/errors";
import type { Result } from "@/domain/errors";
import type { TenantId, UserId } from "@/domain/types";

const STAGE_GATES = ["L0", "L1", "L2", "L3", "L4", "L5"] as const;
type StageGate = (typeof STAGE_GATES)[number];

const VALID_TRANSITIONS: Record<StageGate, StageGate[]> = {
  L0: ["L1"],
  L1: ["L0", "L2"],
  L2: ["L1", "L3"],
  L3: ["L2", "L4"],
  L4: ["L3", "L5"],
  L5: ["L4"],
};

const advanceSchema = z.object({
  epicId: z.string().uuid(),
  toGate: z.enum(STAGE_GATES),
  comment: z.string().optional(),
});

// Justified exception: advanceStageGateAction contains inline transaction + audit logic that
// cannot be expressed as a single service function — it stays manual.
export type StageGateActionState = { error?: string; success?: boolean };

export async function advanceStageGateAction(
  _prev: StageGateActionState,
  formData: FormData,
): Promise<StageGateActionState> {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) return { error: "Not authenticated" };

  if (!authorize("epic.approve", { tenantId: principal.tenantId }, principal).allow) {
    return { error: "Insufficient permissions" };
  }

  const parsed = advanceSchema.safeParse({
    epicId: formData.get("epicId"),
    toGate: formData.get("toGate"),
    comment: formData.get("comment") ?? undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { ipAddress, userAgent } = extractRequestMeta(await headers());
  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const rawResult = await db
    .$transaction(async (tx) => {
      const epic = await tx.initiative.findFirst({
        where: { id: parsed.data.epicId, tenantId: principal.tenantId, level: 0, deletedAt: null },
      });

      if (!epic) {
        return err({ kind: "not_found" as const, resourceType: "Epic", id: parsed.data.epicId });
      }

      const currentGate = epic.stageGate as StageGate;
      const validNext = VALID_TRANSITIONS[currentGate] ?? [];

      if (!validNext.includes(parsed.data.toGate)) {
        return err({
          kind: "hierarchy_violation" as const,
          violatedConstraint: "stage_gate_transition",
          detail: `Cannot transition from ${currentGate} to ${parsed.data.toGate}`,
        });
      }

      await tx.initiative.update({
        where: { id: parsed.data.epicId },
        data: { stageGate: parsed.data.toGate, updatedBy: principal.id },
      });

      await emitAuditEvent(tx as unknown as typeof db, {
        tenantId: principal.tenantId as TenantId,
        actorId: principal.id as UserId,
        action: "initiative.stage_gate.advanced",
        resourceType: "initiative",
        resourceId: parsed.data.epicId,
        ipAddress,
        userAgent,
        changes: {
          stageGate: { before: currentGate, after: parsed.data.toGate },
          ...(parsed.data.comment !== undefined && {
            comment: { before: null, after: parsed.data.comment },
          }),
        },
      });

      return ok(undefined);
    })
    .catch((e: unknown) => {
      throw e;
    });

  const result = rawResult as unknown as Result<undefined>;

  if (isErr(result)) {
    if (result.error.kind === "not_found") return { error: "Epic not found" };
    if (result.error.kind === "hierarchy_violation") return { error: result.error.detail };
    return { error: "Failed to advance stage gate" };
  }

  revalidatePath("/portfolio");
  return { success: true };
}
