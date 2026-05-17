"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createStory, deleteStory } from "@/server/services/story";
import { createServerAction } from "@/server/http/server-action";
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
  parseFormData: (fd) => ({
    featureId: fd.get("featureId"),
    artId: fd.get("artId"),
    sprintId: fd.get("sprintId") || undefined,
    title: fd.get("title"),
    description: fd.get("description") || undefined,
    acceptanceCriteria: fd.get("acceptanceCriteria") || undefined,
    storyPoints: fd.get("storyPoints") || undefined,
  }),
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
  onSuccess: () => revalidatePath("/feature/[featureId]", "page"),
  mapError: (e) => (e.kind === "not_found" ? "Feature not found" : "Failed to create story"),
});

export const deleteStoryAction = createServerAction({
  schema: z.object({ id: z.string().uuid(), artId: z.string().uuid() }),
  action: "story.delete",
  resource: (input, p) => ({ tenantId: p.tenantId, artId: input.artId }),
  parseFormData: (fd) => ({ id: fd.get("id"), artId: fd.get("artId") }),
  service: (ctx, input) => deleteStory(ctx, { id: input.id as StoryId }),
  onSuccess: () => revalidatePath("/feature/[featureId]", "page"),
  mapError: (e) => (e.kind === "not_found" ? "Story not found" : "Failed to delete story"),
});
