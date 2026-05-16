import { z } from "zod";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { createTenant } from "@/server/services/tenant";
import { authorize } from "@/server/auth/authorize";
import { withIdempotency } from "@/server/http/idempotency";
import { forbidden, unprocessable, problemJson } from "@/server/http/problem";
import { extractRequestMeta } from "@/server/audit/emit";
import { headers } from "next/headers";
import { isErr } from "@/domain/errors";

const createTenantSchema = z.object({
  name: z.string().min(2).max(100),
  region: z.enum(["EU", "US", "APAC"]),
});

export async function POST(request: Request): Promise<Response> {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) {
    return problemJson(401, "unauthorized");
  }

  const decision = authorize("tenant.create", {}, principal);
  if (!decision.allow) return forbidden(decision.reason);

  return withIdempotency(request, principal, async (request) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return unprocessable("Invalid JSON body");
    }

    const parsed = createTenantSchema.safeParse(body);
    if (!parsed.success) {
      return unprocessable(parsed.error.message);
    }

    const { ipAddress, userAgent } = extractRequestMeta(await headers());
    const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

    const result = await createTenant(db, {
      name: parsed.data.name,
      region: parsed.data.region,
      actorId: principal.id,
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
