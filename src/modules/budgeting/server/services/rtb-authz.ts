/**
 * Der **Faktensammler** für das Pflegen von Run-the-Business-Positionen und das
 * Aufteilen des Zuspruchs.
 *
 * Die Entscheidung selbst steht rein in `domain/budget-access.ts`
 * (`rtbManageDeniedReason`) — hier wird nur beschafft, was sie braucht: die
 * Finance-Partei des Wertstroms aus der Datenbank und die Capability aus dem
 * Principal. Das ist die Aufteilung, die alle drei Autorisierungen des Moduls
 * jetzt teilen: Fakten sammeln ist I/O, Entscheiden ist rein und geprüft.
 */

import type { Prisma } from "@/generated/prisma";
import type { RequestContext } from "@/server/http/mutation-handler";
import { err, type Result } from "@/modules/core/kernel/domain/errors";
import { authorizeResource } from "@/server/auth/authorize";
import {
  rtbManageDeniedReason,
  type RtbManagePurpose,
} from "@/modules/budgeting/domain/budget-access";

export type { RtbManagePurpose };

/** VS-scoped Autorisierung samt Finance-Bypass. `null` = erlaubt. */
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

  const reason = rtbManageDeniedReason(
    {
      isValueStreamFinance: vs.financeApproverId === ctx.principal.id,
      hasRtbCapability: authorizeResource(ctx.principal, "rtb_item.manage", {
        tenantId,
        valueStreamId,
      }).ok,
    },
    purpose,
  );
  return reason == null ? null : err({ kind: "forbidden" as const, reason });
}
