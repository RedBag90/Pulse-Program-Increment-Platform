import { z } from "zod";
import { updateTask, deleteTask } from "@/server/services/task";
import { createMutationHandler } from "@/server/http/mutation-handler";
import type { TenantId, TaskId } from "@/domain/types";

const patchSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  description: z.string().max(5000).optional(),
  estimateHours: z.number().min(0.5).max(999).optional(),
  status: z.string().optional(),
});

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: Ctx): Promise<Response> {
  const { id } = await params;
  return createMutationHandler({
    schema: patchSchema,
    action: "task.edit",
    resource: (_input, p) => ({ tenantId: p.tenantId }),
    service: (ctx, input) =>
      updateTask(ctx.db, {
        tenantId: ctx.principal.tenantId as TenantId,
        actorId: ctx.principal.id,
        id: id as TaskId,
        ...input,
      }),
    successStatus: 204,
    idempotent: false,
  })(request);
}

export async function DELETE(request: Request, { params }: Ctx): Promise<Response> {
  const { id } = await params;
  return createMutationHandler({
    schema: z.object({}),
    action: "task.edit",
    resource: (_input, p) => ({ tenantId: p.tenantId }),
    service: (ctx) =>
      deleteTask(ctx.db, ctx.principal.tenantId as TenantId, ctx.principal.id, id as TaskId),
    successStatus: 204,
    idempotent: false,
  })(request);
}
