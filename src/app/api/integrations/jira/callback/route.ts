import { type NextRequest, NextResponse } from "next/server";
import { requirePrincipal } from "@/server/auth/principal";
import { exchangeCodeForTokens, getAccessibleResource } from "@/server/integrations/jira/oauth";
import { createPrismaClient } from "@/server/db/prisma";
import { problemJson } from "@/server/http/problem";
import type { TenantId } from "@/domain/types";

export async function GET(req: NextRequest) {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) return problemJson(401, "Unauthorized");

  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/admin/integrations?error=${encodeURIComponent(error)}`, req.url),
    );
  }

  if (!code || !state) return problemJson(400, "Missing code or state");

  // Verify CSRF state
  const storedState = req.cookies.get("jira_oauth_state")?.value;
  if (!storedState || storedState !== state) {
    return problemJson(400, "Invalid OAuth state — possible CSRF");
  }

  const redirectTo = req.cookies.get("jira_oauth_redirect")?.value ?? "/admin/integrations";

  try {
    const tokens = await exchangeCodeForTokens(code);
    const site = await getAccessibleResource(tokens.accessToken);

    const webhookSecret = crypto.randomUUID().replace(/-/g, "");

    const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

    await db.jiraConfig.upsert({
      where: { tenantId: principal.tenantId as TenantId },
      create: {
        tenantId: principal.tenantId as TenantId,
        cloudId: site.id,
        instanceUrl: site.url,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiresAt: new Date(Date.now() + tokens.expiresInSeconds * 1000),
        projectKeyMap: {},
        webhookSecret,
      },
      update: {
        cloudId: site.id,
        instanceUrl: site.url,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiresAt: new Date(Date.now() + tokens.expiresInSeconds * 1000),
      },
    });

    const response = NextResponse.redirect(new URL(`${redirectTo}?connected=1`, req.url));
    response.cookies.delete("jira_oauth_state");
    response.cookies.delete("jira_oauth_redirect");
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.redirect(
      new URL(`/admin/integrations?error=${encodeURIComponent(message)}`, req.url),
    );
  }
}
