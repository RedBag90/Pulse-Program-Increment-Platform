"use server";

import { z } from "zod";
import { createServerAction } from "@/server/http/server-action";
import { formatDomainError } from "@/server/http/domain-error-display";
import {
  createObjective,
  updateObjective,
  deleteObjective,
  createKeyResult,
  updateKeyResult,
  deleteKeyResult,
  recordGoalCheckin,
  recordGoalProgress,
  addGoalComment,
} from "@/server/services/ziele";
import { setKpiBinding } from "@/server/services/kpi-binding";
import { linkEpicToGoal, unlinkEpicFromGoal } from "@/server/services/goal-epic-link";

/**
 * Ziele-Modul-Actions. Permission-Gate ueberall `target.manage`
 * (TENANT_ADMIN + LPM + PORTFOLIO_MANAGER) — gleiche Audience wie
 * heutige Goal/Outcome-Actions.
 */

const optStr = z.string().optional();
const optNum = z.coerce.number().optional();

/** Canonical goal-status values — mirrors src/domain/goal-status.ts. */
const goalStatusEnum = z.enum([
  "on_track",
  "at_risk",
  "off_track",
  "achieved",
  "partial",
  "missed",
  "dropped",
]);
const goalTargetEnum = z.enum(["objective", "kr"]);
const metricTypeEnum = z.enum(["number", "percent", "currency"]);
const optPrecision = z.coerce.number().int().min(0).max(6).optional();

/** Status-Update-Sektionen kommen als JSON-String aus dem FormData. */
const goalSectionsField = z.preprocess(
  (v) => {
    if (typeof v !== "string" || v.trim() === "") return undefined;
    try {
      return JSON.parse(v);
    } catch {
      return undefined;
    }
  },
  z
    .array(z.object({ title: z.string().max(200), body: z.string().max(5000) }))
    .max(20)
    .optional(),
);
/** ISO date string ("" clears it) → Date | null. */
function toDueDate(v: string | undefined): Date | null | undefined {
  if (v === undefined) return undefined;
  if (v === "") return null;
  return new Date(v);
}

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
    status: goalStatusEnum.optional().or(z.literal("")),
    dueDate: optStr,
    closingNote: optStr,
    ownerId: z.string().uuid().optional().or(z.literal("")),
  }),
  action: "target.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) => {
    const dueDate = toDueDate(input.dueDate);
    return updateObjective(ctx, {
      id: input.id,
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.narrative !== undefined ? { narrative: input.narrative } : {}),
      ...(input.period !== undefined ? { period: input.period === "" ? null : input.period } : {}),
      ...(input.confidence !== undefined ? { confidence: input.confidence } : {}),
      ...(input.status !== undefined ? { status: input.status === "" ? null : input.status } : {}),
      ...(dueDate !== undefined ? { dueDate } : {}),
      ...(input.closingNote !== undefined ? { closingNote: input.closingNote } : {}),
      ...(input.ownerId !== undefined
        ? { ownerId: input.ownerId === "" ? null : input.ownerId }
        : {}),
    });
  },
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
    metricType: metricTypeEnum.optional(),
    precision: optPrecision,
    currencyCode: optStr,
    rollupWeight: optNum,
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
      ...(input.metricType ? { metricType: input.metricType } : {}),
      ...(input.precision != null ? { precision: input.precision } : {}),
      currencyCode: input.currencyCode && input.currencyCode !== "" ? input.currencyCode : null,
      rollupWeight: input.rollupWeight ?? null,
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
    metricType: metricTypeEnum.optional(),
    precision: optPrecision,
    currencyCode: optStr,
    rollupWeight: optNum,
    baseline: optNum,
    target: optNum,
    current: optNum,
    formula: z.enum(["auto_from_kpi", "manual"]).optional(),
    status: goalStatusEnum.optional().or(z.literal("")),
    dueDate: optStr,
    ownerId: z.string().uuid().optional().or(z.literal("")),
  }),
  action: "target.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) => {
    const dueDate = toDueDate(input.dueDate);
    return updateKeyResult(ctx, {
      id: input.id,
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.metricName !== undefined ? { metricName: input.metricName } : {}),
      ...(input.metricUnit !== undefined ? { metricUnit: input.metricUnit } : {}),
      ...(input.metricType !== undefined ? { metricType: input.metricType } : {}),
      ...(input.precision !== undefined ? { precision: input.precision } : {}),
      ...(input.currencyCode !== undefined
        ? { currencyCode: input.currencyCode === "" ? null : input.currencyCode }
        : {}),
      ...(input.rollupWeight !== undefined ? { rollupWeight: input.rollupWeight } : {}),
      ...(input.baseline !== undefined ? { baseline: input.baseline } : {}),
      ...(input.target !== undefined ? { target: input.target } : {}),
      ...(input.current !== undefined ? { current: input.current } : {}),
      ...(input.formula !== undefined ? { formula: input.formula } : {}),
      ...(input.status !== undefined ? { status: input.status === "" ? null : input.status } : {}),
      ...(dueDate !== undefined ? { dueDate } : {}),
      ...(input.ownerId !== undefined
        ? { ownerId: input.ownerId === "" ? null : input.ownerId }
        : {}),
    });
  },
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

