import { z } from "zod";
import { createMutationHandler } from "@/server/http/mutation-handler";
import { advanceStageGate } from "@/server/services/epic";
import { STAGE_GATES } from "@/modules/work/domain/stage-gate";
import type { EpicId } from "@/modules/core/kernel/domain/types";

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
    service: (ctx, input) =>
      advanceStageGate(ctx, {
        epicId: id as EpicId,
        toGate: input.toGate,
        comment: input.comment,
      }),
    successStatus: 200,
  })(request);
}
