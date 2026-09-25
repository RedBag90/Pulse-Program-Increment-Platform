"use server";

import { z } from "zod";
import {
  createEpic,
  updateEpic,
  softDeleteEpic,
  setPortfolioOverride,
} from "@/modules/work/server/services/epic";
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
    // Pflicht beim Anlegen — die Spalte bleibt nullable für Bestands-Epics,
    // aber wer ein neues anlegt, soll sich eine Meinung bilden.
    intendedClass: z.enum(["portfolio", "art"]),
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
      intendedClass: f.string("intendedClass"),
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
      intendedClass: input.intendedClass,
      ...(input.primarySolutionId !== undefined && { primarySolutionId: input.primarySolutionId }),
    }),
  revalidate: "epic",
  mapError: (e, t) =>
    formatDomainError(
      e,
      {
        notFoundKey: "errors.action.valueStreamNotFound2",
        fallbackKey: "errors.action.createEpic",
      },
      t,
    ),
});

export const updateEpicAction = createServerAction({
  schema: z.object({
    id: z.string().uuid(),
    title: z.string().min(1).max(200).optional(),
    description: z.string().optional(),
    // SAFe Guardrails (Roadmap-G2). Leerer String = explizit clearen,
    // fehlend = nicht anpacken — die Form sendet beide Felder immer.
    epicType: z.enum(["epic", "enabler", ""]).optional(),
    // Der Investitionshorizont am Epic. Leerer String = wieder aus der
    // Primär-Solution ableiten; fehlend = nicht anpacken. Ob der Aufrufer ihn
    // *bewegen* darf, entscheidet der Dienst — nach dem Einfrieren braucht es
    // `epic.portfolio_override` zusätzlich.
    investmentHorizon: z.enum(["h0", "h1", "h2", "h3", ""]).optional(),
    // Wertstrom-/ART-Wechsel (Beschreibungs-Formular). Fehlend = unverändert;
    // der Service validiert final, dass die ART zum Wertstrom gehört.
    valueStreamId: z.string().uuid().optional(),
    artId: z.string().uuid().optional(),
    // Die **erwartete** Einordnung. Kein Leerwert: sie ist beim Anlegen Pflicht,
    // und „wieder unbekannt" ist keine Aussage, die jemand treffen will. Die
    // *echte* Klasse entsteht davon unberührt aus den Kosten des freigegebenen
    // Business Case; überschreiben kann sie nur `setPortfolioOverrideAction`.
    intendedClass: z.enum(["portfolio", "art"]).optional(),
  }),
  action: "epic.update",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  /**
   * **Jedes Feld steht hier ausgeschrieben, keines hinter einem bedingten
   * Spread** — und das ist kein Schönheitswunsch.
   *
   * Vorher stand hier
   * `...(input.intendedClass !== undefined && { intendedClass: input.intendedClass })`,
   * während `UpdateEpicInput` das Feld gar nicht führte. TypeScript meldet
   * überzählige Eigenschaften nur an **frischen Objektliteralen**; was über
   * einen Spread hereinkommt, ist davon ausgenommen. Das Feld wurde also
   * angenommen, durchgereicht und vom Dienst fallengelassen — die Einordnung
   * liess sich nicht ändern, und nichts sagte es.
   *
   * Ausgeschrieben ist `undefined` dieselbe Aussage („unverändert", der Dienst
   * prüft auf `!== undefined`) — nur dass der Compiler jetzt jedes der sieben
   * Felder gegen `UpdateEpicInput` hält.
   */
  service: (ctx, input) =>
    updateEpic(ctx, {
      id: input.id as EpicId,
      title: input.title,
      description: input.description,
      epicType: input.epicType === "" ? null : input.epicType,
      investmentHorizon: input.investmentHorizon === "" ? null : input.investmentHorizon,
      valueStreamId: input.valueStreamId as ValueStreamId | undefined,
      artId: input.artId as ArtId | undefined,
      intendedClass: input.intendedClass,
    }),
  revalidate: "epic",
  mapError: (e, t) =>
    formatDomainError(
      e,
      { notFoundKey: "errors.action.epicNotFound2", fallbackKey: "errors.action.updateEpic" },
      t,
    ),
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
  mapError: (e, t) => formatDomainError(e, { fallbackKey: "errors.action.saveTimeWindow" }, t),
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
  mapError: (e, t) =>
    formatDomainError(
      e,
      { notFoundKey: "errors.action.epicNotFound2", fallbackKey: "errors.action.updateEpic" },
      t,
    ),
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
  mapError: (e, t) =>
    formatDomainError(
      e,
      { notFoundKey: "errors.action.epicNotFound2", fallbackKey: "errors.action.updateEpic" },
      t,
    ),
});

export const deleteEpicAction = createServerAction({
  schema: z.object({
    id: z.string().uuid(),
    /** Was mit den Features geschieht. Vorgabe = mitlöschen, das alte Verhalten. */
    children: z.enum(["delete", "release"]).optional(),
  }),
  action: "epic.delete",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => {
    const children = fields(fd).string("children");
    return { id: fields(fd).string("id"), ...(children ? { children } : {}) };
  },
  service: (ctx, input) =>
    softDeleteEpic(ctx, {
      id: input.id as EpicId,
      ...(input.children ? { children: input.children } : {}),
    }),
  revalidate: "epic",
  mapError: (e, t) =>
    formatDomainError(
      e,
      { notFoundKey: "errors.action.epicNotFound2", fallbackKey: "errors.action.deleteEpic" },
      t,
    ),
});

/**
 * Auf der beim Anlegen hinterlegten Erwartung bestehen: dieses Epic bleibt
 * Portfolio-Sache, obwohl der Business Case es unter das Limit bringt.
 *
 * Der Wertstrom trägt den Scope, damit ein Value Stream Owner nur in seinem
 * eigenen bestehen kann. Die Begründung ist Pflicht — eine Ausnahme ohne Grund
 * ist im Nachhinein nicht zu beurteilen.
 */
export const setPortfolioOverrideAction = createServerAction({
  schema: z.object({
    epicId: z.string().uuid(),
    valueStreamId: z.string().uuid(),
    reason: z.string().min(1).max(500),
  }),
  action: "epic.portfolio_override",
  resource: (input, p) => ({ tenantId: p.tenantId, valueStreamId: input.valueStreamId }),
  parseFormData: (fd) => {
    const f = fields(fd);
    return {
      epicId: f.string("epicId"),
      valueStreamId: f.string("valueStreamId"),
      reason: f.string("reason"),
    };
  },
  service: (ctx, input) =>
    setPortfolioOverride(ctx, { epicId: input.epicId as EpicId, reason: input.reason }),
  revalidate: "epic",
  mapError: (e, t) => formatDomainError(e, { fallbackKey: "errors.action.setException" }, t),
});