// ── Goal Check-in + Comment ────────────────────────────────────────────

export const checkInGoalAction = createServerAction({
  schema: z.object({
    target: goalTargetEnum,
    id: z.string().uuid(),
    status: goalStatusEnum,
    progress: optNum,
    note: optStr,
    sections: goalSectionsField,
  }),
  action: "target.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) =>
    recordGoalCheckin(ctx, {
      target: input.target,
      id: input.id,
      status: input.status,
      ...(input.progress !== undefined ? { progress: input.progress } : {}),
      ...(input.note !== undefined ? { note: input.note } : {}),
      ...(input.sections !== undefined ? { sections: input.sections } : {}),
    }),
  revalidate: "ziele",
  mapError: (e) => formatDomainError(e, { fallback: "Check-in fehlgeschlagen" }),
});

export const updateGoalProgressAction = createServerAction({
  schema: z.object({
    id: z.string().uuid(),
    value: z.coerce.number(),
    entryDate: optStr,
  }),
  action: "target.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) =>
    recordGoalProgress(ctx, {
      keyResultId: input.id,
      value: input.value,
      ...(input.entryDate ? { entryDate: new Date(input.entryDate) } : {}),
    }),
  revalidate: "ziele",
  mapError: (e) =>
    formatDomainError(e, { fallback: "Fortschritt konnte nicht aktualisiert werden" }),
});

export const addGoalCommentAction = createServerAction({
  schema: z.object({
    target: goalTargetEnum,
    id: z.string().uuid(),
    body: z.string().min(1).max(2000),
  }),
  action: "target.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) =>
    addGoalComment(ctx, { target: input.target, id: input.id, body: input.body }),
  revalidate: "ziele",
  mapError: (e) => formatDomainError(e, { fallback: "Kommentar konnte nicht gespeichert werden" }),
});

// ── KR ↔ KPI Bindung ──────────────────────────────────────────────────

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
  action: "kpi.bind",
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

/**
 * Epic ↔ Ziel-Verknüpfung ("Related work"). Hängt ein Epic direkt an ein
 * Objective oder Key Result; sein KPI-Mehrwert rollt danach in den Ziel-Trio.
 * Capability `kpi.bind` (gleiche „Wert an ein Ziel hängen"-Verantwortung).
 */
export const linkEpicToGoalAction = createServerAction({
  schema: z.object({
    target: z.enum(["objective", "kr"]),
    goalId: z.string().uuid(),
    epicId: z.string().uuid(),
  }),
  action: "kpi.bind",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) =>
    linkEpicToGoal(ctx, {
      epicId: input.epicId,
      objectiveId: input.target === "objective" ? input.goalId : null,
      keyResultId: input.target === "kr" ? input.goalId : null,
    }),
  revalidate: "ziele",
  mapError: (e) => formatDomainError(e, { fallback: "Epic-Verknüpfung fehlgeschlagen" }),
});

export const unlinkEpicFromGoalAction = createServerAction({
  schema: z.object({ epicId: z.string().uuid() }),
  action: "kpi.bind",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) => unlinkEpicFromGoal(ctx, { epicId: input.epicId }),
  revalidate: "ziele",
  mapError: (e) => formatDomainError(e, { fallback: "Epic-Verknüpfung lösen fehlgeschlagen" }),
});
