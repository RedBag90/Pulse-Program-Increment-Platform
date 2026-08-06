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
  reparentGoalNode,
  recordGoalCheckin,
  recordGoalProgress,
  addGoalComment,
} from "@/server/services/ziele";
import { linkEpicToGoal, unlinkEpicFromGoal } from "@/server/services/goal-epic-link";
import { setGoalCustomFieldValue } from "@/server/services/goal-custom-field";
import { addGoalRelatedWork, removeGoalRelatedWork } from "@/server/services/goal-related-work";
import {
  linkGoalValueStream,
  unlinkGoalValueStream,
  linkGoalArt,
  unlinkGoalArt,
} from "@/server/services/goal-scope-link";
import { isGoalPeriodKey } from "@/domain/goal-period";

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
/**
 * Fortschrittsquelle (goal-progress-mode.ts); leer/undef ⇒ abgeleitet. Wie
 * statusField: abwesendes Union-Feld liest `parseFromSchema` als null → hier
 * `null → undefined` normalisieren, damit `.optional()` greift.
 */
const progressModeField = z.preprocess(
  (v) => v ?? undefined,
  z.enum(["manual", "rollup", "auto_kpi", "kpi_tree"]).optional().or(z.literal("")),
);

/**
 * Zeitraum-Feld: kanonischer Key (YYYY-Qn | YYYY-Hn | YYYY) ODER "" (löschen)
 * ODER undefined (unverändert). Der Picker erzeugt nur gültige Keys; der
 * Refine ist die Sicherheitsnetz-Validierung gegen malforme Eingaben.
 */
const periodField = z
  .string()
  .refine((v) => v === "" || isGoalPeriodKey(v), "Ungültiger Zeitraum")
  .optional();

/**
 * Clearbare `.or("")`-Union-Felder: `parseFromSchema` liest ein **abwesendes**
 * Union-Feld als `null` (nicht `undefined`), was die Union sonst mit „Invalid
 * input" ablehnt. Hier `null → undefined` normalisieren ⇒ `.optional()` greift
 * (Feld unverändert lassen); `""` bleibt erhalten (= löschen).
 */
const statusField = z.preprocess(
  (v) => v ?? undefined,
  goalStatusEnum.optional().or(z.literal("")),
);
const ownerIdField = z.preprocess(
  (v) => v ?? undefined,
  z.string().uuid().optional().or(z.literal("")),
);

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
  describeCreated: (v: { id: string }) => ({ id: v.id, label: "Ziel", href: "/ziele" }),
  schema: z.object({
    // Optional; serverseitig wird die Default-StrategicTheme aufgeloest,
    // wenn der Wert fehlt (Hierarchie-Vereinfachung).
    themeId: z.string().uuid().optional(),
    /** Eltern-Goal-Knoten für ein Sub-Ziel (beliebig tiefe Kaskade). */
    parentObjectiveId: z.string().uuid().optional(),
    title: z.string().min(1).max(200),
    narrative: optStr,
    period: periodField,
    ownerId: z.string().uuid().optional(),
    // Optionaler Metrik-Block (jeder Knoten kann messbar sein) + Fortschrittsquelle.
    metricName: optStr,
    metricUnit: optStr,
    metricType: metricTypeEnum.optional(),
    precision: optPrecision,
    currencyCode: optStr,
    rollupWeight: optNum,
    parentUnitPerChildUnit: optNum,
    baseline: optNum,
    target: optNum,
    current: optNum,
    progressMode: progressModeField,
  }),
  action: "target.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) =>
    createObjective(ctx, {
      ...(input.themeId ? { themeId: input.themeId } : {}),
      ...(input.parentObjectiveId ? { parentObjectiveId: input.parentObjectiveId } : {}),
      title: input.title,
      narrative: input.narrative ?? null,
      period: input.period || null,
      ownerId: input.ownerId ?? null,
      metricName: input.metricName ?? null,
      metricUnit: input.metricUnit ?? null,
      ...(input.metricType ? { metricType: input.metricType } : {}),
      ...(input.precision != null ? { precision: input.precision } : {}),
      currencyCode: input.currencyCode && input.currencyCode !== "" ? input.currencyCode : null,
      rollupWeight: input.rollupWeight ?? null,
      parentUnitPerChildUnit: input.parentUnitPerChildUnit ?? null,
      baseline: input.baseline ?? null,
      target: input.target ?? null,
      current: input.current ?? null,
      progressMode: input.progressMode ? input.progressMode : null,
    }),
  revalidate: "ziele",
  mapError: (e) => formatDomainError(e, { fallback: "Ziel konnte nicht angelegt werden" }),
});

