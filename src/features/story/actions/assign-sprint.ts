"use server";

import { requirePrincipal } from "@/server/auth/principal";
import { authorize } from "@/server/auth/authorize";
import { createPrismaClient } from "@/server/db/prisma";
import { updateStory } from "@/server/services/story";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isErr } from "@/domain/errors";
import type { TenantId, StoryId, SprintId } from "@/domain/types";

export async function assignSprintAction(
  storyId: string,
  sprintId: string | null,
  artId: string,
  teamId: string,
): Promise<{ error?: string }> {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  if (
    !authorize("story.update", { tenantId: principal.tenantId, artId, teamId }, principal).allow
  ) {
    return { error: "Insufficient permissions" };
  }

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const result = await updateStory(db, {
    tenantId: principal.tenantId as TenantId,
    actorId: principal.id,
    id: storyId as StoryId,
    sprintId: sprintId === null ? null : (sprintId as SprintId),
  });

  if (isErr(result)) return { error: "Failed to assign sprint" };

  revalidatePath(`/team/${teamId}`, "page");
  return {};
}
