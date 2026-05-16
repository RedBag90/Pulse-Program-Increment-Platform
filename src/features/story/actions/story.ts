"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requirePrincipal } from "@/server/auth/principal";
import { authorize } from "@/server/auth/authorize";
import { createPrismaClient } from "@/server/db/prisma";
import { createStory } from "@/server/services/story";
import { isErr } from "@/domain/errors";
import { redirect } from "next/navigation";
import type { TenantId, FeatureId, SprintId } from "@/domain/types";

const schema = z.object({
  featureId: z.string().uuid(),
  artId: z.string().uuid(),
  sprintId: z.string().uuid().optional(),
  title: z.string().min(1, "Title required").max(300),
  description: z.string().max(5000).optional(),
  acceptanceCriteria: z.string().max(5000).optional(),
  storyPoints: z.coerce.number().int().min(1).max(100).optional(),
});

export type CreateStoryState = {
  errors?: Record<string, string[]>;
  message?: string;
};

export async function createStoryAction(
  _prev: CreateStoryState,
  formData: FormData,
): Promise<CreateStoryState> {
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
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  if (
    !authorize(
      "story.create",
      { tenantId: principal.tenantId, artId: parsed.data.artId },
      principal,
    ).allow
  ) {
    return { message: "Insufficient permissions" };
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
      message: result.error.kind === "not_found" ? "Feature not found" : "Failed to create story",
    };
  }

  revalidatePath("/art/[artId]/features/[featureId]", "page");
  return {};
}
