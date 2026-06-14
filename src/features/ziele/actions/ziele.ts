"use server";

import { z } from "zod";
import { createServerAction } from "@/server/http/server-action";
import { formatDomainError } from "@/server/http/domain-error-display";
import {
  createTheme,
  updateTheme,
  deleteTheme,
  createObjective,
  updateObjective,
  deleteObjective,
  createKeyResult,
  updateKeyResult,
  deleteKeyResult,
  bindKpiToKeyResult,
  unbindKpiFromKeyResult,
  setKpiBinding,
  linkEpicToTheme,
  unlinkEpicFromTheme,
  createVision,
  updateVision,
} from "@/server/services/ziele";
import type { InitiativeId } from "@/domain/types";

/**
 * Ziele-Modul-Actions. Permission-Gate ueberall `target.manage`
 * (TENANT_ADMIN + LPM + PORTFOLIO_MANAGER) — gleiche Audience wie
 * heutige Goal/Outcome-Actions.
 */

const optStr = z.string().optional();
const optNum = z.coerce.number().optional();

// ── Theme ─────────────────────────────────────────────────────────────

export const createThemeAction = createServerAction({
  describeCreated: (v: { id: string }) => ({ id: v.id, label: "Theme", href: "/ziele" }),
  schema: z.object({
    title: z.string().min(1).max(200),
    narrative: optStr,
    color: optStr,
    kind: z.enum(["business", "enabler"]).optional(),
    budgetPlanned: optNum,
    visionId: z.string().uuid().optional(),
    ownerId: z.string().uuid().optional(),
  }),
  action: "target.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) =>
    createTheme(ctx, {
      title: input.title,
      narrative: input.narrative ?? null,
      ...(input.color ? { color: input.color } : {}),
      ...(input.kind ? { kind: input.kind } : {}),
      budgetPlanned: input.budgetPlanned ?? null,
      visionId: input.visionId ?? null,
      ownerId: input.ownerId ?? null,
    }),
  revalidate: "ziele",
  mapError: (e) => formatDomainError(e, { fallback: "Theme konnte nicht angelegt werden" }),
});

export const updateThemeAction = createServerAction({
  schema: z.object({
    id: z.string().uuid(),
    title: z.string().min(1).max(200).optional(),
    narrative: optStr,
    color: optStr,
    kind: z.enum(["business", "enabler"]).optional(),
    budgetPlanned: optNum,
    visionId: z.string().uuid().optional().or(z.literal("")),
    ownerId: z.string().uuid().optional().or(z.literal("")),
    status: optStr,
  }),
  action: "target.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) =>
    updateTheme(ctx, {
      id: input.id,
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.narrative !== undefined ? { narrative: input.narrative } : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
      ...(input.kind !== undefined ? { kind: input.kind } : {}),
      ...(input.budgetPlanned !== undefined ? { budgetPlanned: input.budgetPlanned } : {}),
      ...(input.visionId !== undefined
        ? { visionId: input.visionId === "" ? null : input.visionId }
        : {}),
      ...(input.ownerId !== undefined
        ? { ownerId: input.ownerId === "" ? null : input.ownerId }
        : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    }),
  revalidate: "ziele",
  mapError: (e) => formatDomainError(e, { fallback: "Theme konnte nicht aktualisiert werden" }),
});

export const deleteThemeAction = createServerAction({
  schema: z.object({ id: z.string().uuid() }),
  action: "target.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) => deleteTheme(ctx, { id: input.id }),
  revalidate: "ziele",
  mapError: (e) => formatDomainError(e, { fallback: "Theme konnte nicht geloescht werden" }),
});

// ── Objective ──────────────────────────────────────────────────────────

export const createObjectiveAction = createServerAction({
  describeCreated: (v: { id: string }) => ({ id: v.id, label: "Theme", href: "/strategy" }),
  schema: z.object({
    // Optional; serverseitig wird die Default-StrategicTheme aufgeloest,
    // wenn der Wert fehlt (Hierarchie-Vereinfachung).
    themeId: z.string().uuid().optional(),
    title: z.string().min(1).max(200),
    narrative: optStr,
    period: optStr,
    confidence: z.coerce.number().int().min(1).max(5).optional(),
    ownerId: z.string().uuid().optional(),
  }),
  action: "target.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) =>
    createObjective(ctx, {
      ...(input.themeId ? { themeId: input.themeId } : {}),
      title: input.title,
      narrative: input.narrative ?? null,
      period: input.period ?? null,
      confidence: input.confidence ?? null,
      ownerId: input.ownerId ?? null,
    }),
  revalidate: "ziele",
  mapError: (e) => formatDomainError(e, { fallback: "Objective konnte nicht angelegt werden" }),
});

export const updateObjectiveAction = createServerAction({
  schema: z.object({
    id: z.string().uuid(),
    title: z.string().min(1).max(200).optional(),
    narrative: optStr,
    period: optStr,
    confidence: z.coerce.number().int().min(0).max(5).optional(),
    status: optStr,
    closingNote: optStr,
    ownerId: z.string().uuid().optional().or(z.literal("")),
  }),
  action: "target.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) =>
    updateObjective(ctx, {
      id: input.id,
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.narrative !== undefined ? { narrative: input.narrative } : {}),
      ...(input.period !== undefined ? { period: input.period === "" ? null : input.period } : {}),
      ...(input.confidence !== undefined ? { confidence: input.confidence } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.closingNote !== undefined ? { closingNote: input.closingNote } : {}),
      ...(input.ownerId !== undefined
        ? { ownerId: input.ownerId === "" ? null : input.ownerId }
        : {}),
    }),
  revalidate: "ziele",
  mapError: (e) => formatDomainError(e, { fallback: "Objective konnte nicht aktualisiert werden" }),
});

