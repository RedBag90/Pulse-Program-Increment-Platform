/**
 * Jira Cloud OAuth 2.0 (3-LO) helpers.
 * Docs: https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/
 */

const ATLASSIAN_AUTH_BASE = "https://auth.atlassian.com";
const ATLASSIAN_API_BASE = "https://api.atlassian.com";

// Scopes needed for reading/writing issues and registering webhooks
const SCOPES = [
  "read:jira-work",
  "write:jira-work",
  "read:jira-user",
  "offline_access", // required to receive refresh_token
].join(" ");

export interface JiraTokens {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
}

export interface JiraCloudResource {
  id: string; // cloudId
  url: string; // instance URL e.g. https://yoursite.atlassian.net
  name: string;
}

export function buildAuthorizationUrl(state: string): string {
  const clientId = process.env.JIRA_CLIENT_ID;
  const redirectUri = process.env.JIRA_REDIRECT_URI;
  if (!clientId || !redirectUri) throw new Error("JIRA_CLIENT_ID / JIRA_REDIRECT_URI not set");

  const params = new URLSearchParams({
    audience: "api.atlassian.com",
    client_id: clientId,
    scope: SCOPES,
    redirect_uri: redirectUri,
    state,
    response_type: "code",
    prompt: "consent",
  });

  return `${ATLASSIAN_AUTH_BASE}/authorize?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string): Promise<JiraTokens> {
  const clientId = process.env.JIRA_CLIENT_ID;
  const clientSecret = process.env.JIRA_CLIENT_SECRET;
  const redirectUri = process.env.JIRA_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Jira OAuth env vars not configured");
  }

  const res = await fetch(`${ATLASSIAN_AUTH_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresInSeconds: data.expires_in,
  };
}

export async function refreshAccessToken(refreshToken: string): Promise<JiraTokens> {
  const clientId = process.env.JIRA_CLIENT_ID;
  const clientSecret = process.env.JIRA_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Jira OAuth env vars not configured");

  const res = await fetch(`${ATLASSIAN_AUTH_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresInSeconds: data.expires_in,
  };
}

/**
 * Returns the first accessible Jira Cloud site for the authenticated user.
 * Most tenants have exactly one site.
 */
export async function getAccessibleResource(accessToken: string): Promise<JiraCloudResource> {
  const res = await fetch(`${ATLASSIAN_API_BASE}/oauth/token/accessible-resources`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });

  if (!res.ok) throw new Error(`accessible-resources failed: ${res.status}`);

  const sites = (await res.json()) as JiraCloudResource[];
  const site = sites[0];
  if (!site) throw new Error("No accessible Jira Cloud sites found");
  return site;
}
