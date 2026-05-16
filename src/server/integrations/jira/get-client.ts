import type { PrismaClient } from "@/generated/prisma";
import type { TenantId } from "@/domain/types";
import { refreshAccessToken } from "./oauth";
import { JiraClient } from "./client";

/**
 * Returns an authenticated JiraClient for the given tenant.
 * Automatically refreshes the access token if it has expired.
 * Returns null if the tenant has no Jira integration configured.
 */
export async function getJiraClient(
  db: PrismaClient,
  tenantId: TenantId,
): Promise<JiraClient | null> {
  const config = await db.jiraConfig.findUnique({ where: { tenantId } });
  if (!config) return null;

  let { accessToken, refreshToken, tokenExpiresAt } = config;

  // Refresh if token expires within the next 60 seconds
  if (tokenExpiresAt <= new Date(Date.now() + 60_000)) {
    const tokens = await refreshAccessToken(refreshToken);
    accessToken = tokens.accessToken;
    refreshToken = tokens.refreshToken;

    await db.jiraConfig.update({
      where: { tenantId },
      data: {
        accessToken,
        refreshToken,
        tokenExpiresAt: new Date(Date.now() + tokens.expiresInSeconds * 1000),
      },
    });
  }

  return new JiraClient(config.cloudId, accessToken);
}
