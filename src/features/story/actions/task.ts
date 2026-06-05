"use server";

import { z } from "zod";
import { createTask } from "@/server/services/task";
import { createServerAction } from "@/server/http/server-action";
import type { StoryId } from "@/domain/types";
import { formatDomainError } from "@/server/http/domain-error-display";

export const createTaskAction = createServerAction({
  describeCreated: (v: { id: string }) => ({ id: v.id, label: "Task" }),
  schema: z.object({
    storyId: z.string().uuid(),
    title: z.string().min(1).max(300),
    description: z.string().max(5000).optional(),
    estimateHours: z.coerce.number().min(0.5).max(999).optional(),
  }),
  action: "task.create",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) =>
    createTask(ctx, {
      parentId: input.storyId as StoryId,
      title: input.title,
      description: input.description,
      estimateHours: input.estimateHours,
    }),
  mapError: (e) =>
    formatDomainError(e, { notFound: "Story not found", fallback: "Failed to create task" }),
});
