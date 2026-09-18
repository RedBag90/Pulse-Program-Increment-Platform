"use server";

import { z } from "zod";
import {
  createSolution,
  updateSolution,
  softDeleteSolution,
  promoteSolution,
  setSolutionLifecycle,
} from "@/modules/core/org/server/services/solution";
import { createServerAction } from "@/server/http/server-action";
import { fields } from "@/server/http/form-data";
import { formatDomainError } from "@/server/http/domain-error-display";
import type { ActionState } from "@/server/http/server-action";
import { SOLUTION_STATUSES, solutionStatusToHorizonMode } from "@/modules/core/org/domain/solution";

export type { ActionState as SolutionActionState };

/**
 * **Eine Quelle statt zweier.** Die Liste stand hier bis ADR-0020 abgeschrieben —
 * und genau deshalb hing der abgeschaffte Status `rd` an allen drei Actions
 * gleichzeitig, obwohl die Domäne ihn längst nicht mehr kannte.
 */
const status = z.enum(SOLUTION_STATUSES);
const tenantResource = (_i: unknown, p: { tenantId: string }) => ({ tenantId: p.tenantId });

export const createSolutionAction = createServerAction({
  describeCreated: (v: { id: string }) => ({
    id: v.id,
    label: "Solution",
    href: `/structure/solution/${v.id}`,
  }),
  schema: z.object({
    name: z.string().min(1).max(200),
    description: z.string().optional(),
    valueStreamId: z.string().uuid(),
    // **Pflicht seit 2026-09-19.** Ein leeres Feld kam vorher als `null` durch;
    // jetzt lehnt das Schema es ab — mit einer Meldung an der Kante, statt dass
    // die Datenbank es tut.
    artId: z.string().uuid({ message: "Bitte ein ART wählen." }),
    status,
    productManagerId: z.string().uuid().nullable().optional(),
  }),
  action: "solution.create",
  resource: tenantResource,
  parseFormData: (fd) => {
    const f = fields(fd);
    return {
      name: f.string("name"),
      description: f.nonEmptyString("description"),
      valueStreamId: f.string("valueStreamId"),
      artId: f.nonEmptyString("artId") ?? "",
      status: (f.nonEmptyString("status") ?? "investing") as z.infer<typeof status>,
      productManagerId: f.nonEmptyString("productManagerId") ?? null,
    };
  },
  service: (ctx, input) => {
    const { horizon, investmentMode } = solutionStatusToHorizonMode(input.status);
    return createSolution(ctx, {
      name: input.name,
      description: input.description,
      valueStreamId: input.valueStreamId,
      artId: input.artId,
      horizon,
      investmentMode,
      productManagerId: input.productManagerId ?? null,
    });
  },
  revalidate: "solution",
  mapError: (e) =>
    formatDomainError(e, {
      notFound: "Value Stream nicht gefunden",
      fallback: "Solution konnte nicht angelegt werden",
    }),
});

export const updateSolutionAction = createServerAction({
  schema: z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(200).optional(),
    description: z.string().optional(),
    valueStreamId: z.string().uuid().optional(),
    // **Wechselbar, nicht entfernbar** (Pflichtspalte seit 2026-09-19):
    // `undefined` heißt „nicht angefasst", `null` gibt es nicht mehr.
    artId: z.string().uuid().optional(),
    status: status.optional(),
    productManagerId: z.string().uuid().nullable().optional(),
  }),
  action: "solution.update",
  // Der benannte Produkt-Manager darf sein Produkt bearbeiten, auch ohne
  // `solution.update`. Das prüft `updateSolution` zeilenweise — die Vorprüfung
  // hier hätte ihn vorher abgewiesen und den Seam wirkungslos gemacht.
  authorizedInService: true,
  resource: tenantResource,
  parseFormData: (fd) => {
    const f = fields(fd);
    return {
      id: f.string("id"),
      name: f.nonEmptyString("name"),
      description: f.nonEmptyString("description"),
      valueStreamId: f.nonEmptyString("valueStreamId"),
      artId: f.nonEmptyString("artId"),
      status: f.nonEmptyString("status") as z.infer<typeof status> | undefined,
      productManagerId: f.nullableString("productManagerId"),
    };
  },
  service: (ctx, input) => {
    const decoded = input.status !== undefined ? solutionStatusToHorizonMode(input.status) : null;
    return updateSolution(ctx, {
      id: input.id,
      name: input.name,
      description: input.description,
      valueStreamId: input.valueStreamId,
      artId: input.artId,
      productManagerId: input.productManagerId,
      ...(decoded && { horizon: decoded.horizon, investmentMode: decoded.investmentMode }),
    });
  },
  revalidate: "solution",
  mapError: (e) =>
    e.kind === "conflict"
      ? e.reason
      : e.kind === "not_found"
        ? "Nicht gefunden"
        : "Solution konnte nicht gespeichert werden",
});

