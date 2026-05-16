import { z } from "zod";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { createValueStream, listValueStreams } from "@/server/services/value-stream";
import { authorize } from "@/server/auth/authorize";
import { withIdempotency } from "@/server/http/idempotency";
import { forbidden, unprocessable, problemJson } from "@/server/http/problem";
import { extractRequestMeta } from "@/server/audit/emit";
import { headers } from "next/headers";
import { isErr } from "@/domain/errors";

const createSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  budgetAmount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/)
    .optional(),
  budgetCurrency: z.string().length(3).optional(),
});

export async function GET(_request: Request): Promise<Response> {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) return problemJson(401, "unauthorized");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const streams = await listValueStreams(db, principal.tenantId);
  return Response.json(streams);
}

export async function POST(request: Request): Promise<Response> {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) return problemJson(401, "unauthorized");

  return withIdempotency(request, principal, async (request) => {
    const decision = authorize("value_stream.create", { tenantId: principal.tenantId }, principal);
    if (!decision.allow) return forbidden(decision.reason);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return unprocessable("Invalid JSON body");
    }

    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return unprocessable(parsed.error.message);

    const { ipAddress, userAgent } = extractRequestMeta(await headers());
    const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

    const result = await createValueStream(db, {
      tenantId: principal.tenantId,
      actorId: principal.id,
      name: parsed.data.name,
      description: parsed.data.description,
      budgetAmount: parsed.data.budgetAmount,
      budgetCurrency: parsed.data.budgetCurrency,
      ipAddress,
      userAgent,
    });

    if (isErr(result)) {
      if (result.error.kind === "conflict") {
        return problemJson(409, "conflict", { detail: result.error.reason });
      }
      return problemJson(500, "internal_error");
    }

    return Response.json(result.value, { status: 201 });
  });
}
