"use server";

import { z } from "zod";
import { createStory, deleteStory } from "@/server/services/story";
import { createServerAction } from "@/server/http/server-action";
import type { FeatureId, SprintId, StoryId } from "@/domain/types";
import { formatDomainError } from "@/server/http/domain-error-display";

export const createStoryAction = createServerAction({
  describeCreated: (v: { id: string }, input) => ({
    id: v.id,
    label: "Story",
    href: `/feature/${input.featureId}`,
  }),
  schema: z.object({
    featureId: z.string().uuid(),
    artId: z.string().uuid(),
    sprintId: z.string().uuid().optional(),
    title: z.string().min(1, "Title required").max(300),
    description: z.string().max(5000).optional(),
    acceptanceCriteria: z.string().max(5000).optional(),
    storyPoints: z.coerce.number().int().min(1).max(100).optional(),
  }),
  action: "story.create",
  resource: (input, p) => ({ tenantId: p.tenantId, artId: input.artId }),
  service: (ctx, input) => {
    const criteria = input.acceptanceCriteria
      ? input.acceptanceCriteria
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined;
    return createStory(ctx, {
      parentId: input.featureId as FeatureId,
      sprintId: input.sprintId as SprintId | undefined,
      title: input.title,
      description: input.description,
      acceptanceCriteria: criteria,
      storyPoints: input.storyPoints,
    });
  },
  revalidate: "story",
  mapError: (e) =>
    formatDomainError(e, { notFound: "Feature not found", fallback: "Failed to create story" }),
});

export const deleteStoryAction = createServerAction({
  schema: z.object({ id: z.string().uuid(), artId: z.string().uuid() }),
  action: "story.delete",
  resource: (input, p) => ({ tenantId: p.tenantId, artId: input.artId }),
  service: (ctx, input) => deleteStory(ctx, { id: input.id as StoryId }),
  revalidate: "story",
  mapError: (e) =>
    formatDomainError(e, { notFound: "Story not found", fallback: "Failed to delete story" }),
});
