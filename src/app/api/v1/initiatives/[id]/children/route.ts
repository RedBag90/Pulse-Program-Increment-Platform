import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { problemJson } from "@/server/http/problem";

interface Ctx {
  params: Promise<{ id: string }>;
}

/** Direct children of an initiative (one level down). */
export async function GET(_request: Request, { params }: Ctx): Promise<Response> {
  const { id } = await params;
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) return problemJson(401, "unauthorized");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const parent = await db.initiative.findFirst({
    where: { id, tenantId: principal.tenantId, deletedAt: null },
    select: { id: true },
  });
  if (!parent) return problemJson(404, "not_found");

  const children = await db.initiative.findMany({
    where: { parentId: id, tenantId: principal.tenantId, deletedAt: null },
    orderBy: { createdAt: "asc" },
  });

  return Response.json(children);
}
