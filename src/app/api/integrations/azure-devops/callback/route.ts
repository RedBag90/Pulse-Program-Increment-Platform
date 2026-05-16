import { type NextRequest, NextResponse } from "next/server";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import {
  exchangeCodeForTokens,
  getOrganizationProfile,
} from "@/server/integrations/azure-devops/oauth";
import type { TenantId } from "@/domain/types";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const storedState = req.cookies.get("ado_oauth_state")?.value;

  if (!code || !state || state !== storedState) {
    return NextResponse.json({ error: "Invalid state or missing code" }, { status: 400 });
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const { organization } = await getOrganizationProfile(tokens.access_token);

    const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

    await db.azureDevOpsConfig.upsert({
      where: { tenantId: principal.tenantId as TenantId },
      create: {
        tenantId: principal.tenantId as TenantId,
        organization,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        webhookSecret: crypto.randomUUID().replace(/-/g, ""),
      },
      update: {
        organization,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      },
    });

    const res = NextResponse.redirect(
      new URL("/admin/integrations", process.env.NEXT_PUBLIC_APP_URL),
    );
    res.cookies.delete("ado_oauth_state");
    return res;
  } catch (e) {
    console.error("ADO callback error", e);
    return NextResponse.json({ error: "OAuth exchange failed" }, { status: 500 });
  }
}
