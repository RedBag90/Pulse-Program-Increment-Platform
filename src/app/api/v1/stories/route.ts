import { type NextRequest, NextResponse } from "next/server";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { createStory, listStories } from "@/server/services/story";
import { authorize } from "@/server/auth/authorize";
import { withIdempotency } from "@/server/http/idempotency";
import { forbidden, problemJson } from "@/server/http/problem";
import type { TenantId, FeatureId, PiId, SprintId } from "@/domain/types";
import { z } from "zod";
import { isErr } from "@/domain/errors";

const createSchema = z.object({
  featureId: z.string().uuid(),
  piId: z.string().uuid().optional(),
  sprintId: z.string().uuid().optional(),
  title: z.string().min(1).max(300),
  description: z.string().max(5000).optional(),
  acceptanceCriteria: z.array(z.string()).optional(),
  storyPoints: z.number().int().min(1).max(100).optional(),
});

export async function GET(req: NextRequest) {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) return problemJson(401, "Unauthorized");

  const featureId = req.nextUrl.searchParams.get("featureId");
  if (!featureId) return problemJson(400, "featureId query param required");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const stories = await listStories(db, principal.tenantId as TenantId, featureId as FeatureId);
  return NextResponse.json(stories);
}

export async function POST(req: NextRequest) {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) return problemJson(401, "Unauthorized");

  const decision = authorize("story.create", { tenantId: principal.tenantId }, principal);
  if (!decision.allow) return forbidden(decision.reason);

  return withIdempotency(req, principal, async (req) => {
    const body: unknown = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return problemJson(400, "Validation error", parsed.error.flatten());

    const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
    const result = await createStory(db, {
      tenantId: principal.tenantId as TenantId,
      actorId: principal.id,
      parentId: parsed.data.featureId as FeatureId,
      piId: parsed.data.piId as PiId | undefined,
      sprintId: parsed.data.sprintId as SprintId | undefined,
      title: parsed.data.title,
      description: parsed.data.description,
      acceptanceCriteria: parsed.data.acceptanceCriteria,
      storyPoints: parsed.data.storyPoints,
    });

    if (isErr(result)) {
      const e = result.error;
      if (e.kind === "not_found") return problemJson(404, `${e.resourceType} not found`);
      return problemJson(409, "Conflict");
    }

    return NextResponse.json(result.value, { status: 201 });
  });
}
