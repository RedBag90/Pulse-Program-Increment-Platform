import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { problemJson } from "@/server/http/problem";
import { InitiativeLevel } from "@/domain/types";

/**
 * Features across the tenant ranked by computed WSJF score (descending).
 * Optional `?artId=` narrows the leaderboard to a single ART.
 */
export async function GET(request: Request): Promise<Response> {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) return problemJson(401, "unauthorized");

  const artId = new URL(request.url).searchParams.get("artId");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const features = await db.initiative.findMany({
    where: {
      tenantId: principal.tenantId,
      level: InitiativeLevel.FEATURE,
      deletedAt: null,
      ...(artId !== null && { artId }),
    },
    select: {
      id: true,
      title: true,
      status: true,
      artId: true,
      piId: true,
      wsjfBusinessValue: true,
      wsjfTimeCriticality: true,
      wsjfRiskReduction: true,
      wsjfJobSize: true,
      wsjfComputed: true,
    },
    orderBy: { wsjfComputed: "desc" },
  });

  return Response.json(features.map((f, i) => ({ rank: i + 1, ...f })));
}
