"use server";

import { z } from "zod";
import {
  createSolution,
  updateSolution,
  softDeleteSolution,
  promoteSolution,
  setSolutionLifecycle,
  setSolutionInvestmentMode,
  setEpicSolutions,
} from "@/modules/work/server/services/solution";
import { createServerAction } from "@/server/http/server-action";
import { fields } from "@/server/http/form-data";
import { formatDomainError } from "@/server/http/domain-error-display";
import type { ActionState } from "@/server/http/server-action";
import { solutionStatusToHorizonMode } from "@/modules/work/domain/solution";

export type { ActionState as SolutionActionState };

const status = z.enum(["rd", "emerging", "investing", "extracting", "decommissioning"]);
// Lifecycle-Stepper wechselt Horizonte direkt (kein Status).
const horizon = z.enum(["h0", "h1", "h2", "h3"]);
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
    artId: z.string().uuid().nullable(),
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
      artId: f.nonEmptyString("artId") ?? null,
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
    artId: z.string().uuid().nullable().optional(),
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
      artId: f.nullableString("artId"),
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

export const setSolutionLifecycleAction = createServerAction({
  schema: z.object({ id: z.string().uuid(), horizon }),
  action: "solution.manage",
  resource: tenantResource,
  parseFormData: (fd) => {
    const f = fields(fd);
    return {
      id: f.string("id"),
      horizon: (f.string("horizon") ?? "h1") as z.infer<typeof horizon>,
    };
  },
  service: (ctx, input) => setSolutionLifecycle(ctx, { id: input.id, horizon: input.horizon }),
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

export const setSolutionInvestmentModeAction = createServerAction({
  schema: z.object({
    id: z.string().uuid(),
    investmentMode: z.enum(["investing", "extracting"]).nullable(),
  }),
  action: "solution.manage",
  resource: tenantResource,
  parseFormData: (fd) => {
    const f = fields(fd);
    return {
      id: f.string("id"),
      investmentMode: (f.nonEmptyString("investmentMode") ?? null) as
        | "investing"
        | "extracting"
        | null,
    };
  },
  service: (ctx, input) =>
    setSolutionInvestmentMode(ctx, { id: input.id, investmentMode: input.investmentMode }),
  revalidate: "solution",
  mapError: (e) =>
    e.kind === "conflict"
      ? e.reason
      : e.kind === "not_found"
        ? "Nicht gefunden"
        : "Investitionsmodus konnte nicht gespeichert werden",
});

/** Setzt die Solution-Zuordnungen eines Epics (n:m) + Primär-Solution. */
export const setEpicSolutionsAction = createServerAction({
  schema: z.object({
    epicId: z.string().uuid(),
    solutionIds: z.array(z.string().uuid()),
    primarySolutionId: z.string().uuid().nullable(),
  }),
  action: "epic.update",
  resource: tenantResource,
  parseFormData: (fd) => {
    const f = fields(fd);
    return {
      epicId: f.string("epicId"),
      solutionIds: fd
        .getAll("solutionIds")
        .map((v) => String(v))
        .filter((v) => v.length > 0),
      primarySolutionId: f.nonEmptyString("primarySolutionId") ?? null,
    };
  },
  service: (ctx, input) =>
    setEpicSolutions(ctx, {
      epicId: input.epicId,
      solutionIds: input.solutionIds,
      primarySolutionId: input.primarySolutionId,
    }),
  revalidate: "solution",
  mapError: (e) =>
    e.kind === "conflict"
      ? e.reason
      : e.kind === "not_found"
        ? "Nicht gefunden"
        : "Zuordnung fehlgeschlagen",
});
