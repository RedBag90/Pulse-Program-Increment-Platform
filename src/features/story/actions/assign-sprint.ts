"use server";

import { z } from "zod";
import { createServerAction } from "@/server/http/server-action";
import { formatDomainError } from "@/server/http/domain-error-display";
import { updateStory } from "@/server/services/story";
import type { StoryId, SprintId } from "@/domain/types";

/**
 * Assigns a Story to a Sprint (or back to the backlog when `sprintId` is
 * empty). Used both from the Backlog dropdown and from drag-and-drop on the
 * Program Board — drag callers build a `FormData` from the event handler and
 * invoke the action imperatively via `useActionState`'s `action(fd)`.
 */
export const assignSprintAction = createServerAction({
  schema: z.object({
    storyId: z.string().uuid(),
    sprintId: z.string().uuid().nullable(),
    artId: z.string().uuid(),
    teamId: z.string().uuid(),
  }),
  action: "story.update",
  resource: (input, p) => ({ tenantId: p.tenantId, artId: input.artId, teamId: input.teamId }),
  service: (ctx, input) =>
    updateStory(ctx, {
      id: input.storyId as StoryId,
      sprintId: (input.sprintId ?? null) as SprintId | null,
    }),
  revalidate: "story",
  mapError: (e) => formatDomainError(e, { fallback: "Story konnte nicht zugewiesen werden" }),
});
