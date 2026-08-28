"use server";

import { z } from "zod";
import {
  startPi,
  advanceCadence,
  deletePi,
  setPiCapacity,
} from "@/modules/drumbeat/server/services/pi";
import { createServerAction } from "@/server/http/server-action";
import { fields } from "@/server/http/form-data";
import type { PiId } from "@/modules/core/kernel/domain/types";

// PI-Erstellung ist seit dem Timeline-Rollout zentralisiert: PIs entstehen
// ausschließlich aus `applyPiStandard(timelineId, standardId, year)` —
// `addStandardPisAction` in `src/features/structure/actions/pi-standard.ts`.
// Eine `createPiAction` gibt es bewusst nicht mehr; der zugrundeliegende
// Service `createPi(...)` bleibt intern und wird vom Standard-Pfad
// verwendet.
//
// Alle vier PI-Actions gehen über `createServerAction` (einheitlicher
// `(prevState, FormData)`-Contract + Modul-Gate) und sind einheitlich
// **ART-scoped** (`resource: { tenantId, artId }`) — start/advance/update/delete.
// Der Timeline-Pfad (Cadence-Modul) nutzt bewusst `timeline.manage`.

/**
 * Startet ein geplantes PI (planned → active). Das Abschließen läuft
 * ausschließlich über `advanceCadenceAction` („PI abschließen & nächstes
 * öffnen") — der strenge Complete-PI-Weg ist aus dem UI entfallen (Spec WP2).
 */
export const transitionPiAction = createServerAction({
  schema: z.object({ piId: z.string().uuid(), artId: z.string().uuid() }),
  action: "pi.start",
  resource: (input, p) => ({ tenantId: p.tenantId, artId: input.artId }),
  parseFormData: (fd) => ({ piId: fields(fd).string("piId"), artId: fields(fd).string("artId") }),
  service: (ctx, input) => startPi(ctx, { id: input.piId as PiId }),
  revalidate: "pi",
  mapError: (e) => (e.kind === "conflict" ? e.reason : "PI konnte nicht gestartet werden"),
});

/**
 * Schreibt die Kadenz fort: schließt das aktive PI ab und öffnet das nächste
 * (leichtes Weiterrollen). Nicht-blockierende Closure-Warnungen kommen über
 * `state.warnings` zurück (Factory-`foldWarnings`).
 */
export const advanceCadenceAction = createServerAction({
  schema: z.object({ piId: z.string().uuid(), artId: z.string().uuid() }),
  action: "pi.advance",
  resource: (input, p) => ({ tenantId: p.tenantId, artId: input.artId }),
  parseFormData: (fd) => ({ piId: fields(fd).string("piId"), artId: fields(fd).string("artId") }),
  service: (ctx, input) => advanceCadence(ctx, { piId: input.piId as PiId }),
  revalidate: "pi",
  foldWarnings: (v) => v.warnings,
  mapError: (e) => (e.kind === "conflict" ? e.reason : "Fortschreiben fehlgeschlagen"),
});

/**
 * Sets the per-PI capacity overrides used by the PI-Planning overlay
 * (Job Size + €-Budget). Empty values clear the respective override; the
 * service interprets `null` as a deliberate clear.
 */
export const setPiCapacityAction = createServerAction({
  schema: z.object({
    id: z.string().uuid(),
    artId: z.string().uuid(),
    capacityJobSize: z.number().nonnegative().nullable(),
    capacityAmount: z.number().nonnegative().nullable(),
  }),
  action: "pi.update",
  resource: (input, p) => ({ tenantId: p.tenantId, artId: input.artId }),
  parseFormData: (fd) => {
    const f = fields(fd);
    const job = f.nonEmptyString("capacityJobSize");
    const amount = f.nonEmptyString("capacityAmount");
    return {
      id: f.string("id"),
      artId: f.string("artId"),
      capacityJobSize: job === undefined ? null : Number(job),
      capacityAmount: amount === undefined ? null : Number(amount),
    };
  },
  service: (ctx, input) =>
    setPiCapacity(ctx, {
      id: input.id as PiId,
      capacityJobSize: input.capacityJobSize,
      capacityAmount: input.capacityAmount,
    }),
  revalidate: "pi",
  mapError: (e) =>
    e.kind === "conflict"
      ? e.reason
      : e.kind === "not_found"
        ? "PI nicht gefunden"
        : "Kapazität konnte nicht gespeichert werden",
});

export const deletePiAction = createServerAction({
  schema: z.object({ id: z.string().uuid(), artId: z.string().uuid() }),
  action: "pi.delete",
  resource: (input, p) => ({ tenantId: p.tenantId, artId: input.artId }),
  service: (ctx, input) => deletePi(ctx, { id: input.id as PiId }),
  revalidate: "pi",
  mapError: (e) =>
    e.kind === "conflict"
      ? e.reason
      : e.kind === "not_found"
        ? "PI not found"
        : "Failed to delete PI",
});
