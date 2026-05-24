"use server";

import { z } from "zod";
import { createTask } from "@/server/services/task";
import { createServerAction } from "@/server/http/server-action";
import { fields } from "@/server/http/form-data";
import type { StoryId } from "@/domain/types";

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
  parseFormData: (fd) => {
    const f = fields(fd);
    return {
      storyId: f.string("storyId"),
      title: f.string("title"),
      description: f.nonEmptyString("description"),
      estimateHours: f.nonEmptyString("estimateHours"),
    };
  },
  service: (ctx, input) =>
    createTask(ctx, {
      parentId: input.storyId as StoryId,
      title: input.title,
      description: input.description,
      estimateHours: input.estimateHours,
    }),
  mapError: (e) => (e.kind === "not_found" ? "Story not found" : "Failed to create task"),
});
