import type { PrismaClient } from "@/generated/prisma";
import type { TenantId } from "@/modules/core/kernel/domain/types";
import { getRiskSettings } from "@/modules/risks/server/services/risk-settings";
import {
  buildRisksListModel,
  type MatrixCellCount,
  type MatrixPlot,
} from "@/modules/risks/server/views/risks-list";

export interface EpicRiskMatrix {
  cells: MatrixCellCount[];
  plots: MatrixPlot[];
  riskCount: number;
  suggestionCount: number;
}

/**
 * Epic-scoped risk matrix — the risks linked to this Epic via `RiskEpicLink`,
 * run through the shared `buildRisksListModel` aggregation (same band + number
 * source of truth). Consumed by the Epic detail page's Risks tab through a port
 * (Work never imports this module — ADR-0013).
 */
export async function loadEpicRiskMatrix(
  db: PrismaClient,
  tenantId: TenantId,
  epicId: string,
): Promise<EpicRiskMatrix> {
  const [settings, risks] = await Promise.all([
    getRiskSettings(db, tenantId),
    db.risk.findMany({
      where: { tenantId, deletedAt: null, epicLinks: { some: { epicId } } },
      include: {
        assessments: { orderBy: { createdAt: "asc" } },
        epicLinks: { select: { epicId: true } },
        mitigations: { select: { id: true } },
      },
    }),
  ]);

  const model = buildRisksListModel({ risks, prefix: settings.prefix, userLabels: {} });
  return {
    cells: model.matrix.cells,
    plots: model.matrix.plots,
    riskCount: model.rows.length,
    suggestionCount: model.suggestions.length,
  };
}
