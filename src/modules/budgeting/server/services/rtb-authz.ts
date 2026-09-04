/**
 * Wer darf die Run-the-Business-Positionen eines Wertstroms bewegen?
 *
 * Zwei Wege führen hin, und sie sind bewusst verschieden begründet:
 *
 *  - Die **Finance-Partei** des Wertstroms (`ValueStream.financeApproverId`) —
 *    eine zeilenabhängige Zuständigkeit, die sich nicht als Capability
 *    ausdrücken lässt und deshalb vor der RBAC-Prüfung steht.
 *  - Die **Capability** `rtb_item.manage` (Wertstrom-Owner, Portfolio-Management,
 *    Tenant-Admin), auf den Wertstrom bezogen.
 *
 * Die Regel stand wortgleich in `rtb-item-service.ts` und `rtb-award-service.ts`
 * — zwei Kopien, die sich nur in ihrer Fehlermeldung unterschieden. Sie leben
 * jetzt hier; der Aufrufer sagt über `purpose`, wovon er spricht.
 */

import type { Prisma } from "@/generated/prisma";
import type { RequestContext } from "@/server/http/mutation-handler";
import { err, type Result } from "@/modules/core/kernel/domain/errors";
import { authorizeResource } from "@/server/auth/authorize";

/** Wovon der Aufrufer spricht — trägt nur die Fehlermeldung. */
export type RtbManagePurpose = "items" | "awards";

const REASON: Record<RtbManagePurpose, string> = {
  items:
    "Nur der Wertstrom-Owner/Finance-Partei (oder Portfolio-Manager/Admin) darf Run-the-Business-Positionen pflegen.",
  awards:
    "Nur der Wertstrom-Owner, die Finance-Partei oder das Portfolio-Management dürfen den Zuspruch aufteilen.",
};

/** VS-scoped Autorisierung + Finance-Bypass. `null` = erlaubt. */
export async function assertRtbManage(
  ctx: RequestContext,
  tx: Prisma.TransactionClient,
  tenantId: string,
  valueStreamId: string,
  purpose: RtbManagePurpose,
): Promise<Result<never> | null> {
  const vs = await tx.valueStream.findFirst({
    where: { id: valueStreamId, tenantId },
    select: { financeApproverId: true },
  });
  if (!vs)
    return err({ kind: "not_found" as const, resourceType: "ValueStream", id: valueStreamId });
  if (vs.financeApproverId === ctx.principal.id) return null;
  const decision = authorizeResource(ctx.principal, "rtb_item.manage", { tenantId, valueStreamId });
  if (!decision.ok) return err({ kind: "forbidden" as const, reason: REASON[purpose] });
  return null;
}
