"use server";

import { z } from "zod";
import { createServerAction } from "@/server/http/server-action";
import { fields } from "@/server/http/form-data";
import {
  setArtEpicAllocation,
  saveArtEpicAllocations,
} from "@/modules/budgeting/server/services/art-pot";
import { formatDomainError } from "@/server/http/domain-error-display";
import { revalidateFor } from "@/server/http/revalidation";

/**
 * Verteilt den ART-Epic-Budget eines ARTs auf eines seiner ART-Epics.
 *
 * Autorisiert wird im Service gegen den **Wertstrom** des ARTs (`rtb_item.manage`
 * samt Finance-Bypass) und gegen die **Primär-Solution des Epics** (ihr
 * Produkt-Manager darf für sein Produkt zuteilen) — verteilt wird der Rahmen
 * *für* den ART, nicht von ihm. Die Action prüft deshalb nur die grobe
 * Modulzugehörigkeit vor; `authorizedInService` sagt das jetzt auch dem
 * Factory-Code, der sonst beide Seams vorher abwies.
 */
export const setArtEpicAllocationAction = createServerAction({
  schema: z.object({
    artId: z.string().uuid(),
    epicId: z.string().uuid(),
    cycleKey: z.string().regex(/^\d{4}-H[12]$/),
    amount: z.number().min(0),
    ask: z.number().min(0),
  }),
  action: "rtb_item.manage",
  authorizedInService: true,
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => ({
    artId: String(fd.get("artId") ?? ""),
    epicId: String(fd.get("epicId") ?? ""),
    cycleKey: String(fd.get("cycleKey") ?? ""),
    amount: Number(String(fd.get("amount") ?? "0").trim() || "0"),
    ask: Number(String(fd.get("ask") ?? "0").trim() || "0"),
  }),
  service: (ctx, input) => setArtEpicAllocation(ctx, input),
  onSuccess: () => {
    // Die Zuteilung schreibt die Zyklus-Karte fort — dieselbe Ressource, die
    // auch die Finalisierung anfasst.
    revalidateFor("budgetAllocation");
    revalidateFor("art");
  },
  mapError: (e) => formatDomainError(e, { fallback: "Zuteilung konnte nicht gespeichert werden" }),
});

/**
 * Die ganze Verteilliste auf einmal — ein Knopf statt eines je Zeile.
 *
 * Derselbe Zuschnitt wie `saveRtbAwardsAction`: der Deckel gilt gegen die Summe
 * der Eingabe, also muss sie in einem Aufruf ankommen.
 */
export const saveArtEpicAllocationsAction = createServerAction({
  schema: z.object({
    artId: z.string().uuid(),
    cycleKey: z.string().regex(/^\d{4}-H[12]$/),
    amounts: z.array(
      z.object({
        epicId: z.string().uuid(),
        amount: z.number().min(0),
        ask: z.number().min(0),
      }),
    ),
  }),
  action: "art_budget.distribute",
  authorizedInService: true,
  resource: (_i, p: { tenantId: string }) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => {
    const f = fields(fd);
    return {
      artId: f.string("artId"),
      cycleKey: f.string("cycleKey"),
      amounts: JSON.parse(f.nonEmptyString("amounts") ?? "[]") as {
        epicId: string;
        amount: number;
        ask: number;
      }[],
    };
  },
  service: (ctx, i) => saveArtEpicAllocations(ctx, i),
  onSuccess: () => {
    revalidateFor("budgetAllocation");
    revalidateFor("art");
  },
  mapError: (e) =>
    e.kind === "forbidden" || e.kind === "conflict"
      ? e.reason
      : formatDomainError(e, { fallback: "Speichern fehlgeschlagen" }),
});
