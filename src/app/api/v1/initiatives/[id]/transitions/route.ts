import { z } from "zod";
import { createMutationHandler } from "@/server/http/mutation-handler";
import { requestGateTransition } from "@/modules/work/server/services/stage-gate-transition";
import { STAGE_GATES } from "@/modules/work/domain/stage-gate";

/**
 * `POST /api/v1/initiatives/:id/transitions` — **beantragt** einen
 * Reifegrad-Wechsel.
 *
 * Vorher vollzog dieser Endpunkt den Wechsel direkt. Das geht nicht mehr: ein
 * Wechsel wird von namentlich benannten Personen abgenommen, also legt der
 * Aufruf einen Antrag an (201) und liefert dessen Id zurück. Die Abnahme läuft
 * über `POST /api/v1/initiatives/:id/transitions/:transitionId/decisions`.
 *
 * Ist für das Ziel-Gate keine Abnahme konfiguriert (`required: false`), rückt
 * der Antrag in derselben Transaktion vor — der Response unterscheidet das über
 * `status: "approved"` statt `"pending"`.
 */
const transitionSchema = z.object({
  toGate: z.enum(STAGE_GATES),
  reason: z.string().max(1000).optional(),
});

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: Ctx): Promise<Response> {
  const { id } = await params;
  return createMutationHandler({
    schema: transitionSchema,
    action: "epic.gate.request",
    resource: (_input, p) => ({ tenantId: p.tenantId }),
    service: (ctx, input) =>
      requestGateTransition(ctx, {
        epicId: id,
        toGate: input.toGate,
        reason: input.reason,
      }),
    successStatus: 201,
  })(request);
}