/** Vereinheitlichter Alias — ein Erstellungspfad für jeden Goal-Knoten. */
export const createGoalNodeAction = createObjectiveAction;

export const updateObjectiveAction = createServerAction({
  schema: z.object({
    id: z.string().uuid(),
    title: z.string().min(1).max(200).optional(),
    narrative: optStr,
    period: periodField,
    status: statusField,
    dueDate: optStr,
    closingNote: optStr,
    ownerId: ownerIdField,
    // Optionaler Metrik-Block + Fortschrittsquelle.
    metricName: optStr,
    metricUnit: optStr,
    metricType: metricTypeEnum.optional(),
    precision: optPrecision,
    currencyCode: optStr,
    rollupWeight: optNum,
    parentUnitPerChildUnit: optNum,
    baseline: optNum,
    target: optNum,
    current: optNum,
    progressMode: progressModeField,
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
      ...(input.status !== undefined ? { status: input.status === "" ? null : input.status } : {}),
      ...(dueDate !== undefined ? { dueDate } : {}),
      ...(input.closingNote !== undefined ? { closingNote: input.closingNote } : {}),
      ...(input.ownerId !== undefined
        ? { ownerId: input.ownerId === "" ? null : input.ownerId }
        : {}),
      ...(input.metricName !== undefined ? { metricName: input.metricName } : {}),
      ...(input.metricUnit !== undefined ? { metricUnit: input.metricUnit } : {}),
      ...(input.metricType !== undefined ? { metricType: input.metricType } : {}),
      ...(input.precision !== undefined ? { precision: input.precision } : {}),
      ...(input.currencyCode !== undefined
        ? { currencyCode: input.currencyCode === "" ? null : input.currencyCode }
        : {}),
      ...(input.rollupWeight !== undefined ? { rollupWeight: input.rollupWeight } : {}),
      ...(input.parentUnitPerChildUnit !== undefined
        ? { parentUnitPerChildUnit: input.parentUnitPerChildUnit }
        : {}),
      ...(input.baseline !== undefined ? { baseline: input.baseline } : {}),
      ...(input.target !== undefined ? { target: input.target } : {}),
      ...(input.current !== undefined ? { current: input.current } : {}),
      ...(input.progressMode !== undefined
        ? { progressMode: input.progressMode === "" ? null : input.progressMode }
        : {}),
    });
  },
  revalidate: "ziele",
  mapError: (e) => formatDomainError(e, { fallback: "Ziel konnte nicht aktualisiert werden" }),
});

/** Vereinheitlichter Alias — ein Update-Pfad für jeden Goal-Knoten. */
export const updateGoalNodeAction = updateObjectiveAction;

export const deleteObjectiveAction = createServerAction({
  schema: z.object({ id: z.string().uuid() }),
  action: "target.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) => deleteObjective(ctx, { id: input.id }),
  revalidate: "ziele",
  mapError: (e) => formatDomainError(e, { fallback: "Objective konnte nicht geloescht werden" }),
});

/** Knoten (samt Subtree) unter einen neuen Parent verschieben; "" = oberste Ebene. */
export const reparentGoalNodeAction = createServerAction({
  schema: z.object({
    id: z.string().uuid(),
    newParentId: z.string().uuid().optional().or(z.literal("")),
    // Geschwister-Position: Ziel wird VOR diese id einsortiert; "" = ans Ende;
    // Feld fehlt (Drawer „Elternziel setzen") = kein Reorder (Append).
    beforeId: z.string().uuid().optional().or(z.literal("")),
  }),
  action: "target.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) =>
    reparentGoalNode(ctx, {
      id: input.id,
      newParentId: input.newParentId && input.newParentId !== "" ? input.newParentId : null,
      ...(input.beforeId !== undefined
        ? { beforeId: input.beforeId === "" ? null : input.beforeId }
        : {}),
    }),
  revalidate: "ziele",
  mapError: (e) => formatDomainError(e, { fallback: "Verschieben fehlgeschlagen" }),
});

/** Verantwortliches Team am Ziel setzen/entfernen (Asana „Accountable team"). */
export const setGoalAccountableTeamAction = createServerAction({
  schema: z.object({
    id: z.string().uuid(),
    accountableTeamId: z.string().uuid().optional().or(z.literal("")),
  }),
  action: "target.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) =>
    updateObjective(ctx, {
      id: input.id,
      accountableTeamId:
        input.accountableTeamId && input.accountableTeamId !== "" ? input.accountableTeamId : null,
    }),
  revalidate: "ziele",
  mapError: (e) => formatDomainError(e, { fallback: "Team konnte nicht gesetzt werden" }),
});

