import type { PrismaClient } from "@/generated/prisma";
import type { TenantId } from "@/domain/types";
import { getJiraClient } from "./get-client";

interface StoryCreatedPayload {
  storyId: string;
  tenantId: string;
  artId: string | null;
  title: string;
  description: string | null;
  storyPoints: number | null;
}

/**
 * Handles the `jira.story.created` outbox event.
 * Looks up the Jira config for the tenant, resolves the project key for the
 * story's ART, creates the Jira issue, and writes back the issue key to the
 * Initiative row so we can link back to it in the UI.
 */
export function makeJiraStoryCreatedHandler(db: PrismaClient) {
  return async (payload: unknown): Promise<void> => {
    const { storyId, tenantId, artId, title, description, storyPoints } =
      payload as StoryCreatedPayload;

    const client = await getJiraClient(db, tenantId as TenantId);
    if (!client) return; // no Jira config for this tenant — skip silently

    const config = await db.jiraConfig.findUnique({ where: { tenantId } });
    if (!config) return;

    // Resolve project key: ART-specific mapping, else undefined → skip
    const projectKeyMap =
      typeof config.projectKeyMap === "object" && config.projectKeyMap !== null
        ? (config.projectKeyMap as Record<string, string>)
        : {};

    const projectKey = artId ? (projectKeyMap[artId] ?? undefined) : undefined;
    if (!projectKey) return; // No mapping configured for this ART

    const created = await client.createIssue({
      project: { key: projectKey },
      issuetype: { name: "Story" },
      summary: title,
      ...(description !== null && { description }),
      ...(storyPoints !== null && { story_points: storyPoints }),
    });

    // Write the Jira issue key back to the story row
    await db.initiative.updateMany({
      where: { id: storyId, tenantId },
      data: { externalId: created.key, externalSystem: "jira" },
    });
  };
}
