import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { problemJson } from "@/server/http/problem";

/**
 * Dependency graph as nodes + edges. Optional `?piId=` scopes the graph to
 * features in one Program Increment (plus any initiatives they link to).
 */
export async function GET(request: Request): Promise<Response> {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) return problemJson(401, "unauthorized");

  const piId = new URL(request.url).searchParams.get("piId");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const scopedInitiatives = await db.initiative.findMany({
    where: { tenantId: principal.tenantId, deletedAt: null, ...(piId !== null && { piId }) },
    select: { id: true },
  });
  const scopedIds = scopedInitiatives.map((i) => i.id);

  const edges = await db.dependency.findMany({
    where: {
      tenantId: principal.tenantId,
      OR: [{ fromId: { in: scopedIds } }, { toId: { in: scopedIds } }],
    },
    select: { id: true, fromId: true, toId: true, type: true },
  });

  // Node set: scoped initiatives plus any endpoints referenced by edges.
  const nodeIds = new Set<string>(scopedIds);
  for (const e of edges) {
    nodeIds.add(e.fromId);
    nodeIds.add(e.toId);
  }

  const nodes = await db.initiative.findMany({
    where: { id: { in: [...nodeIds] }, tenantId: principal.tenantId },
    select: { id: true, title: true, level: true, status: true, piId: true },
  });

  return Response.json({ nodes, edges });
}