/** Asana „Remove from automatic progress" — ein Unterziel aus dem Eltern-Rollup nehmen/aufnehmen. */
export const setGoalRollupInclusionAction = createServerAction({
  schema: z.object({
    id: z.string().uuid(),
    // FormData liefert Strings; String-Enum statt z.boolean() (siehe form-data-schema).
    // Kein .transform() — der Next-„use server"-Checker lehnt inline-Closures ab.
    include: z.enum(["true", "false"]),
  }),
  action: "target.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) =>
    updateObjective(ctx, { id: input.id, includeInParentRollup: input.include === "true" }),
  revalidate: "ziele",
  mapError: (e) =>
    formatDomainError(e, { fallback: "Rollup-Einstellung konnte nicht geändert werden" }),
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
    parentUnitPerChildUnit: optNum,
    baseline: optNum,
    target: optNum,
    current: optNum,
    period: periodField,
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
      parentUnitPerChildUnit: input.parentUnitPerChildUnit ?? null,
      baseline: input.baseline ?? null,
      target: input.target ?? null,
      current: input.current ?? null,
      period: input.period || null,
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
    parentUnitPerChildUnit: optNum,
    baseline: optNum,
    target: optNum,
    current: optNum,
    period: periodField,
    status: statusField,
    dueDate: optStr,
    ownerId: ownerIdField,
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
      ...(input.parentUnitPerChildUnit !== undefined
        ? { parentUnitPerChildUnit: input.parentUnitPerChildUnit }
        : {}),
      ...(input.baseline !== undefined ? { baseline: input.baseline } : {}),
      ...(input.target !== undefined ? { target: input.target } : {}),
      ...(input.current !== undefined ? { current: input.current } : {}),
      ...(input.period !== undefined ? { period: input.period === "" ? null : input.period } : {}),
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
    /** Neuer Ist-Wert bei manuellen Zielen (optional, nur „kr"). */
    value: optNum,
    note: optStr,
    sections: goalSectionsField,
    /** Gewähltes Datum des Status-Updates (setzt den Graf-Punkt). */
    entryDate: optStr,
  }),
  action: "target.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) =>
    recordGoalCheckin(ctx, {
      target: input.target,
      id: input.id,
      status: input.status,
      ...(input.progress !== undefined ? { progress: input.progress } : {}),
      ...(input.value !== undefined ? { value: input.value } : {}),
      ...(input.note !== undefined ? { note: input.note } : {}),
      ...(input.sections !== undefined ? { sections: input.sections } : {}),
      ...(input.entryDate ? { entryDate: new Date(input.entryDate) } : {}),
    }),
  revalidate: "ziele",
  mapError: (e) => formatDomainError(e, { fallback: "Check-in fehlgeschlagen" }),
});

