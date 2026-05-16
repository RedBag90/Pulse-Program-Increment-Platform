import { type NextRequest, NextResponse } from "next/server";
import { requirePrincipal } from "@/server/auth/principal";
import { authorize } from "@/server/auth/authorize";
import { createPrismaClient } from "@/server/db/prisma";
import { exportUserData } from "@/server/services/gdpr";
import { emitAuditEvent } from "@/server/audit/emit";
import { unauthorized, forbidden } from "@/server/http/problem";
import type { TenantId, UserId } from "@/domain/types";

/** GDPR data export — returns everything Pulse holds about a user as a JSON download. */
export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ userId: string }> },
): Promise<Response> {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) return unauthorized();

  const decision = authorize("admin.users.read", { tenantId: principal.tenantId }, principal);
  if (!decision.allow) return forbidden(decision.reason);

  const { userId } = await ctx.params;
  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const data = await exportUserData(db, principal.tenantId as TenantId, userId as UserId);

  await emitAuditEvent(db, {
    tenantId: principal.tenantId,
    actorId: principal.id,
    action: "user.data_exported",
    resourceType: "user",
    resourceId: userId,
  });

  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="pulse-user-${userId}-export.json"`,
    },
  });
}