export const deleteObjectiveAction = createServerAction({
  schema: z.object({ id: z.string().uuid() }),
  action: "target.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) => deleteObjective(ctx, { id: input.id }),
  revalidate: "ziele",
  mapError: (e) => formatDomainError(e, { fallback: "Objective konnte nicht geloescht werden" }),
});

// ── KeyResult ──────────────────────────────────────────────────────────

export const createKeyResultAction = createServerAction({
  describeCreated: (v: { id: string }) => ({ id: v.id, label: "Key Result", href: "/ziele" }),
  schema: z.object({
    objectiveId: z.string().uuid(),
    title: z.string().min(1).max(200),
    metricName: optStr,
    metricUnit: optStr,
    baseline: optNum,
    target: optNum,
    current: optNum,
    formula: z.enum(["auto_from_kpi", "manual"]).optional(),
    ownerId: z.string().uuid().optional(),
  }),
  action: "target.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) =>
    createKeyResult(ctx, {
      objectiveId: input.objectiveId,
      title: input.title,
      metricName: input.metricName ?? null,
      metricUnit: input.metricUnit ?? null,
      baseline: input.baseline ?? null,
      target: input.target ?? null,
      current: input.current ?? null,
      ...(input.formula ? { formula: input.formula } : {}),
      ownerId: input.ownerId ?? null,
    }),
  revalidate: "ziele",
  mapError: (e) => formatDomainError(e, { fallback: "Key Result konnte nicht angelegt werden" }),
});

export const updateKeyResultAction = createServerAction({
  schema: z.object({
    id: z.string().uuid(),
    title: z.string().min(1).max(200).optional(),
    metricName: optStr,
    metricUnit: optStr,
    baseline: optNum,
    target: optNum,
    current: optNum,
    formula: z.enum(["auto_from_kpi", "manual"]).optional(),
    ownerId: z.string().uuid().optional().or(z.literal("")),
  }),
  action: "target.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) =>
    updateKeyResult(ctx, {
      id: input.id,
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.metricName !== undefined ? { metricName: input.metricName } : {}),
      ...(input.metricUnit !== undefined ? { metricUnit: input.metricUnit } : {}),
      ...(input.baseline !== undefined ? { baseline: input.baseline } : {}),
      ...(input.target !== undefined ? { target: input.target } : {}),
      ...(input.current !== undefined ? { current: input.current } : {}),
      ...(input.formula !== undefined ? { formula: input.formula } : {}),
      ...(input.ownerId !== undefined
        ? { ownerId: input.ownerId === "" ? null : input.ownerId }
        : {}),
    }),
  revalidate: "ziele",
  mapError: (e) =>
    formatDomainError(e, { fallback: "Key Result konnte nicht aktualisiert werden" }),
});

export const deleteKeyResultAction = createServerAction({
  schema: z.object({ id: z.string().uuid() }),
  action: "target.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) => deleteKeyResult(ctx, { id: input.id }),
  revalidate: "ziele",
  mapError: (e) => formatDomainError(e, { fallback: "Key Result konnte nicht geloescht werden" }),
});

// ── KR ↔ KPI Bindung ──────────────────────────────────────────────────

export const bindKpiAction = createServerAction({
  schema: z.object({
    keyResultId: z.string().uuid(),
    kpiId: z.string().uuid(),
    weight: z.coerce.number().min(0).max(1).optional(),
    valuePerUnitOverride: z.coerce.number().optional(),
  }),
  action: "target.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) =>
    bindKpiToKeyResult(ctx, {
      keyResultId: input.keyResultId,
      kpiId: input.kpiId,
      ...(input.weight !== undefined ? { weight: input.weight } : {}),
      ...(input.valuePerUnitOverride !== undefined
        ? { valuePerUnitOverride: input.valuePerUnitOverride }
        : {}),
    }),
  revalidate: "ziele",
  mapError: (e) => formatDomainError(e, { fallback: "KPI-Bindung fehlgeschlagen" }),
});

