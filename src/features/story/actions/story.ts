"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requirePrincipal } from "@/server/auth/principal";
import { authorize } from "@/server/auth/authorize";
import { createPrismaClient } from "@/server/db/prisma";
import { createStory, deleteStory } from "@/server/services/story";
import { isErr } from "@/domain/errors";
import { redirect } from "next/navigation";
import type { TenantId, FeatureId, SprintId, StoryId } from "@/domain/types";
import type { ActionState } from "@/server/http/server-action";
import { createServerAction } from "@/server/http/server-action";

const schema = z.object({
  featureId: z.string().uuid(),
  artId: z.string().uuid(),
  sprintId: z.string().uuid().optional(),
  title: z.string().min(1, "Title required").max(300),
  description: z.string().max(5000).optional(),
  acceptanceCriteria: z.string().max(5000).optional(),
  storyPoints: z.coerce.number().int().min(1).max(100).optional(),
});

export async function createStoryAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const raw = {
    featureId: formData.get("featureId"),
    artId: formData.get("artId"),
    sprintId: formData.get("sprintId") || undefined,
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    acceptanceCriteria: formData.get("acceptanceCriteria") || undefined,
    storyPoints: formData.get("storyPoints") || undefined,
  };

  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  if (
    !authorize(
      "story.create",
      { tenantId: principal.tenantId, artId: parsed.data.artId },
      principal,
    ).allow
  ) {
    return { error: "Insufficient permissions" };
  }

  const criteria = parsed.data.acceptanceCriteria
    ? parsed.data.acceptanceCriteria
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
    : undefined;

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const result = await createStory(db, {
    tenantId: principal.tenantId as TenantId,
    actorId: principal.id,
    parentId: parsed.data.featureId as FeatureId,
    sprintId: parsed.data.sprintId as SprintId | undefined,
    title: parsed.data.title,
    description: parsed.data.description,
    acceptanceCriteria: criteria,
    storyPoints: parsed.data.storyPoints,
  });

  if (isErr(result)) {
    return {
      error: result.error.kind === "not_found" ? "Feature not found" : "Failed to create story",
    };
  }

  revalidatePath("/feature/[featureId]", "page");
  return { success: true };
}

export const deleteStoryAction = createServerAction({
  schema: z.object({ id: z.string().uuid(), artId: z.string().uuid() }),
  action: "story.delete",
  resource: (input, p) => ({ tenantId: p.tenantId, artId: input.artId }),
  parseFormData: (fd) => ({ id: fd.get("id"), artId: fd.get("artId") }),
  service: (ctx, input) =>
    deleteStory(ctx.db, ctx.principal.tenantId as TenantId, ctx.principal.id, input.id as StoryId),
  onSuccess: () => revalidatePath("/feature/[featureId]", "page"),
  mapError: (e) => (e.kind === "not_found" ? "Story not found" : "Failed to delete story"),
});
