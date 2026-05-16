import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { problemJson } from "@/server/http/problem";

interface Ctx {
  params: Promise<{ id: string }>;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/**
 * Full subtree of an initiative, cursor-paginated (concept §8.2). Descendants
 * are resolved via the materialized `path` column.
 */
export async function GET(request: Request, { params }: Ctx): Promise<Response> {
  const { id } = await params;
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) return problemJson(401, "unauthorized");

  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor");
  const limit = Math.min(Number(url.searchParams.get("limit")) || DEFAULT_LIMIT, MAX_LIMIT);

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const root = await db.initiative.findFirst({
    where: { id, tenantId: principal.tenantId, deletedAt: null },
    select: { id: true, path: true },
  });
  if (!root) return problemJson(404, "not_found");

  const rows = await db.initiative.findMany({
    where: {
      tenantId: principal.tenantId,
      deletedAt: null,
      path: { startsWith: `${root.path}/` },
    },
    orderBy: { id: "asc" },
    take: limit + 1,
    ...(cursor !== null && { cursor: { id: cursor }, skip: 1 }),
  });

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;

  return Response.json({
    items,
    nextCursor: hasMore ? (items[items.length - 1]?.id ?? null) : null,
  });
}
