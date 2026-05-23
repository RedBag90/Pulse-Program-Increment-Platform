"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { saveTimeline, assignEpicOwner } from "@/server/services/epic";
import { createServerAction } from "@/server/http/server-action";
import type { EpicId } from "@/domain/types";
import type { TimelineFields } from "@/domain/timeline";
import type { ActionState } from "@/server/http/server-action";

export type { ActionState as TimelineActionState };

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional();

const timelineSchema = z.object({
  epicId: z.string().uuid(),
  estimates: z.object({
    detailing: isoDate,
    business_case: isoDate,
    backlog: isoDate,
    implementation: isoDate,
  }),
  actuals: z.object({
    backlog: isoDate,
    implementation: isoDate,
  }),
});

/** Strips `undefined`/empty values so the stored JSON only carries set dates. */
function compact(obj: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(obj).filter((e): e is [string, string] => Boolean(e[1])),
  );
}

export const saveTimelineAction = createServerAction({
  schema: timelineSchema,
  action: "epic.update",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => {
    const raw = JSON.parse((fd.get("timeline") as string | null) ?? "{}") as {
      estimates?: Record<string, string>;
      actuals?: Record<string, string>;
    };
    return {
      epicId: fd.get("epicId"),
      estimates: raw.estimates ?? {},
      actuals: raw.actuals ?? {},
    };
  },
  service: (ctx, input) => {
    const fields: TimelineFields = {
      estimates: compact(input.estimates),
      actuals: compact(input.actuals),
    };
    return saveTimeline(ctx, { epicId: input.epicId as EpicId, fields });
  },
  onSuccess: (input) => revalidatePath(`/portfolio/epics/${input.epicId}`),
  mapError: (e) =>
    e.kind === "not_found" ? "Epic nicht gefunden" : "Timeline-Speichern fehlgeschlagen",
});

export const assignEpicOwnerAction = createServerAction({
  schema: z.object({ epicId: z.string().uuid(), ownerId: z.string().uuid() }),
  action: "epic.owner.assign",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => ({ epicId: fd.get("epicId"), ownerId: fd.get("ownerId") }),
  service: (ctx, input) =>
    assignEpicOwner(ctx, { epicId: input.epicId as EpicId, ownerId: input.ownerId }),
  onSuccess: (input) => revalidatePath(`/portfolio/epics/${input.epicId}`),
  mapError: (e) =>
    e.kind === "not_found" ? "Epic nicht gefunden" : "Owner-Zuweisung fehlgeschlagen",
});
