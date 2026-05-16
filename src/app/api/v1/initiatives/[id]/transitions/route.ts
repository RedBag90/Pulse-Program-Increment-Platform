import { z } from "zod";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { authorize } from "@/server/auth/authorize";
import { withIdempotency } from "@/server/http/idempotency";
import { forbidden, unprocessable, problemJson } from "@/server/http/problem";
import { extractRequestMeta, emitAuditEvent } from "@/server/audit/emit";
import { headers } from "next/headers";
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

const transitionSchema = z.object({
  toGate: z.enum(STAGE_GATES),
  comment: z.string().optional(),
});

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: Ctx): Promise<Response> {
  const { id } = await params;

  const principal = await requirePrincipal().catch(() => null);
  if (!principal) return problemJson(401, "unauthorized");

  const decision = authorize("epic.approve", { tenantId: principal.tenantId }, principal);
  if (!decision.allow) return forbidden(decision.reason);

  return withIdempotency(request, principal, async (request) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return unprocessable("Invalid JSON body");
    }

    const parsed = transitionSchema.safeParse(body);
    if (!parsed.success) return unprocessable(parsed.error.message);

    const { ipAddress, userAgent } = extractRequestMeta(await headers());
    const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

    const rawResult = await db
      .$transaction(async (tx) => {
        const epic = await tx.initiative.findFirst({
          where: { id, tenantId: principal.tenantId, level: 0, deletedAt: null },
        });

        if (!epic) {
          return err({ kind: "not_found" as const, resourceType: "Epic", id });
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
          where: { id },
          data: { stageGate: parsed.data.toGate, updatedBy: principal.id },
        });

        await emitAuditEvent(tx as unknown as typeof db, {
          tenantId: principal.tenantId as TenantId,
          actorId: principal.id as UserId,
          action: "initiative.stage_gate.advanced",
          resourceType: "initiative",
          resourceId: id,
          ipAddress,
          userAgent,
          changes: {
            stageGate: { before: currentGate, after: parsed.data.toGate },
            ...(parsed.data.comment !== undefined && {
              comment: { before: null, after: parsed.data.comment },
            }),
          },
        });

        return ok({ from: currentGate, to: parsed.data.toGate });
      })
      .catch((e: unknown) => {
        throw e;
      });

    const result = rawResult as unknown as Result<{ from: StageGate; to: StageGate }>;

    if (isErr(result)) {
      if (result.error.kind === "not_found") return problemJson(404, "not_found");
      if (result.error.kind === "hierarchy_violation") {
        return problemJson(422, "invalid_transition", { detail: result.error.detail });
      }
      return problemJson(500, "internal_error");
    }

    return Response.json(result.value, { status: 200 });
  });
}
