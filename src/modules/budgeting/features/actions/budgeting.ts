"use server";

import { z } from "zod";
import { createServerAction } from "@/server/http/server-action";
import { fields } from "@/server/http/form-data";
import {
  saveBudgetAllocation,
  saveBudgetPool,
} from "@/modules/budgeting/server/services/budgeting";
import { saveArtBudget } from "@/modules/budgeting/server/services/art-budget";
import { captureBudgetPlanRevision } from "@/modules/budgeting/server/services/budget-plan-revision";
import {
  advanceBudgetCycle,
  setBudgetWindowSize,
} from "@/modules/budgeting/server/services/budget-cycle-service";
import type { EpicId } from "@/modules/core/kernel/domain/types";
import { formatDomainError } from "@/server/http/domain-error-display";

/**
 * Alle Schreib-Aktionen der Budgetvergabe an einer Stelle: Topf, Epic-Zuteilung,
 * ART-Verteilung, Revisions-Capture. Vorher lagen sie in drei Dateien in drei
 * `features/`-Silos und trugen dabei dreimal dieselbe `payload`-Funktion und
 * zweimal dasselbe `periodMap`-Schema.
 *
 * Schemas bleiben bewusst hier am Rand (ADR-0004) — nur die geteilten Primitive
 * sind zusammengezogen, kein zentrales Input-Schema.
 */

/** Halbjahres-Key → Betrag; die Wire-Form jeder Budget-Karte. */
const periodMap = z.record(z.string(), z.number().nonnegative());

/**
 * Liest das JSON-`payload`-Formularfeld. Budgeting nutzt diesen Envelope statt
 * `parseFromSchema`, weil seine Nutzlast verschachtelte Karten mit dynamischen
 * Keys enthält, die sich nicht auf flache FormData-Felder abbilden lassen. Die
 * Client-Hälfte des Envelopes ist typisiert in `features/lib/allocation-payload`.
 */
function payload(fd: FormData): unknown {
  const raw = fd.get("payload");
  return typeof raw === "string" ? JSON.parse(raw) : {};
}

/** Speichert die Budget-Zuteilung eines Epics (Priorität, Hypothesen-Budget, Perioden-Beträge). */
export const saveBudgetAllocationAction = createServerAction({
  schema: z.object({
    epicId: z.string().uuid(),
    priority: z.number().int(),
    hypothesisBudget: z.number().nonnegative().nullable(),
    allocations: periodMap,
  }),
  action: "budget.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: payload,
  service: (ctx, input) =>
    saveBudgetAllocation(ctx, {
      epicId: input.epicId as EpicId,
      priority: input.priority,
      hypothesisBudget: input.hypothesisBudget,
      allocations: input.allocations,
    }),
  revalidate: "budgetAllocation",
  mapError: (e) => formatDomainError(e, { fallback: "Zuteilung konnte nicht gespeichert werden" }),
});

/** Speichert den Gesamt-Budget-Topf je Halbjahr. */
export const saveBudgetPoolAction = createServerAction({
  schema: z.object({ byPeriod: periodMap }),
  action: "budget.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: payload,
  service: (ctx, input) => saveBudgetPool(ctx, { byPeriod: input.byPeriod }),
  revalidate: "budgetAllocation",
  mapError: (e) =>
    formatDomainError(e, { fallback: "Budget-Topf konnte nicht gespeichert werden" }),
});

/** Finance verteilt das Budget eines Wertstroms auf einen ART, je Halbjahr. */
export const saveArtBudgetAction = createServerAction({
  schema: z.object({ artId: z.string().uuid(), byPeriod: periodMap }),
  action: "art_budget.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: payload,
  service: (ctx, input) => saveArtBudget(ctx, { artId: input.artId, byPeriod: input.byPeriod }),
  revalidate: "valueStream",
  mapError: (e) =>
    e.kind === "forbidden" ? e.reason : "ART-Budget konnte nicht gespeichert werden",
});

/**
 * Friert den Live-Stand der teilnehmenden Budgetierung als Budget-Plan-Revision
 * des laufenden Halbjahres ein. Idempotent je `(tenant, cycleKey)` — ein zweiter
 * Klick im selben Zyklus überschreibt den vorherigen Snapshot.
 */
export const captureBudgetPlanRevisionAction = createServerAction({
  schema: z.object({ cycleKey: z.string().optional() }),
  action: "budget_plan.revision.capture",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => {
    const cycleKey = fields(fd).nonEmptyString("cycleKey");
    return cycleKey !== undefined ? { cycleKey } : {};
  },
  service: (ctx, input) =>
    captureBudgetPlanRevision(
      ctx,
      input.cycleKey !== undefined ? { cycleKey: input.cycleKey } : {},
    ),
  revalidate: "budgetPlanRevision",
  describeCreated: (v: { id: string; cycleKey: string }) => ({
    id: v.id,
    label: "Budget-Plan-Revision",
    href: `/budgeting/budget-plan/${v.id}`,
  }),
  mapError: (e) => formatDomainError(e, { fallback: "Snapshot konnte nicht erstellt werden" }),
});

/**
 * Schreibt die Budget-Zeitleiste fort: friert den ablaufenden Zyklus als Snapshot
 * ein und rollt den Anker (und damit das Fenster) ein Halbjahr weiter.
 */
export const advanceBudgetCycleAction = createServerAction({
  schema: z.object({}),
  action: "budget.cycle.advance",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: () => ({}),
  service: (ctx) => advanceBudgetCycle(ctx),
  revalidate: "budgetPlanRevision",
  mapError: (e) => formatDomainError(e, { fallback: "Zyklus konnte nicht fortgeschrieben werden" }),
});

/** Setzt die Rolling-Window-Größe (Halbjahre). */
export const setBudgetWindowSizeAction = createServerAction({
  schema: z.object({ size: z.coerce.number().int() }),
  action: "budget.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: payload,
  service: (ctx, input) => setBudgetWindowSize(ctx, { size: input.size }),
  revalidate: "budgetAllocation",
  mapError: (e) => formatDomainError(e, { fallback: "Fenstergröße konnte nicht gesetzt werden" }),
});
