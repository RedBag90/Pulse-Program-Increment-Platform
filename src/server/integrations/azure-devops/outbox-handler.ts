import type { PrismaClient } from "@/generated/prisma";
import type { TenantId } from "@/domain/types";
import type { OutboxHandlerMap } from "@/server/outbox/processor";
type OutboxHandler = OutboxHandlerMap[string];
import { getAzureDevOpsClient } from "./get-client";

export function makeAdoStoryCreatedHandler(db: PrismaClient): OutboxHandler {
  return async (payload: unknown) => {
    const { storyId, tenantId, artId, title, description, storyPoints } = payload as {
      storyId: string;
      tenantId: string;
      artId: string;
      title: string;
      description?: string;
      storyPoints?: number;
    };

    const client = await getAzureDevOpsClient(db, tenantId as TenantId, artId);
    if (!client) return; // ADO not configured or no project mapping for this ART

    const workItem = await client.createWorkItem("User Story", {
      title,
      ...(description !== undefined && { description }),
      ...(storyPoints !== undefined && { storyPoints }),
    });

    await db.initiative.update({
      where: { id: storyId },
      data: {
        externalId: String(workItem.id),
        externalSystem: "azure_devops",
      },
    });
  };
}
