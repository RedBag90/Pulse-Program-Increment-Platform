import { z } from "zod";
import {
  updatePiObjective,
  deletePiObjective,
  type PiObjectiveId,
} from "@/server/services/pi-objective";
import { createMutationHandler } from "@/server/http/mutation-handler";

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  businessValue: z.number().int().min(1).max(10).optional(),
  committed: z.boolean().optional(),
});

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: Ctx): Promise<Response> {
  const { id } = await params;
  return createMutationHandler({
    schema: patchSchema,
    action: "pi_objective.update",
    resource: (_input, p) => ({ tenantId: p.tenantId }),
    service: (ctx, input) => updatePiObjective(ctx, { id: id as PiObjectiveId, ...input }),
    successStatus: 204,
    idempotent: false,
  })(request);
}

export async function DELETE(request: Request, { params }: Ctx): Promise<Response> {
  const { id } = await params;
  return createMutationHandler({
    schema: z.object({}),
    action: "pi_objective.update",
    resource: (_input, p) => ({ tenantId: p.tenantId }),
    service: (ctx) => deletePiObjective(ctx, { id: id as PiObjectiveId }),
    successStatus: 204,
    idempotent: false,
  })(request);
}
