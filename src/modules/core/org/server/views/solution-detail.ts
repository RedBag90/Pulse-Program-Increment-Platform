/**
 * Read-Model der Solution-Detailseite: Kopf + Lebenszyklus — der
 * **Strukturknoten**.
 *
 * **Grow und die Primär-Epics stehen hier bewusst nicht drin**, ebenso wenig
 * wie Run. Beides gehört oberen Modulen (Work bzw. Budgeting), und Core darf
 * nach ADR-0013 nicht dorthin importieren. Die Route komponiert.
 */

import type { PrismaClient } from "@/generated/prisma";
import { notDeleted } from "@/server/db/soft-delete";
import { isHorizon, type Horizon } from "@/modules/core/org/domain/horizon";
import { isInvestmentMode, type InvestmentMode } from "@/modules/core/org/domain/solution";

export interface SolutionDetailModel {
  id: string;
  name: string;
  description: string | null;
  valueStreamId: string;
  valueStreamName: string | null;
  artId: string | null;
  artName: string | null;
  horizon: Horizon;
  investmentMode: InvestmentMode | null;
  /** Namentlich Verantwortliche:r; `null` = nicht zugewiesen. */
  productManagerId: string | null;
}

export async function loadSolutionDetail(
  db: PrismaClient,
  tenantId: string,
  id: string,
): Promise<SolutionDetailModel | null> {
  const s = await db.solution.findFirst({
    where: { id, tenantId, ...notDeleted },
    select: {
      id: true,
      name: true,
      description: true,
      valueStreamId: true,
      artId: true,
      horizon: true,
      investmentMode: true,
      productManagerId: true,
      valueStream: { select: { name: true } },
      art: { select: { name: true } },
    },
  });
  if (!s) return null;

  return {
    id: s.id,
    name: s.name,
    description: s.description,
    valueStreamId: s.valueStreamId,
    valueStreamName: s.valueStream?.name ?? null,
    artId: s.artId,
    artName: s.art?.name ?? null,
    horizon: (isHorizon(s.horizon) ? s.horizon : "h1") as Horizon,
    investmentMode: isInvestmentMode(s.investmentMode) ? s.investmentMode : null,
    productManagerId: s.productManagerId,
  };
}
