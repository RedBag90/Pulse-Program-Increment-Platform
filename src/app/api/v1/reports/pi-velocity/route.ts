import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { problemJson } from "@/server/http/problem";
import { InitiativeLevel } from "@/domain/types";

/**
 * PI velocity: completed vs planned story points per Program Increment.
 * Optional `?artId=` narrows to a single ART.
 */
export async function GET(request: Request): Promise<Response> {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) return problemJson(401, "unauthorized");

  const artId = new URL(request.url).searchParams.get("artId");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const pis = await db.programIncrement.findMany({
    where: { tenantId: principal.tenantId, ...(artId !== null && { artId }) },
    select: { id: true, name: true, startDate: true },
    orderBy: { startDate: "asc" },
  });

  const stories = await db.initiative.groupBy({
    by: ["piId", "status"],
    where: {
      tenantId: principal.tenantId,
      level: InitiativeLevel.STORY,
      deletedAt: null,
      piId: { in: pis.map((p) => p.id) },
    },
    _sum: { storyPoints: true },
  });

  const velocity = pis.map((pi) => {
    const rows = stories.filter((s) => s.piId === pi.id);
    const total = rows.reduce((sum, r) => sum + (r._sum.storyPoints ?? 0), 0);
    const completed = rows
      .filter((r) => r.status === "completed" || r.status === "done")
      .reduce((sum, r) => sum + (r._sum.storyPoints ?? 0), 0);
    return { piId: pi.id, piName: pi.name, completedPoints: completed, plannedPoints: total };
  });

  return Response.json(velocity);
}
