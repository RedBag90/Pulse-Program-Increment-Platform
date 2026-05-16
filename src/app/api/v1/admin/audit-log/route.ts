import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { problemJson } from "@/server/http/problem";
import { ROLES } from "@/domain/roles";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/** Tenant audit log, filterable and cursor-paginated. Tenant Admin only. */
export async function GET(request: Request): Promise<Response> {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) return problemJson(401, "unauthorized");

  const isAdmin =
    principal.roles.includes(ROLES.TENANT_ADMIN) || principal.roles.includes(ROLES.PLATFORM_ADMIN);
  if (!isAdmin) return problemJson(403, "forbidden");

  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor");
  const limit = Math.min(Number(url.searchParams.get("limit")) || DEFAULT_LIMIT, MAX_LIMIT);
  const actorId = url.searchParams.get("actorId");
  const action = url.searchParams.get("action");
  const resourceType = url.searchParams.get("resourceType");
  const since = url.searchParams.get("since");
  const until = url.searchParams.get("until");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const rows = await db.auditEvent.findMany({
    where: {
      tenantId: principal.tenantId,
      ...(actorId !== null && { actorId }),
      ...(action !== null && { action }),
      ...(resourceType !== null && { resourceType }),
      ...((since !== null || until !== null) && {
        occurredAt: {
          ...(since !== null && { gte: new Date(since) }),
          ...(until !== null && { lte: new Date(until) }),
        },
      }),
    },
    orderBy: { occurredAt: "desc" },
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
