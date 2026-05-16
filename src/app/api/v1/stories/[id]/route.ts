import { type NextRequest, NextResponse } from "next/server";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { getStory, updateStory, deleteStory } from "@/server/services/story";
import { authorize } from "@/server/auth/authorize";
import { forbidden, problemJson } from "@/server/http/problem";
import type { TenantId, StoryId, SprintId } from "@/domain/types";
import { z } from "zod";
import { isErr } from "@/domain/errors";

const patchSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  description: z.string().max(5000).optional(),
  acceptanceCriteria: z.array(z.string()).optional(),
  storyPoints: z.number().int().min(1).max(100).optional(),
  sprintId: z.string().uuid().nullable().optional(),
  status: z.string().optional(),
});

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) return problemJson(401, "Unauthorized");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const story = await getStory(db, principal.tenantId as TenantId, id as StoryId);
  if (!story) return problemJson(404, "Story not found");
  return NextResponse.json(story);
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) return problemJson(401, "Unauthorized");

  const decision = authorize("story.update", { tenantId: principal.tenantId }, principal);
  if (!decision.allow) return forbidden(decision.reason);

  const body: unknown = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return problemJson(400, "Validation error", parsed.error.flatten());

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const result = await updateStory(db, {
    tenantId: principal.tenantId as TenantId,
    actorId: principal.id,
    id: id as StoryId,
    ...parsed.data,
    sprintId: parsed.data.sprintId === null ? null : (parsed.data.sprintId as SprintId | undefined),
  });

  if (isErr(result)) {
    const e = result.error;
    if (e.kind === "not_found") return problemJson(404, "Story not found");
    return problemJson(409, "Conflict");
  }

  return new NextResponse(null, { status: 204 });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) return problemJson(401, "Unauthorized");

  const decision = authorize("story.update", { tenantId: principal.tenantId }, principal);
  if (!decision.allow) return forbidden(decision.reason);

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const result = await deleteStory(db, principal.tenantId as TenantId, principal.id, id as StoryId);

  if (isErr(result)) return problemJson(404, "Story not found");
  return new NextResponse(null, { status: 204 });
}
