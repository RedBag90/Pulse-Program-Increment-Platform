"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createServerAction } from "@/server/http/server-action";
import { fields } from "@/server/http/form-data";
import {
  saveGoal,
  deleteGoal,
  linkGoalEpic,
  unlinkGoalEpic,
  GOAL_STATUSES,
} from "@/server/services/target-goal";
import type { ActionState } from "@/server/http/server-action";

export type { ActionState as TargetGoalActionState };

function revalidate() {
  revalidatePath("/transformation", "page");
  revalidatePath("/transformation/ziele", "page");
  revalidatePath("/portfolio/epics/[id]", "page"); // Epic detail shows its linked goals
}

const saveSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(300),
  description: z.string().max(5000).nullable().optional(),
  ownerId: z.string().uuid().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  status: z.enum(GOAL_STATUSES).optional(),
});

/** Create or update a strategic goal. Posted as one JSON `payload`. */
export const saveGoalAction = createServerAction({
  schema: saveSchema,
  action: "target.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => JSON.parse(fields(fd).string("payload") ?? "{}"),
  service: (ctx, input) =>
    saveGoal(ctx, {
      id: input.id ?? null,
      title: input.title,
      description: input.description ?? null,
      ownerId: input.ownerId ?? null,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      ...(input.status !== undefined && { status: input.status }),
    }),
  onSuccess: revalidate,
  mapError: (e) =>
    e.kind === "not_found" ? "Ziel nicht gefunden" : "Ziel konnte nicht gespeichert werden",
});

export const deleteGoalAction = createServerAction({
  schema: z.object({ id: z.string().uuid() }),
  action: "target.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => ({ id: fields(fd).string("id") }),
  service: (ctx, input) => deleteGoal(ctx, { id: input.id }),
  onSuccess: revalidate,
  mapError: (e) =>
    e.kind === "not_found" ? "Ziel nicht gefunden" : "Ziel konnte nicht gelöscht werden",
});

export const linkGoalEpicAction = createServerAction({
  schema: z.object({ goalId: z.string().uuid(), epicId: z.string().uuid() }),
  action: "target.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => {
    const f = fields(fd);
    return { goalId: f.string("goalId"), epicId: f.string("epicId") };
  },
  service: (ctx, input) => linkGoalEpic(ctx, { goalId: input.goalId, epicId: input.epicId }),
  onSuccess: revalidate,
  mapError: (e) =>
    e.kind === "conflict"
      ? e.reason
      : e.kind === "not_found"
        ? "Ziel oder Epic nicht gefunden"
        : "Verknüpfen fehlgeschlagen",
});

export const unlinkGoalEpicAction = createServerAction({
  schema: z.object({ goalId: z.string().uuid(), epicId: z.string().uuid() }),
  action: "target.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => {
    const f = fields(fd);
    return { goalId: f.string("goalId"), epicId: f.string("epicId") };
  },
  service: (ctx, input) => unlinkGoalEpic(ctx, { goalId: input.goalId, epicId: input.epicId }),
  onSuccess: revalidate,
  mapError: (e) => (e.kind === "not_found" ? "Verknüpfung nicht gefunden" : "Lösen fehlgeschlagen"),
});
