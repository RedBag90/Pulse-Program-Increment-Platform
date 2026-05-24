"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createServerAction } from "@/server/http/server-action";
import { fields } from "@/server/http/form-data";
import { startArt } from "@/server/services/art-setup";
import type { ValueStreamId } from "@/domain/types";

const schema = z
  .object({
    valueStreamId: z.string().uuid(),
    name: z.string().min(1).max(100),
    piCadenceWeeks: z.coerce.number().int().min(8).max(12).optional(),
    rteId: z.string().uuid().nullable().optional(),
    piName: z.string().min(1).max(100),
    piStartDate: z.string().date(),
    piEndDate: z.string().date(),
  })
  .refine((d) => d.piStartDate < d.piEndDate, {
    message: "Startdatum muss vor dem Enddatum liegen",
    path: ["piEndDate"],
  });

/** Guided ART launch — creates the ART, sets cadence/RTE, and plans the first PI. */
export const startArtAction = createServerAction({
  describeCreated: (v: { artId: string }) => ({
    id: v.artId,
    label: "ART",
    href: `/art/${v.artId}`,
  }),
  schema,
  action: "art.create",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => JSON.parse(fields(fd).string("payload") ?? "{}"),
  service: (ctx, input) =>
    startArt(ctx, {
      valueStreamId: input.valueStreamId as ValueStreamId,
      name: input.name,
      piCadenceWeeks: input.piCadenceWeeks,
      rteId: input.rteId ?? null,
      piName: input.piName,
      piStartDate: new Date(input.piStartDate),
      piEndDate: new Date(input.piEndDate),
    }),
  onSuccess: () => {
    revalidatePath("/structure", "page");
    revalidatePath("/transformation", "page");
  },
  mapError: (e) =>
    e.kind === "conflict"
      ? e.reason
      : e.kind === "not_found"
        ? "Wertstrom oder ART nicht gefunden"
        : "ART konnte nicht gestartet werden",
});
