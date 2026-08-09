import type { PrismaClient } from "@/generated/prisma";
import type { Principal } from "@/server/auth/principal";
import { getRiskSettings } from "@/modules/risks/server/services/risk-settings";
import { RISK_LIST_INCLUDE } from "@/modules/risks/server/services/risk";
import { riskReadFilter } from "@/modules/risks/server/services/risk-read-scope";
import { listTenantUserLabels } from "@/server/services/tenant-users";
import { buildRisksListModel, type RisksListModel } from "@/modules/risks/server/views/risks-list";

export interface EpicRisksView {
  model: RisksListModel;
  prefix: string;
  userLabels: Record<string, string>;
  riskCount: number;
  suggestionCount: number;
}

/**
 * Full epic-scoped risks model — the risks linked to this Epic (via `RiskEpicLink`
 * and read-scoped to the principal), through the shared `buildRisksListModel`. The
 * Epic detail page's Risks tab renders the same `RisksManager` off this (Work never
 * imports risks — the Epic route, as composition root, does; ADR-0013).
 */
export async function loadEpicRisksModel(
  db: PrismaClient,
  principal: Principal,
  epicId: string,
): Promise<EpicRisksView> {
  const [settings, userLabels, risks] = await Promise.all([
    getRiskSettings(db, principal.tenantId),
    listTenantUserLabels(db, principal.tenantId),
    db.risk.findMany({
      where: {
        tenantId: principal.tenantId,
        deletedAt: null,
        epicLinks: { some: { epicId } },
        AND: [riskReadFilter(principal)],
      },
      orderBy: { createdAt: "desc" },
      include: RISK_LIST_INCLUDE,
    }),
  ]);

  const model = buildRisksListModel({ risks, prefix: settings.prefix, userLabels });
  return {
    model,
    prefix: settings.prefix,
    userLabels,
    riskCount: model.rows.length,
    suggestionCount: model.suggestions.length,
  };
}
