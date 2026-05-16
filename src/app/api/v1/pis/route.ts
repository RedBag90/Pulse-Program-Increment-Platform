import { z } from "zod";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { createPi, listPis } from "@/server/services/pi";
import { authorize } from "@/server/auth/authorize";
import { forbidden, unprocessable, problemJson } from "@/server/http/problem";
import { extractRequestMeta } from "@/server/audit/emit";
import { headers } from "next/headers";
import { isErr } from "@/domain/errors";
import type { ArtId } from "@/domain/types";

const createSchema = z.object({
  artId: z.string().uuid(),
  name: z.string().min(1).max(100),
  startDate: z.string().date(),
  endDate: z.string().date(),
});

export async function GET(request: Request): Promise<Response> {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) return problemJson(401, "unauthorized");

  const { searchParams } = new URL(request.url);
  const artId = searchParams.get("artId");
  if (!artId) return unprocessable("artId query parameter is required");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  return Response.json(await listPis(db, principal.tenantId, artId as ArtId));
}

export async function POST(request: Request): Promise<Response> {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) return problemJson(401, "unauthorized");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return unprocessable("Invalid JSON body");
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return unprocessable(parsed.error.message);

  const decision = authorize(
    "pi.create",
    { tenantId: principal.tenantId, artId: parsed.data.artId },
    principal,
  );
  if (!decision.allow) return forbidden(decision.reason);

  const { ipAddress, userAgent } = extractRequestMeta(await headers());
  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const result = await createPi(db, {
    tenantId: principal.tenantId,
    actorId: principal.id,
    artId: parsed.data.artId as ArtId,
    name: parsed.data.name,
    startDate: new Date(parsed.data.startDate),
    endDate: new Date(parsed.data.endDate),
    ipAddress,
    userAgent,
  });

  if (isErr(result)) {
    if (result.error.kind === "not_found") return problemJson(404, "not_found");
    if (result.error.kind === "conflict")
      return problemJson(409, "conflict", { detail: result.error.reason });
    return problemJson(500, "internal_error");
  }

  return Response.json(result.value, { status: 201 });
}
