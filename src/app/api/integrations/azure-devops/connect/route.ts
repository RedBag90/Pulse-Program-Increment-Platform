import { NextResponse } from "next/server";
import { requirePrincipal } from "@/server/auth/principal";
import { buildAuthorizationUrl } from "@/server/integrations/azure-devops/oauth";

export async function GET(): Promise<NextResponse> {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const state = crypto.randomUUID();
  const url = buildAuthorizationUrl(state);

  const res = NextResponse.redirect(url);
  res.cookies.set("ado_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return res;
}