export const deleteSolutionAction = createServerAction({
  schema: z.object({ id: z.string().uuid() }),
  action: "solution.delete",
  resource: tenantResource,
  parseFormData: (fd) => ({ id: fields(fd).string("id") }),
  service: (ctx, input) => softDeleteSolution(ctx, { id: input.id }),
  revalidate: "solution",
  mapError: (e) =>
    formatDomainError(e, {
      notFound: "Solution nicht gefunden",
      fallback: "Solution konnte nicht gelöscht werden",
    }),
});

/**
 * Der Stufenwechsel der Lebenszyklus-Leiter. Sie spricht die **Fünfer-Sprache**
 * (H1.1/H1.2 sind zwei Stufen); dekodiert wird hier, genau wie beim Anlegen und
 * Bearbeiten. Gespeichert wird weiter `horizon` + `investmentMode` — die
 * vierwertige Achse, nach der Kanban und Guardrails bucketen, bleibt unberührt.
 */
export const setSolutionLifecycleAction = createServerAction({
  schema: z.object({ id: z.string().uuid(), status }),
  action: "solution.manage",
  resource: tenantResource,
  parseFormData: (fd) => {
    const f = fields(fd);
    return {
      id: f.string("id"),
      status: (f.string("status") ?? "investing") as z.infer<typeof status>,
    };
  },
  service: (ctx, input) => {
    const { horizon, investmentMode } = solutionStatusToHorizonMode(input.status);
    return setSolutionLifecycle(ctx, { id: input.id, horizon, investmentMode });
  },
  revalidate: "solution",
  mapError: (e) =>
    e.kind === "conflict"
      ? e.reason
      : e.kind === "not_found"
        ? "Nicht gefunden"
        : "Lifecycle konnte nicht geändert werden",
});

export const promoteSolutionAction = createServerAction({
  schema: z.object({
    id: z.string().uuid(),
    benefitValidated: z.boolean(),
    runStable: z.boolean(),
    valueStreamAligned: z.boolean(),
    viable: z.boolean(),
  }),
  action: "solution.manage",
  resource: tenantResource,
  parseFormData: (fd) => {
    const f = fields(fd);
    const checked = (key: string) => fd.get(key) != null;
    return {
      id: f.string("id"),
      benefitValidated: checked("benefitValidated"),
      runStable: checked("runStable"),
      valueStreamAligned: checked("valueStreamAligned"),
      viable: checked("viable"),
    };
  },
  service: (ctx, input) =>
    promoteSolution(ctx, {
      id: input.id,
      criteria: {
        benefitValidated: input.benefitValidated,
        runStable: input.runStable,
        valueStreamAligned: input.valueStreamAligned,
        viable: input.viable,
      },
    }),
  revalidate: "solution",
  mapError: (e) =>
    e.kind === "conflict"
      ? e.reason
      : e.kind === "not_found"
        ? "Nicht gefunden"
        : "Beförderung fehlgeschlagen",
});
