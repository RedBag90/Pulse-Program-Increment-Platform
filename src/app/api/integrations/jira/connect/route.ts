import { type NextRequest, NextResponse } from "next/server";
import { requirePrincipal } from "@/server/auth/principal";
import { buildAuthorizationUrl } from "@/server/integrations/jira/oauth";
import { problemJson } from "@/server/http/problem";

export async function GET(req: NextRequest) {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) return problemJson(401, "Unauthorized");

  const canManage =
    principal.roles.includes("tenant_admin") || principal.roles.includes("platform_admin");
  if (!canManage) return problemJson(403, "Forbidden");

  const state = crypto.randomUUID();
  const redirectTo = req.nextUrl.searchParams.get("redirectTo") ?? "/admin/integrations";

  const url = buildAuthorizationUrl(state);

  const response = NextResponse.redirect(url);
  response.cookies.set("jira_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  response.cookies.set("jira_oauth_redirect", redirectTo, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  return response;
}