export const updateGoalProgressAction = createServerAction({
  schema: z.object({
    id: z.string().uuid(),
    value: z.coerce.number(),
    /** Gewähltes Datum des Wert-Eintrags (setzt den neutralen Graf-Punkt). */
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

/**
 * Epic ↔ Ziel-Verknüpfung ("Related work"). Hängt ein Epic direkt an ein
 * Objective oder Key Result; sein KPI-Mehrwert rollt danach in den Ziel-Trio.
 * Capability `kpi.bind` (gleiche „Wert an ein Ziel hängen"-Verantwortung).
 */
export const linkEpicToGoalAction = createServerAction({
  schema: z.object({
    goalId: z.string().uuid(),
    epicId: z.string().uuid(),
    // Einheiten-Kaskade: gewählte Erfolgs-KPI + Umrechnungsfaktor + Wirkungsart.
    kpiId: z.string().uuid().optional(),
    conversionFactor: optNum,
    impactKind: z.enum(["one_time", "recurring"]).optional(),
    recurringInterval: z.enum(["monthly", "yearly"]).optional(),
  }),
  action: "kpi.bind",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) =>
    linkEpicToGoal(ctx, {
      epicId: input.epicId,
      objectiveId: input.goalId,
      kpiId: input.kpiId ?? null,
      conversionFactor: input.conversionFactor ?? null,
      ...(input.impactKind ? { impactKind: input.impactKind } : {}),
      ...(input.recurringInterval ? { recurringInterval: input.recurringInterval } : {}),
    }),
  revalidate: "ziele",
  mapError: (e) => formatDomainError(e, { fallback: "Epic-Verknüpfung fehlgeschlagen" }),
});

export const unlinkEpicFromGoalAction = createServerAction({
  schema: z.object({ epicId: z.string().uuid(), goalId: z.string().uuid() }),
  action: "kpi.bind",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) =>
    unlinkEpicFromGoal(ctx, { epicId: input.epicId, objectiveId: input.goalId }),
  revalidate: "ziele",
  mapError: (e) => formatDomainError(e, { fallback: "Epic-Verknüpfung lösen fehlgeschlagen" }),
});

/**
 * Referenzielle Related-Work-Verknüpfung eines Ziels mit Feature/PI (Epic 5).
 * Kein Wertbeitrag — nur Deeplink. Gate `target.manage`.
 */
export const addGoalRelatedWorkAction = createServerAction({
  schema: z.object({
    goalId: z.string().uuid(),
    kind: z.enum(["feature", "pi"]),
    refId: z.string().uuid(),
  }),
  action: "target.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) =>
    addGoalRelatedWork(ctx, {
      objectiveId: input.goalId,
      kind: input.kind,
      refId: input.refId,
    }),
  revalidate: "ziele",
  mapError: (e) => formatDomainError(e, { fallback: "Verknüpfung fehlgeschlagen" }),
});

export const removeGoalRelatedWorkAction = createServerAction({
  schema: z.object({
    goalId: z.string().uuid(),
    kind: z.enum(["feature", "pi"]),
    refId: z.string().uuid(),
  }),
  action: "target.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) =>
    removeGoalRelatedWork(ctx, {
      objectiveId: input.goalId,
      kind: input.kind,
      refId: input.refId,
    }),
  revalidate: "ziele",
  mapError: (e) => formatDomainError(e, { fallback: "Verknüpfung lösen fehlgeschlagen" }),
});

/**
 * VS/ART-Verantwortung eines Ziels (Epic 6a, n:m). Rein organisatorisch,
 * additiv — Gate `target.manage`.
 */
export const linkGoalValueStreamAction = createServerAction({
  schema: z.object({ goalId: z.string().uuid(), valueStreamId: z.string().uuid() }),
  action: "target.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) =>
    linkGoalValueStream(ctx, { objectiveId: input.goalId, valueStreamId: input.valueStreamId }),
  revalidate: "ziele",
  mapError: (e) => formatDomainError(e, { fallback: "Value-Stream-Zuordnung fehlgeschlagen" }),
});

export const unlinkGoalValueStreamAction = createServerAction({
  schema: z.object({ goalId: z.string().uuid(), valueStreamId: z.string().uuid() }),
  action: "target.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) =>
    unlinkGoalValueStream(ctx, { objectiveId: input.goalId, valueStreamId: input.valueStreamId }),
  revalidate: "ziele",
  mapError: (e) =>
    formatDomainError(e, { fallback: "Value-Stream-Zuordnung lösen fehlgeschlagen" }),
});

export const linkGoalArtAction = createServerAction({
  schema: z.object({ goalId: z.string().uuid(), artId: z.string().uuid() }),
  action: "target.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) => linkGoalArt(ctx, { objectiveId: input.goalId, artId: input.artId }),
  revalidate: "ziele",
  mapError: (e) => formatDomainError(e, { fallback: "ART-Zuordnung fehlgeschlagen" }),
});

export const unlinkGoalArtAction = createServerAction({
  schema: z.object({ goalId: z.string().uuid(), artId: z.string().uuid() }),
  action: "target.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) => unlinkGoalArt(ctx, { objectiveId: input.goalId, artId: input.artId }),
  revalidate: "ziele",
  mapError: (e) => formatDomainError(e, { fallback: "ART-Zuordnung lösen fehlgeschlagen" }),
});

/**
 * Custom-Field-Wert an einem Ziel-Knoten setzen/löschen (Epic 7). Leerer Wert
 * ⇒ löschen; Validierung gegen den Feldtyp im Service.
 */
export const setGoalCustomFieldValueAction = createServerAction({
  schema: z.object({
    target: goalTargetEnum,
    goalId: z.string().uuid(),
    defId: z.string().uuid(),
    value: z.string().max(2000),
  }),
  action: "target.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) =>
    setGoalCustomFieldValue(ctx, {
      objectiveId: input.goalId,
      defId: input.defId,
      value: input.value,
    }),
  revalidate: "ziele",
  mapError: (e) =>
    formatDomainError(e, { fallback: "Custom-Field-Wert konnte nicht gesetzt werden" }),
});
