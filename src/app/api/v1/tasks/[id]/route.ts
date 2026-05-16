import { type NextRequest, NextResponse } from "next/server";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { updateTask, deleteTask } from "@/server/services/task";
import { problemJson } from "@/server/http/problem";
import type { TenantId, TaskId } from "@/domain/types";
import { z } from "zod";
import { isErr } from "@/domain/errors";

const patchSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  description: z.string().max(5000).optional(),
  estimateHours: z.number().min(0.5).max(999).optional(),
  status: z.string().optional(),
});

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) return problemJson(401, "Unauthorized");

  const body: unknown = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return problemJson(400, "Validation error", parsed.error.flatten());

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const result = await updateTask(db, {
    tenantId: principal.tenantId as TenantId,
    actorId: principal.id,
    id: id as TaskId,
    ...parsed.data,
  });

  if (isErr(result)) {
    const e = result.error;
    if (e.kind === "not_found") return problemJson(404, "Task not found");
    return problemJson(409, "Conflict");
  }

  return new NextResponse(null, { status: 204 });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) return problemJson(401, "Unauthorized");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const result = await deleteTask(db, principal.tenantId as TenantId, principal.id, id as TaskId);

  if (isErr(result)) return problemJson(404, "Task not found");
  return new NextResponse(null, { status: 204 });
}
