import type { PrismaClient } from "@/generated/prisma";
import type { TenantId } from "@/domain/types";
import { AzureDevOpsClient } from "./client";
import { refreshAccessToken } from "./oauth";

export async function getAzureDevOpsClient(
  db: PrismaClient,
  tenantId: TenantId,
  artId: string,
): Promise<AzureDevOpsClient | null> {
  const config = await db.azureDevOpsConfig.findUnique({ where: { tenantId } });
  if (!config) return null;

  const projectMap = config.projectMap as Record<string, string>;
  const project = projectMap[artId];
  if (!project) return null;

  let { accessToken } = config;

  // Refresh if token expires within 60 seconds
  if (config.tokenExpiresAt.getTime() <= Date.now() + 60_000) {
    const tokens = await refreshAccessToken(config.refreshToken);
    accessToken = tokens.access_token;
    await db.azureDevOpsConfig.update({
      where: { tenantId },
      data: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      },
    });
  }

  return new AzureDevOpsClient(config.organization, project, accessToken);
}
