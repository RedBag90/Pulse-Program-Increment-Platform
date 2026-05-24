"use server";

import { z } from "zod";
import { createStory, deleteStory } from "@/server/services/story";
import { createServerAction } from "@/server/http/server-action";
import { fields } from "@/server/http/form-data";
import type { FeatureId, SprintId, StoryId } from "@/domain/types";

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
  parseFormData: (fd) => {
    const f = fields(fd);
    return {
      featureId: f.string("featureId"),
      artId: f.string("artId"),
      sprintId: f.nonEmptyString("sprintId"),
      title: f.string("title"),
      description: f.nonEmptyString("description"),
      acceptanceCriteria: f.nonEmptyString("acceptanceCriteria"),
      storyPoints: f.nonEmptyString("storyPoints"),
    };
  },
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
  mapError: (e) => (e.kind === "not_found" ? "Feature not found" : "Failed to create story"),
});

export const deleteStoryAction = createServerAction({
  schema: z.object({ id: z.string().uuid(), artId: z.string().uuid() }),
  action: "story.delete",
  resource: (input, p) => ({ tenantId: p.tenantId, artId: input.artId }),
  parseFormData: (fd) => {
    const f = fields(fd);
    return { id: f.string("id"), artId: f.string("artId") };
  },
  service: (ctx, input) => deleteStory(ctx, { id: input.id as StoryId }),
  revalidate: "story",
  mapError: (e) => (e.kind === "not_found" ? "Story not found" : "Failed to delete story"),
});
