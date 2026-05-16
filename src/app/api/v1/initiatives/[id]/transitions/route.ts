import { z } from "zod";
import { createMutationHandler } from "@/server/http/mutation-handler";
import { emitAuditEvent } from "@/server/audit/emit";
import { err, ok } from "@/domain/errors";
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

const transitionSchema = z.object({
  toGate: z.enum(STAGE_GATES),
  comment: z.string().optional(),
});

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: Ctx): Promise<Response> {
  const { id } = await params;
  return createMutationHandler({
    schema: transitionSchema,
    action: "epic.approve",
    resource: (_input, p) => ({ tenantId: p.tenantId }),
    service: async (ctx, input) => {
      return ctx.db.$transaction(async (tx) => {
        const epic = await tx.initiative.findFirst({
          where: { id, tenantId: ctx.principal.tenantId, level: 0, deletedAt: null },
        });

        if (!epic) {
          return err({ kind: "not_found" as const, resourceType: "Epic", id });
        }

        const currentGate = epic.stageGate as StageGate;
        const validNext = VALID_TRANSITIONS[currentGate] ?? [];

        if (!validNext.includes(input.toGate)) {
          return err({
            kind: "hierarchy_violation" as const,
            violatedConstraint: "stage_gate_transition",
            detail: `Cannot transition from ${currentGate} to ${input.toGate}`,
          });
        }

        await tx.initiative.update({
          where: { id },
          data: { stageGate: input.toGate, updatedBy: ctx.principal.id },
        });

        await emitAuditEvent(tx as unknown as typeof ctx.db, {
          tenantId: ctx.principal.tenantId as TenantId,
          actorId: ctx.principal.id as UserId,
          action: "initiative.stage_gate.advanced",
          resourceType: "initiative",
          resourceId: id,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
          changes: {
            stageGate: { before: currentGate, after: input.toGate },
            ...(input.comment !== undefined && {
              comment: { before: null, after: input.comment },
            }),
          },
        });

        return ok({ from: currentGate, to: input.toGate });
      });
    },
    successStatus: 200,
  })(request);
}
