import { type NextRequest, NextResponse } from "next/server";
import { createPrismaClient } from "@/server/db/prisma";
import { captureAllTenantSnapshots } from "@/server/services/transformation-snapshot";

// Vercel Cron invokes this route daily with the shared secret header.
// See vercel.json for the schedule definition.
function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // System-level client: lists tenants; per-tenant clients are created internally.
  const db = createPrismaClient({ userId: "system", tenantId: "system" } as never);
  const result = await captureAllTenantSnapshots(db);

  return NextResponse.json(result);
}