export const unbindKpiAction = createServerAction({
  schema: z.object({
    keyResultId: z.string().uuid(),
    kpiId: z.string().uuid(),
  }),
  action: "target.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) =>
    unbindKpiFromKeyResult(ctx, { keyResultId: input.keyResultId, kpiId: input.kpiId }),
  revalidate: "ziele",
  mapError: (e) => formatDomainError(e, { fallback: "KPI konnte nicht entkoppelt werden" }),
});

/**
 * Atomic Re-Bind fuer die KPI-Coverage-Tabelle: setzt die KR-Bindung
 * einer KPI auf `keyResultId` (oder `null` zum Entkoppeln) in einer
 * Transaktion. Damit kann eine KPI per Dropdown von einem KR auf einen
 * anderen umgehaengt werden, ohne die Pyramid-Invariante zu verletzen.
 */
export const setKpiBindingAction = createServerAction({
  schema: z.object({
    kpiId: z.string().uuid(),
    keyResultId: z.string().uuid().optional().or(z.literal("")),
    weight: z.coerce.number().min(0).max(1).optional(),
    valuePerUnitOverride: z.coerce.number().optional().or(z.literal("")),
  }),
  action: "target.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) =>
    setKpiBinding(ctx, {
      kpiId: input.kpiId,
      keyResultId: input.keyResultId && input.keyResultId !== "" ? input.keyResultId : null,
      ...(input.weight !== undefined ? { weight: input.weight } : {}),
      ...(input.valuePerUnitOverride !== undefined
        ? {
            valuePerUnitOverride:
              input.valuePerUnitOverride === "" ? null : Number(input.valuePerUnitOverride),
          }
        : {}),
    }),
  revalidate: "ziele",
  mapError: (e) => formatDomainError(e, { fallback: "KPI-Bindung fehlgeschlagen" }),
});

// ── Theme ↔ Epic Link ─────────────────────────────────────────────────

export const linkEpicAction = createServerAction({
  schema: z.object({ themeId: z.string().uuid(), epicId: z.string().uuid() }),
  action: "target.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) =>
    linkEpicToTheme(ctx, { themeId: input.themeId, epicId: input.epicId as InitiativeId }),
  revalidate: "ziele",
  mapError: (e) => formatDomainError(e, { fallback: "Epic konnte nicht verlinkt werden" }),
});

export const unlinkEpicAction = createServerAction({
  schema: z.object({ themeId: z.string().uuid(), epicId: z.string().uuid() }),
  action: "target.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) =>
    unlinkEpicFromTheme(ctx, { themeId: input.themeId, epicId: input.epicId as InitiativeId }),
  revalidate: "ziele",
  mapError: (e) => formatDomainError(e, { fallback: "Epic konnte nicht entkoppelt werden" }),
});

// ── Vision ─────────────────────────────────────────────────────────────

export const createVisionAction = createServerAction({
  describeCreated: (v: { id: string }) => ({ id: v.id, label: "Vision", href: "/ziele" }),
  schema: z.object({
    scope: z.enum(["tenant", "value_stream"]),
    valueStreamId: z.string().uuid().optional(),
    title: z.string().min(1).max(200),
    narrative: optStr,
    horizonStart: z.coerce.date(),
    horizonEnd: z.coerce.date(),
    ownerId: z.string().uuid().optional(),
  }),
  action: "target.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) =>
    createVision(ctx, {
      scope: input.scope,
      valueStreamId: input.valueStreamId ?? null,
      title: input.title,
      narrative: input.narrative ?? null,
      horizonStart: input.horizonStart,
      horizonEnd: input.horizonEnd,
      ownerId: input.ownerId ?? null,
    }),
  revalidate: "ziele",
  mapError: (e) => formatDomainError(e, { fallback: "Vision konnte nicht angelegt werden" }),
});

export const updateVisionAction = createServerAction({
  schema: z.object({
    id: z.string().uuid(),
    title: z.string().min(1).max(200).optional(),
    narrative: optStr,
    horizonStart: z.coerce.date().optional(),
    horizonEnd: z.coerce.date().optional(),
    ownerId: z.string().uuid().optional().or(z.literal("")),
    status: optStr,
  }),
  action: "target.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) =>
    updateVision(ctx, {
      id: input.id,
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.narrative !== undefined ? { narrative: input.narrative } : {}),
      ...(input.horizonStart !== undefined ? { horizonStart: input.horizonStart } : {}),
      ...(input.horizonEnd !== undefined ? { horizonEnd: input.horizonEnd } : {}),
      ...(input.ownerId !== undefined
        ? { ownerId: input.ownerId === "" ? null : input.ownerId }
        : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    }),
  revalidate: "ziele",
  mapError: (e) => formatDomainError(e, { fallback: "Vision konnte nicht aktualisiert werden" }),
});
