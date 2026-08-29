"use server";

import { z } from "zod";
import { createEpic, updateEpic, softDeleteEpic } from "@/modules/work/server/services/epic";
import { createServerAction } from "@/server/http/server-action";
import { fields } from "@/server/http/form-data";
import type { ValueStreamId, EpicId, ArtId } from "@/modules/core/kernel/domain/types";
import type { ActionState } from "@/server/http/server-action";
import { formatDomainError } from "@/server/http/domain-error-display";

export type { ActionState as EpicActionState };

export const createEpicAction = createServerAction({
  describeCreated: (v: { id: string }) => ({
    id: v.id,
    label: "Epic",
    href: `/portfolio/epics/${v.id}`,
  }),
  schema: z.object({
    title: z.string().min(1).max(200),
    description: z.string().optional(),
    valueStreamId: z.string().uuid(),
    artId: z.string().uuid(),
    primarySolutionId: z.string().uuid().nullable().optional(),
  }),
  action: "epic.create",
  // valueStreamId carries the scope so a value_stream_owner can only create
  // Epics within their own value stream.
  resource: (input, p) => ({ tenantId: p.tenantId, valueStreamId: input.valueStreamId }),
  parseFormData: (fd) => {
    const f = fields(fd);
    const sol = f.nonEmptyString("primarySolutionId");
    return {
      title: f.string("title"),
      description: f.nonEmptyString("description"),
      valueStreamId: f.string("valueStreamId"),
      artId: f.string("artId"),
      // Leeres Solution-Feld → weglassen (optional).
      ...(sol !== undefined && { primarySolutionId: sol }),
    };
  },
  service: (ctx, input) =>
    createEpic(ctx, {
      title: input.title,
      description: input.description,
      valueStreamId: input.valueStreamId as ValueStreamId,
      artId: input.artId as ArtId,
      ...(input.primarySolutionId !== undefined && { primarySolutionId: input.primarySolutionId }),
    }),
  revalidate: "epic",
  mapError: (e) =>
    formatDomainError(e, { notFound: "Value stream not found", fallback: "Failed to create epic" }),
});

export const updateEpicAction = createServerAction({
  schema: z.object({
    id: z.string().uuid(),
    title: z.string().min(1).max(200).optional(),
    description: z.string().optional(),
    // SAFe Guardrails (Roadmap-G2). Leerer String = explizit clearen,
    // fehlend = nicht anpacken — die Form sendet beide Felder immer.
    epicType: z.enum(["epic", "enabler", ""]).optional(),
    // Wertstrom-/ART-Wechsel (Beschreibungs-Formular). Fehlend = unverändert;
    // der Service validiert final, dass die ART zum Wertstrom gehört.
    valueStreamId: z.string().uuid().optional(),
    artId: z.string().uuid().optional(),
  }),
  action: "epic.update",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) =>
    updateEpic(ctx, {
      id: input.id as EpicId,
      title: input.title,
      description: input.description,
      ...(input.epicType !== undefined && {
        epicType: input.epicType === "" ? null : input.epicType,
      }),
      ...(input.valueStreamId !== undefined && {
        valueStreamId: input.valueStreamId as ValueStreamId,
      }),
      ...(input.artId !== undefined && { artId: input.artId as ArtId }),
    }),
  revalidate: "epic",
  mapError: (e) =>
    formatDomainError(e, { notFound: "Epic not found", fallback: "Failed to update epic" }),
});

/**
 * Sets (or clears) the Epic's planned delivery window — the owner's "Soll".
 * Both endpoints are optional and round-trip as ISO `yyyy-mm-dd` strings. An
 * empty value clears that endpoint (sets it to null in the DB). The service
 * validates `start ≤ end` when both are present.
 */
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Datum muss im Format yyyy-mm-dd vorliegen" });

export const setEpicPlannedWindowAction = createServerAction({
  schema: z.object({
    id: z.string().uuid(),
    plannedStartAt: isoDate.nullable(),
    plannedEndAt: isoDate.nullable(),
  }),
  action: "epic.update",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => {
    const f = fields(fd);
    const start = f.nonEmptyString("plannedStartAt");
    const end = f.nonEmptyString("plannedEndAt");
    return {
      id: f.string("id"),
      // Empty form value → explicit clear (null); missing → undefined (untouched).
      // The form always submits both fields, so we treat empty as "clear".
      plannedStartAt: start ?? null,
      plannedEndAt: end ?? null,
    };
  },
  service: (ctx, input) =>
    updateEpic(ctx, {
      id: input.id as EpicId,
      plannedStartAt: input.plannedStartAt
        ? new Date(`${input.plannedStartAt}T00:00:00.000Z`)
        : null,
      plannedEndAt: input.plannedEndAt ? new Date(`${input.plannedEndAt}T00:00:00.000Z`) : null,
    }),
  revalidate: "epic",
  mapError: (e) =>
    e.kind === "conflict"
      ? e.reason
      : e.kind === "not_found"
        ? "Epic nicht gefunden"
        : "Zeitfenster konnte nicht gespeichert werden",
});

/** Toggles a governance flag (steering / budgeting) on an Epic from the overview. */
export const setEpicFlagAction = createServerAction({
  schema: z.object({
    id: z.string().uuid(),
    flag: z.enum(["steering", "budgeting"]),
    // String enum — z.coerce.boolean("false") would be truthy.
    value: z.enum(["true", "false"]),
  }),
  action: "epic.update",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) =>
    updateEpic(ctx, {
      id: input.id as EpicId,
      ...(input.flag === "steering"
        ? { needsSteeringAttention: input.value === "true" }
        : { stagedForBudgeting: input.value === "true" }),
    }),
  revalidate: "epic",
  mapError: (e) =>
    formatDomainError(e, { notFound: "Epic not found", fallback: "Failed to update epic" }),
});

/**
 * „I need help" — der Epic-Owner setzt/entfernt die Bitte um Unterstützung.
 * Sichtbar ist der Auslöser nur für den Owner (UI-Gate); die Autorisierung läuft
 * über `epic.update` gegen die geladene Zeile.
 */
export const setEpicHelpRequestedAction = createServerAction({
  schema: z.object({
    id: z.string().uuid(),
    // String-Enum — z.coerce.boolean("false") wäre truthy.
    value: z.enum(["true", "false"]),
  }),
  action: "epic.update",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) =>
    updateEpic(ctx, { id: input.id as EpicId, helpRequested: input.value === "true" }),
  revalidate: "epic",
  mapError: (e) =>
    formatDomainError(e, { notFound: "Epic not found", fallback: "Failed to update epic" }),
});

export const deleteEpicAction = createServerAction({
  schema: z.object({ id: z.string().uuid() }),
  action: "epic.delete",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => ({ id: fields(fd).string("id") }),
  service: (ctx, input) => softDeleteEpic(ctx, { id: input.id as EpicId }),
  revalidate: "epic",
  mapError: (e) =>
    formatDomainError(e, { notFound: "Epic not found", fallback: "Failed to delete epic" }),
});
