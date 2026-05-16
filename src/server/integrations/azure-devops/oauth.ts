// Azure DevOps OAuth 2.0 (3-LO) helpers
// Docs: https://learn.microsoft.com/en-us/azure/devops/integrate/get-started/authentication/oauth

const AUTH_BASE = "https://app.vssps.visualstudio.com/oauth2";

export function buildAuthorizationUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.AZURE_DEVOPS_CLIENT_ID!,
    response_type: "Assertion",
    state,
    scope: "vso.work_full",
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/azure-devops/callback`,
  });
  return `${AUTH_BASE}/authorize?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  const body = new URLSearchParams({
    client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
    client_assertion: process.env.AZURE_DEVOPS_CLIENT_SECRET!,
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: code,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/azure-devops/callback`,
  });

  const res = await fetch(`${AUTH_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) throw new Error(`ADO token exchange failed: ${res.status}`);
  return res.json() as Promise<TokenResponse>;
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const body = new URLSearchParams({
    client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
    client_assertion: process.env.AZURE_DEVOPS_CLIENT_SECRET!,
    grant_type: "refresh_token",
    assertion: refreshToken,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/azure-devops/callback`,
  });

  const res = await fetch(`${AUTH_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) throw new Error(`ADO token refresh failed: ${res.status}`);
  return res.json() as Promise<TokenResponse>;
}

export async function getOrganizationProfile(
  accessToken: string,
): Promise<{ organization: string }> {
  // Fetch the authenticated user's profile to get their default organization
  const res = await fetch(
    "https://app.vssps.visualstudio.com/_apis/profile/profiles/me?api-version=7.1",
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  if (!res.ok) throw new Error(`ADO profile fetch failed: ${res.status}`);
  const data = (await res.json()) as { coreAttributes?: { PublicAlias?: { value?: string } } };
  const organization = data.coreAttributes?.PublicAlias?.value ?? "unknown";
  return { organization };
}
