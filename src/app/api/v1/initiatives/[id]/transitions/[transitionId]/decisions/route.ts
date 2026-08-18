import { z } from "zod";
import { createMutationHandler } from "@/server/http/mutation-handler";
import { decideGateTransition } from "@/modules/work/server/services/stage-gate-transition";

/**
 * `POST /api/v1/initiatives/:id/transitions/:transitionId/decisions` — die
 * namentliche Abnahme eines beantragten Reifegrad-Wechsels.
 *
 * `epic.gate.decide` ist hier nur der grobe Vorfilter; maßgeblich ist die
 * Zeilen-Prüfung im Service: entscheiden darf ausschliesslich die Person, die
 * beim Antrag als Abnehmerin eingefroren wurde (ADR-0002).
 */
const decisionSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  comment: z.string().max(1000).optional(),
});

interface Ctx {
  params: Promise<{ id: string; transitionId: string }>;
}

export async function POST(request: Request, { params }: Ctx): Promise<Response> {
  const { transitionId } = await params;
  return createMutationHandler({
    schema: decisionSchema,
    action: "epic.gate.decide",
    resource: (_input, p) => ({ tenantId: p.tenantId }),
    service: (ctx, input) =>
      decideGateTransition(ctx, {
        transitionId,
        decision: input.decision,
        comment: input.comment,
      }),
    successStatus: 200,
  })(request);
}
