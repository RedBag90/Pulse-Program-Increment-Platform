import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { problemJson } from "@/server/http/problem";
import { InitiativeLevel } from "@/domain/types";

/** Portfolio health: epic counts by status and value-stream budget rollup. */
export async function GET(): Promise<Response> {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) return problemJson(401, "unauthorized");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const [epicGroups, valueStreams] = await Promise.all([
    db.initiative.groupBy({
      by: ["status"],
      where: { tenantId: principal.tenantId, level: InitiativeLevel.EPIC, deletedAt: null },
      _count: { _all: true },
    }),
    db.valueStream.findMany({
      where: { tenantId: principal.tenantId },
      select: { id: true, name: true, budgetAmount: true, budgetCurrency: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const epicsByStatus = Object.fromEntries(epicGroups.map((g) => [g.status, g._count._all]));

  return Response.json({
    epicsByStatus,
    totalEpics: epicGroups.reduce((sum, g) => sum + g._count._all, 0),
    valueStreams,
  });
}
