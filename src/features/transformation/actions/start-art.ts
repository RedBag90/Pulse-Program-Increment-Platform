"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createServerAction } from "@/server/http/server-action";
import { fields } from "@/server/http/form-data";
import { startArt } from "@/modules/core/org/server/services/art-setup";
import type { ValueStreamId } from "@/modules/core/kernel/domain/types";

const schema = z.object({
  valueStreamId: z.string().uuid(),
  name: z.string().min(1).max(100),
  rteId: z.string().uuid().nullable().optional(),
});

/**
 * Guided ART launch — legt den ART unter einem Wertstrom an und bindet ihn
 * an eine bestehende Timeline. PIs entstehen anschließend zentral aus dem
 * PI-Standard, der auf die Timeline angewendet wird (siehe
 * `addStandardPisAction` / `<AddStandardPisControl>` in
 * `/structure?tab=timeline`). Ein erstes PI wird hier bewusst nicht mehr
 * angelegt.
 */
export const startArtAction = createServerAction({
  describeCreated: (v: { artId: string }) => ({
    id: v.artId,
    label: "ART",
    href: `/structure/art/${v.artId}`,
  }),
  schema,
  action: "art.create",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => JSON.parse(fields(fd).string("payload") ?? "{}"),
  service: (ctx, input) =>
    startArt(ctx, {
      valueStreamId: input.valueStreamId as ValueStreamId,
      name: input.name,
      rteId: input.rteId ?? null,
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
