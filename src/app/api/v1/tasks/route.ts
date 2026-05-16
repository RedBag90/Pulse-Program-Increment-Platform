import { type NextRequest, NextResponse } from "next/server";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { createTask, listTasks } from "@/server/services/task";
import { authorize } from "@/server/auth/authorize";
import { forbidden, problemJson } from "@/server/http/problem";
import type { TenantId, StoryId } from "@/domain/types";
import { z } from "zod";
import { isErr } from "@/domain/errors";

const createSchema = z.object({
  storyId: z.string().uuid(),
  title: z.string().min(1).max(300),
  description: z.string().max(5000).optional(),
  estimateHours: z.number().min(0.5).max(999).optional(),
});

export async function GET(req: NextRequest) {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) return problemJson(401, "Unauthorized");

  const storyId = req.nextUrl.searchParams.get("storyId");
  if (!storyId) return problemJson(400, "storyId query param required");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const tasks = await listTasks(db, principal.tenantId as TenantId, storyId as StoryId);
  return NextResponse.json(tasks);
}

export async function POST(req: NextRequest) {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) return problemJson(401, "Unauthorized");

  const decision = authorize("task.create", { tenantId: principal.tenantId }, principal);
  if (!decision.allow) return forbidden(decision.reason);

  const body: unknown = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return problemJson(400, "Validation error", parsed.error.flatten());

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const result = await createTask(db, {
    tenantId: principal.tenantId as TenantId,
    actorId: principal.id,
    parentId: parsed.data.storyId as StoryId,
    title: parsed.data.title,
    description: parsed.data.description,
    estimateHours: parsed.data.estimateHours,
  });

  if (isErr(result)) {
    const e = result.error;
    if (e.kind === "not_found") return problemJson(404, `${e.resourceType} not found`);
    return problemJson(409, "Conflict");
  }

  return NextResponse.json(result.value, { status: 201 });
}
