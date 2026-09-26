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
import { formatDomainError } from "@/server/http/domain-error-display";

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
  mapError: (e, t) => formatDomainError(e, { fallbackKey: "errors.action.startPi" }, t),
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
  mapError: (e, t) => formatDomainError(e, { fallbackKey: "errors.action.advanceCadence" }, t),
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
    capacityJobSize: z.number().nonnegative().nullable().optional(),
    capacityAmount: z.number().nonnegative().nullable().optional(),
  }),
  action: "pi.update",
  resource: (input, p) => ({ tenantId: p.tenantId, artId: input.artId }),
  /**
   * **Drei Zustände je Feld, nicht zwei.** Nicht gesendet = unverändert
   * (`undefined`), gesendet und leer = bewusst gelöscht (`null`), gesendet
   * mit Zahl = gesetzt. Der Dienst kennt alle drei; die Aktion warf bis
   * September 2026 die ersten beiden zusammen — ein Formular, das nur die Job
   * Size schickte, hätte damit das €-Budget stillschweigend gelöscht.
   */
  parseFormData: (fd) => {
    const f = fields(fd);
    const drei = (name: string): number | null | undefined => {
      if (!fd.has(name)) return undefined;
      const v = f.nonEmptyString(name);
      return v === undefined ? null : Number(v);
    };
    return {
      id: f.string("id"),
      artId: f.string("artId"),
      capacityJobSize: drei("capacityJobSize"),
      capacityAmount: drei("capacityAmount"),
    };
  },
  service: (ctx, input) =>
    setPiCapacity(ctx, {
      id: input.id as PiId,
      capacityJobSize: input.capacityJobSize,
      capacityAmount: input.capacityAmount,
    }),
  revalidate: "pi",
  mapError: (e, t) => formatDomainError(e, { fallbackKey: "errors.action.saveCapacity" }, t),
});

export const deletePiAction = createServerAction({
  schema: z.object({ id: z.string().uuid(), artId: z.string().uuid() }),
  action: "pi.delete",
  resource: (input, p) => ({ tenantId: p.tenantId, artId: input.artId }),
  service: (ctx, input) => deletePi(ctx, { id: input.id as PiId }),
  revalidate: "pi",
  mapError: (e, t) => formatDomainError(e, { fallbackKey: "errors.action.deletePi" }, t),
});
