import { Prisma, type PrismaClient } from "@/generated/prisma";
import type { Result } from "@/modules/core/kernel/domain/errors";
import { ok, err } from "@/modules/core/kernel/domain/errors";
import type { RequestContext } from "@/server/http/mutation-handler";
import { withAuditedTransaction, toMutationContext } from "@/modules/core/kernel/server/mutation";
import {
  goalRecordedUpdate,
  OBJECTIVE_FIELD_KEYS,
  KEY_RESULT_FIELD_KEYS,
} from "@/modules/core/goals/server/services/goal-node-fields";
import { isClosed, isOpen, type GoalStatus } from "@/modules/core/goals/domain/goal-status";
import {
  clampPrecision,
  DEFAULT_METRIC_TYPE,
  initialMetricScale,
  type MetricType,
} from "@/modules/core/goals/domain/goal-metric";
import {
  canReparent,
  planReparent,
  reorderSiblingIds,
} from "@/modules/core/goals/domain/goal-reparent";
import {
  autoKpiCurrent,
  effectiveProgressMode,
  acceptsDirectValue,
  type AutoKpiLink,
} from "@/modules/core/goals/domain/goal-progress-mode";
import {
  isConfidenceValue,
  confidenceScaleFields,
  CONFIDENCE_MIN,
  CONFIDENCE_MAX,
} from "@/modules/core/goals/domain/goal-confidence";
import {
  mergeCheckinSlot,
  type CheckinSlot,
  type CheckinPatch,
  type GoalSection,
} from "@/modules/core/goals/domain/goal-checkin-slot";
import {
  goalEntryEditDeniedReason,
  goalEntryDeleteDeniedReason,
} from "@/modules/core/goals/domain/goal-entry-access";
import { latestMeasurement } from "@/modules/core/kpi/domain/kpi-measurement";
import { dayStart } from "@/modules/core/kernel/domain/calendar";
import { InitiativeLevel } from "@/modules/core/kernel/domain/types";

export type GoalTarget = "objective" | "kr";

/**
 * Ziele-Modul-Services (Konzept V2). Reines CRUD + Audit, kein
 * Permission-Check — der laeuft in den Server-Actions (ADR-0002).
 */

// ── Objective ──────────────────────────────────────────────────────────

export interface CreateObjectiveInput {
  /** Optional. Fehlt themeId UND parentObjectiveId, wird die versteckte
   *  Default-StrategicTheme find-or-created (Top-Level-Knoten). */
  themeId?: string | null;
  /** Eltern-Goal-Knoten für beliebig tiefe Kaskaden. Erbt dessen themeId/level. */
  parentObjectiveId?: string | null;
  /** "objective" | "key_result" — nur Legacy-Label; Default aus target abgeleitet. */
  nodeKind?: string;
  title: string;
  narrative?: string | null;
  period?: string | null;
  periodStart?: Date | null;
  periodEnd?: Date | null;
  ownerId?: string | null;
  // Optionaler Metrik-Block (jeder Knoten kann messbar sein).
  metricName?: string | null;
  metricUnit?: string | null;
  metricType?: MetricType;
  precision?: number;
  currencyCode?: string | null;
  rollupWeight?: number | null;
  parentUnitPerChildUnit?: number | null;
  baseline?: number | null;
  target?: number | null;
  current?: number | null;
  /** Fortschrittsquelle (manual | rollup | kpi_tree); null/undef ⇒ abgeleitet. */
  progressMode?: string | null;
}

export async function createObjective(
  ctx: RequestContext,
  input: CreateObjectiveInput,
): Promise<Result<{ id: string }>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    let themeId = input.themeId ?? null;
    let level = 0;
    let parentPath = "";

    if (input.parentObjectiveId) {
      // Kind-Knoten: themeId + level vom Parent erben.
      const parent = await tx.objective.findFirst({
        where: { id: input.parentObjectiveId, tenantId: mctx.tenantId },
      });
      if (!parent) {
        return err({
          kind: "not_found" as const,
          resourceType: "Objective",
          id: input.parentObjectiveId,
        });
      }
      themeId = parent.themeId;
      level = parent.level + 1;
      parentPath = parent.path;
    } else if (!themeId) {
      // Top-Level ohne themeId → Default-StrategicTheme find-or-create.
      const existing = await tx.strategicTheme.findFirst({
        where: { tenantId: mctx.tenantId },
        orderBy: { createdAt: "asc" },
      });
      themeId =
        existing?.id ??
        (
          await tx.strategicTheme.create({
            data: {
              tenantId: mctx.tenantId,
              title: "Default",
              kind: "business",
              color: "#6366f1",
              createdBy: mctx.actorId,
              updatedBy: mctx.actorId,
            },
          })
        ).id;
    } else {
      const theme = await tx.strategicTheme.findFirst({
        where: { id: themeId, tenantId: mctx.tenantId },
      });
      if (!theme) {
        return err({ kind: "not_found" as const, resourceType: "StrategicTheme", id: themeId });
      }
    }

    const objective = await tx.objective.create({
      data: {
        tenantId: mctx.tenantId,
        themeId: themeId!,
        parentObjectiveId: input.parentObjectiveId ?? null,
        // nodeKind ist nur noch Legacy-Label — best-effort aus der Metrik abgeleitet.
        nodeKind: input.nodeKind ?? (input.target != null ? "key_result" : "objective"),
        level,
        path: "",
        title: input.title,
        narrative: input.narrative ?? null,
        period: input.period ?? null,
        periodStart: input.periodStart ?? null,
        periodEnd: input.periodEnd ?? null,
        ownerId: input.ownerId ?? null,
        metricName: input.metricName ?? null,
        metricUnit: input.metricUnit ?? null,
        /**
         * **Ein neues Ziel startet auf einer Prozentskala 0–100.**
         *
         * Vorher entschied das der Prisma-Default der Spalte („number") — an
         * einer Stelle, die kein Formular kennt. Das Ergebnis war ein stiller
         * Unterschied: wer den Ziel-Drawer benutzte, wählte den Typ selbst;
         * wer den Schnell-Dialog „Neues Ziel" benutzte, bekam „Zahl", ohne
         * dass jemand das gewählt hätte. Jetzt entscheidet **eine** Stelle.
         */
        metricType: input.metricType ?? DEFAULT_METRIC_TYPE,
        ...(input.precision != null ? { precision: clampPrecision(input.precision) } : {}),
        currencyCode: input.currencyCode ?? null,
        rollupWeight: input.rollupWeight ?? null,
        parentUnitPerChildUnit: input.parentUnitPerChildUnit ?? null,
        // Zur Prozentskala gehören ihre Enden. Sie stehen hier und nicht als
        // Spalten-Default, weil die Zeile sie sonst überschriebe: `?? null`
        // schreibt eine Null, und gegen eine Null kommt kein Default an.
        ...initialMetricScale(input),
        current: input.current ?? null,
        progressMode: input.progressMode ?? null,
        // `confidence` bringt seine Skala mit: 1..5, fest. Danach ist die Zeile
        // ein manuelles Ziel mit fester Skala — mehr braucht es nicht.
        ...(confidenceScaleFields(input.progressMode, null) ?? {}),
        createdBy: mctx.actorId,
        updatedBy: mctx.actorId,
      },
    });
    // Materialisierten Pfad nachtragen (braucht die generierte id).
    await tx.objective.update({
      where: { id: objective.id },
      data: { path: parentPath ? `${parentPath}/${objective.id}` : objective.id },
    });
    return ok({
      result: { id: objective.id },
      audit: { action: "objective.created", resourceType: "objective", resourceId: objective.id },
    });
  });
}

export interface UpdateObjectiveInput {
  id: string;
  title?: string;
  narrative?: string | null;
  period?: string | null;
  periodStart?: Date | null;
  periodEnd?: Date | null;
  status?: GoalStatus | null;
  closingNote?: string | null;
  ownerId?: string | null;
  // Optionaler Metrik-Block + Fortschrittsquelle (jeder Knoten kann messbar sein).
  metricName?: string | null;
  metricUnit?: string | null;
  metricType?: MetricType;
  precision?: number;
  currencyCode?: string | null;
  rollupWeight?: number | null;
  parentUnitPerChildUnit?: number | null;
  includeInParentRollup?: boolean;
  baseline?: number | null;
  target?: number | null;
  current?: number | null;
  progressMode?: string | null;
  accountableTeamId?: string | null;
}

export async function updateObjective(
  ctx: RequestContext,
  input: UpdateObjectiveInput,
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    const existing = await tx.objective.findFirst({
      where: { id: input.id, tenantId: mctx.tenantId },
    });
    if (!existing) {
      return err({ kind: "not_found" as const, resourceType: "Objective", id: input.id });
    }
    // Die Skala **vor** dem Diff einsetzen, damit der Prüfpfad sie als Änderung
    // sieht: ein Wechsel auf „Zuversicht" verschiebt `baseline`/`target`, und
    // das ist eine Änderung am Ziel, keine Nebenwirkung.
    const scale = confidenceScaleFields(
      input.progressMode !== undefined ? input.progressMode : existing.progressMode,
      existing.progressMode,
    );
    const { changes, data } = goalRecordedUpdate(
      existing,
      scale ? { ...input, ...scale } : input,
      OBJECTIVE_FIELD_KEYS,
    );
    // A closed status stamps closedAt; reopening (open status) clears it.
    const closedAt: { closedAt?: Date | null } = {};
    if (input.status !== undefined) {
      if (isClosed(input.status) && existing.closedAt == null) closedAt.closedAt = new Date();
      else if (isOpen(input.status) && existing.closedAt != null) closedAt.closedAt = null;
    }
    await tx.objective.update({
      where: { id: input.id },
      data: { ...data, ...closedAt, updatedBy: mctx.actorId },
    });
    return ok({
      result: undefined,
      audit: {
        action: "objective.updated",
        resourceType: "objective",
        resourceId: input.id,
        changes,
      },
    });
  });
}

export async function deleteObjective(
  ctx: RequestContext,
  input: { id: string },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    const existing = await tx.objective.findFirst({
      where: { id: input.id, tenantId: mctx.tenantId },
    });
    if (!existing) {
      return err({ kind: "not_found" as const, resourceType: "Objective", id: input.id });
    }
    // Rekursiver Subtree-Delete über den materialisierten Pfad (die Self-
    // Relation trägt kein DB-Cascade). Dependents (Check-ins/Kommentare/
    // KPI-Bindungen/Epic-Links) fallen per objectiveId-Cascade mit.
    await tx.objective.deleteMany({
      where: {
        tenantId: mctx.tenantId,
        OR: [{ id: input.id }, { path: { startsWith: `${existing.path}/` } }],
      },
    });
    return ok({
      result: undefined,
      audit: { action: "objective.deleted", resourceType: "objective", resourceId: input.id },
    });
  });
}

/**
 * Verschiebt einen Goal-Knoten (samt Subtree) unter einen neuen Parent — oder
 * auf die oberste Ebene (`newParentId = null`). Zyklus-Guard über den
 * materialisierten `path`; für Knoten + alle Nachfahren werden `path`, `level`
 * und `themeId` (vom neuen Parent geerbt) neu gesetzt.
 */
export async function reparentGoalNode(
  ctx: RequestContext,
  input: { id: string; newParentId?: string | null; beforeId?: string | null },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const newParentId = input.newParentId ?? null;
  const beforeId = input.beforeId ?? null;
  return withAuditedTransaction(mctx, async (tx) => {
    const node = await tx.objective.findFirst({
      where: { id: input.id, tenantId: mctx.tenantId },
    });
    if (!node) {
      return err({ kind: "not_found" as const, resourceType: "Objective", id: input.id });
    }

    const parentChanged = (node.parentObjectiveId ?? null) !== newParentId;

    // Reiner Kein-Op: gleicher Parent UND keine Positionsangabe (Drawer-Fall).
    if (!parentChanged && input.beforeId === undefined) {
      return ok({
        result: undefined,
        audit: { action: "objective.updated", resourceType: "objective", resourceId: node.id },
      });
    }

    let parent: { id: string; path: string; level: number; themeId: string } | null = null;
    if (newParentId) {
      const p = await tx.objective.findFirst({
        where: { id: newParentId, tenantId: mctx.tenantId },
      });
      if (!p) {
        return err({ kind: "not_found" as const, resourceType: "Objective", id: newParentId });
      }
      parent = { id: p.id, path: p.path, level: p.level, themeId: p.themeId };
    }

    // Parent-Wechsel: Zyklus-Guard + Subtree-Re-Materialisierung (path/level/themeId).
    if (parentChanged) {
      if (
        !canReparent({
          nodeId: node.id,
          nodePath: node.path,
          targetId: newParentId,
          targetPath: parent?.path ?? null,
        })
      ) {
        return err({
          kind: "conflict" as const,
          reason: "Ein Ziel kann nicht unter sich selbst oder einen Nachfahren verschoben werden.",
        });
      }

      const subtree = await tx.objective.findMany({
        where: {
          tenantId: mctx.tenantId,
          OR: [{ id: node.id }, { path: { startsWith: `${node.path}/` } }],
        },
        select: { id: true, path: true, level: true },
      });
      const writes = planReparent({
        node: {
          id: node.id,
          path: node.path,
          level: node.level,
          themeId: node.themeId,
          parentObjectiveId: node.parentObjectiveId ?? null,
        },
        parent,
        newParentId,
        subtree,
      });
      for (const w of writes) {
        await tx.objective.update({
          where: { id: w.id },
          data: {
            path: w.path,
            level: w.level,
            themeId: w.themeId,
            ...("parentObjectiveId" in w ? { parentObjectiveId: w.parentObjectiveId } : {}),
            updatedBy: mctx.actorId,
          },
        });
      }
    }

    // Geschwister am Ziel-Parent neu indizieren (Reorder + Reparent-Einsortierung).
    const siblings = await tx.objective.findMany({
      where: { tenantId: mctx.tenantId, parentObjectiveId: newParentId, id: { not: node.id } },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    });
    const orderedIds = reorderSiblingIds(
      siblings.map((s) => s.id),
      node.id,
      beforeId,
    );
    for (const [i, id] of orderedIds.entries()) {
      await tx.objective.update({
        where: { id },
        data: { sortOrder: i, updatedBy: mctx.actorId },
      });
    }

    return ok({
      result: undefined,
      audit: {
        action: "objective.updated",
        resourceType: "objective",
        resourceId: node.id,
        ...(parentChanged
          ? {
              changes: {
                parentObjectiveId: { before: node.parentObjectiveId, after: newParentId },
              },
            }
          : {}),
      },
    });
  });
}

// ── KeyResult ──────────────────────────────────────────────────────────

export interface CreateKeyResultInput {
  objectiveId: string;
  title: string;
  metricName?: string | null;
  metricUnit?: string | null;
  metricType?: MetricType;
  precision?: number;
  currencyCode?: string | null;
  rollupWeight?: number | null;
  parentUnitPerChildUnit?: number | null;
  baseline?: number | null;
  target?: number | null;
  current?: number | null;
  period?: string | null;
  ownerId?: string | null;
}

export async function createKeyResult(
  ctx: RequestContext,
  input: CreateKeyResultInput,
): Promise<Result<{ id: string }>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    const objective = await tx.objective.findFirst({
      where: { id: input.objectiveId, tenantId: mctx.tenantId },
    });
    if (!objective) {
      return err({
        kind: "not_found" as const,
        resourceType: "Objective",
        id: input.objectiveId,
      });
    }
    // Nach der Vereinheitlichung ist ein Key Result ein Goal-Knoten
    // (nodeKind="key_result") unter dem Parent-Knoten.
    const kr = await tx.objective.create({
      data: {
        tenantId: mctx.tenantId,
        themeId: objective.themeId,
        parentObjectiveId: objective.id,
        nodeKind: "key_result",
        level: objective.level + 1,
        path: "",
        title: input.title,
        metricName: input.metricName ?? null,
        metricUnit: input.metricUnit ?? null,
        ...(input.metricType ? { metricType: input.metricType } : {}),
        ...(input.precision != null ? { precision: clampPrecision(input.precision) } : {}),
        currencyCode: input.currencyCode ?? null,
        rollupWeight: input.rollupWeight ?? null,
        parentUnitPerChildUnit: input.parentUnitPerChildUnit ?? null,
        baseline: input.baseline ?? null,
        target: input.target ?? null,
        current: input.current ?? null,
        period: input.period ?? null,
        ownerId: input.ownerId ?? null,
        createdBy: mctx.actorId,
        updatedBy: mctx.actorId,
      },
    });
    await tx.objective.update({
      where: { id: kr.id },
      data: { path: `${objective.path}/${kr.id}` },
    });
    return ok({
      result: { id: kr.id },
      audit: { action: "key_result.created", resourceType: "key_result", resourceId: kr.id },
    });
  });
}

export interface UpdateKeyResultInput {
  id: string;
  title?: string;
  metricName?: string | null;
  metricUnit?: string | null;
  metricType?: MetricType;
  precision?: number;
  currencyCode?: string | null;
  rollupWeight?: number | null;
  parentUnitPerChildUnit?: number | null;
  baseline?: number | null;
  target?: number | null;
  current?: number | null;
  period?: string | null;
  status?: GoalStatus | null;
  ownerId?: string | null;
}

export async function updateKeyResult(
  ctx: RequestContext,
  input: UpdateKeyResultInput,
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    const existing = await tx.objective.findFirst({
      where: { id: input.id, tenantId: mctx.tenantId },
    });
    if (!existing) {
      return err({ kind: "not_found" as const, resourceType: "KeyResult", id: input.id });
    }
    const { changes, data } = goalRecordedUpdate(existing, input, KEY_RESULT_FIELD_KEYS);
    await tx.objective.update({
      where: { id: input.id },
      data: { ...data, updatedBy: mctx.actorId },
    });
    return ok({
      result: undefined,
      audit: {
        action: "key_result.updated",
        resourceType: "key_result",
        resourceId: input.id,
        changes,
      },
    });
  });
}

export async function deleteKeyResult(
  ctx: RequestContext,
  input: { id: string },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    const existing = await tx.objective.findFirst({
      where: { id: input.id, tenantId: mctx.tenantId },
    });
    if (!existing) {
      return err({ kind: "not_found" as const, resourceType: "KeyResult", id: input.id });
    }
    // Ein KR ist ein Goal-Knoten; Subtree über den Pfad mitlöschen.
    await tx.objective.deleteMany({
      where: {
        tenantId: mctx.tenantId,
        OR: [{ id: input.id }, { path: { startsWith: `${existing.path}/` } }],
      },
    });
    return ok({
      result: undefined,
      audit: { action: "key_result.deleted", resourceType: "key_result", resourceId: input.id },
    });
  });
}

// ── Goal check-in + comment ─────────────────────────────────────────────

/**
 * One block of a structured status update (Asana-style composer).
 *
 * Liegt in `domain/goal-checkin-slot.ts`, weil die Merge-Regel des Tages-Slots
 * damit rechnet; hier re-exportiert, damit die Aufrufer nichts umschreiben.
 */
export type { GoalSection };

export interface CheckInGoalInput {
  target: GoalTarget;
  id: string;
  status: GoalStatus;
  /** Optional progress snapshot (0..1 rollup or raw KR value). */
  progress?: number | null;
  /**
   * Neuer Ist-Wert bei MANUELLEN Zielen: setzt zusammen mit dem Status-Update den
   * eingefrorenen Wert am gewählten Datum und aktualisiert `current` (nach der
   * „letzter Check-in gewinnt"-Regel). Ignoriert bei kpi_tree (dort
   * kommt der Ist aus den KPIs).
   */
  value?: number | null;
  note?: string | null;
  /** Structured update sections (Epic 4); backward-compatible with `note`. */
  sections?: GoalSection[] | null;
  /** Gewähltes Datum des Status-Updates (setzt den Graf-Punkt); Default now. */
  entryDate?: Date | null;
}

/**
 * Ein Check-in **pro Tag**: der bestehende Check-in des Knotens an diesem Tag
 * (`day` = UTC-Mitternacht) wird fortgeschrieben — sonst neu angelegt. „Letzter
 * Eintrag des Tages gewinnt" (Wert-Eintrag und Status-Update teilen den Slot).
 *
 * **Fortgeschrieben, nicht überschrieben.** Ein weggelassenes Feld
 * (`undefined`) bleibt stehen, `null` löscht es — die Regel steht rein in
 * `mergeCheckinSlot`. Vorher schrieb jeder Aufrufer den Slot vollständig neu,
 * und ein nachgetragener Wert löschte die Begründung des Morgens mit.
 */
async function upsertDayCheckin(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    objectiveId: string;
    day: Date;
    createdBy: string;
  } & CheckinPatch,
): Promise<{ id: string }> {
  const next = new Date(input.day);
  next.setUTCDate(next.getUTCDate() + 1);
  const existing = await tx.goalCheckin.findFirst({
    where: {
      tenantId: input.tenantId,
      objectiveId: input.objectiveId,
      createdAt: { gte: input.day, lt: next },
    },
    select: { id: true, status: true, value: true, progress: true, note: true, sections: true },
    orderBy: { createdAt: "desc" },
  });
  const { tenantId, objectiveId, day, createdBy, ...patch } = input;
  const slot = mergeCheckinSlot(existing ? rowToSlot(existing) : null, patch);
  const data = { ...slotToData(slot), createdAt: day };
  if (existing) {
    await tx.goalCheckin.update({ where: { id: existing.id }, data });
    return { id: existing.id };
  }
  const created = await tx.goalCheckin.create({
    data: { tenantId, objectiveId, createdBy, ...data },
  });
  return { id: created.id };
}

/** Prisma-Zeile → Slot (Decimal → number, Json → Sektionen). */
function rowToSlot(row: {
  status: string | null;
  value: unknown;
  progress: unknown;
  note: string | null;
  sections: unknown;
}): CheckinSlot {
  return {
    status: row.status,
    value: row.value == null ? null : Number(row.value),
    progress: row.progress == null ? null : Number(row.progress),
    note: row.note,
    sections: parseStoredSections(row.sections),
  };
}

/** Slot → Prisma-Schreibform (`null` für Json heißt `DbNull`, nicht JSON-`null`). */
function slotToData(slot: CheckinSlot) {
  return {
    status: slot.status,
    value: slot.value,
    progress: slot.progress,
    note: slot.note,
    sections:
      slot.sections && slot.sections.length > 0
        ? (slot.sections as unknown as Prisma.InputJsonValue)
        : Prisma.DbNull,
  };
}

/**
 * Die gespeicherte Json-Spalte zurück in Sektionen. Defensiv, weil dort
 * historisch auch `{}` gelandet ist (70 Zeilen im Bestand) — und ein leeres
 * Objekt ist keine Liste von Blöcken.
 */
function parseStoredSections(raw: unknown): GoalSection[] | null {
  if (!Array.isArray(raw)) return null;
  const out: GoalSection[] = [];
  for (const s of raw) {
    if (s && typeof s === "object" && "title" in s && "body" in s) {
      out.push({ title: String((s as GoalSection).title), body: String((s as GoalSection).body) });
    }
  }
  return out.length > 0 ? out : null;
}

/**
 * Ist-Wert eines manuellen Ziels = Wert des **zeitlich letzten** Wert-Check-ins
 * (max `createdAt`, `value != null`). Ein rückdatierter Eintrag (Datum vor dem
 * letzten Update) fügt nur den Datenpunkt hinzu und lässt `current` unberührt.
 * `fallback` greift, wenn es (noch) keinen Wert-Check-in gibt.
 */
async function latestCheckinCurrent(
  tx: Prisma.TransactionClient,
  tenantId: string,
  objectiveId: string,
  fallback: number,
): Promise<number> {
  const latest = await tx.goalCheckin.findFirst({
    where: { tenantId, objectiveId, value: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { value: true },
  });
  return latest?.value != null ? Number(latest.value) : fallback;
}

/**
 * Records a status/progress check-in on a goal (Objective or Key Result) and
 * stamps the entity's own `status` (+ `current` for a manual KR when a raw
 * value is given). Backs the Asana-style "Update status" flow + history chart.
 */
export async function recordGoalCheckin(
  ctx: RequestContext,
  input: CheckInGoalInput,
): Promise<Result<{ id: string }>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    if (input.target === "objective") {
      const existing = await tx.objective.findFirst({
        where: { id: input.id, tenantId: mctx.tenantId },
      });
      if (!existing) {
        return err({ kind: "not_found" as const, resourceType: "Objective", id: input.id });
      }
      const checkin = await upsertDayCheckin(tx, {
        tenantId: mctx.tenantId,
        objectiveId: input.id,
        day: dayStart(input.entryDate ?? new Date()),
        createdBy: mctx.actorId,
        status: input.status,
        value: null,
        progress: input.progress ?? null,
        note: input.note ?? null,
        sections: input.sections ?? null,
      });
      await tx.objective.update({
        where: { id: input.id },
        data: {
          status: input.status,
          closedAt: isClosed(input.status) ? (existing.closedAt ?? new Date()) : null,
          updatedBy: mctx.actorId,
        },
      });
      return ok({
        result: { id: checkin.id },
        audit: {
          action: "goal.checkin",
          resourceType: "objective",
          resourceId: input.id,
          changes: { status: { before: existing.status, after: input.status } },
        },
      });
    }

    const existing = await tx.objective.findFirst({
      where: { id: input.id, tenantId: mctx.tenantId },
    });
    if (!existing) {
      return err({ kind: "not_found" as const, resourceType: "KeyResult", id: input.id });
    }
    // Ist-Wert zum Check-in-Zeitpunkt einfrieren (→ Graf-Punkt am gewählten
    // Datum): `manual` friert die eigene `current`-Spalte ein, `kpi_tree`
    // leitet den Ist aus den verknüpften Epic-KPIs ab (Δ×Faktor auf die
    // Ziel-Skala; Legacy `auto_kpi` wird via effectiveProgressMode gemappt).
    // `current` selbst bleibt unberührt (Wert-Pflege läuft über
    // recordGoalProgress bzw. KPIs). Ein `kpi_tree`-Ast ohne KPI-Links liefert
    // `null` (kein Freeze) — sein Wert kommt aus der Kinder-Kaskade.
    const mode = effectiveProgressMode(existing.progressMode, false);
    let rawValue: number | null;
    if (mode === "kpi_tree") {
      const links = await tx.goalEpicLink.findMany({
        where: { tenantId: mctx.tenantId, objectiveId: input.id, epic: { deletedAt: null } },
        select: {
          conversionFactor: true,
          kpi: { select: { baseline: true, target: true, measurements: true } },
          epic: {
            select: {
              kpis: { select: { unit: true, baseline: true, target: true, measurements: true } },
            },
          },
        },
      });
      // Faktor bevorzugt (KPI-Δ × Faktor), sonst einheiten-gleiches KPI-Δ;
      // `autoKpiCurrent` rechnet daraus den absoluten Ist auf der Ziel-Skala.
      const autoLinks: AutoKpiLink[] = links.map((l) =>
        l.kpi && l.conversionFactor != null
          ? {
              kind: "factor" as const,
              kpi: {
                baseline: toFloat(l.kpi.baseline),
                target: toFloat(l.kpi.target),
                current: latestMeasurement(l.kpi.measurements),
              },
              factor: Number(l.conversionFactor),
            }
          : {
              kind: "sameUnit" as const,
              kpis: l.epic.kpis.map((k) => ({
                unit: k.unit,
                point: {
                  baseline: toFloat(k.baseline),
                  target: toFloat(k.target),
                  current: latestMeasurement(k.measurements),
                },
              })),
            },
      );
      rawValue = autoKpiCurrent(
        {
          metricUnit: existing.metricUnit,
          metricType: existing.metricType,
          currencyCode: existing.currencyCode,
          baseline: toFloat(existing.baseline),
          target: toFloat(existing.target),
        },
        autoLinks,
      );
    } else {
      // manual: ein mitgelieferter neuer Wert gewinnt, sonst der bestehende Ist.
      rawValue =
        input.value != null
          ? input.value
          : existing.current != null
            ? Number(existing.current)
            : null;
    }
    const frozenProgress =
      rawValue != null
        ? normalizeKrValue(rawValue, existing.baseline, existing.target)
        : (input.progress ?? null);
    const checkin = await upsertDayCheckin(tx, {
      tenantId: mctx.tenantId,
      objectiveId: input.id,
      day: dayStart(input.entryDate ?? new Date()),
      createdBy: mctx.actorId,
      status: input.status,
      value: rawValue,
      progress: frozenProgress,
      note: input.note ?? null,
      sections: input.sections ?? null,
    });
    // Bei direkt gepflegtem Wert `current` mitziehen (letzter Check-in gewinnt),
    // damit ein Status-Update mit neuem Wert den Ist aktualisiert.
    const manualValueUpdate = acceptsDirectValue(mode) && input.value != null;
    await tx.objective.update({
      where: { id: input.id },
      data: {
        status: input.status,
        closedAt: isClosed(input.status) ? (existing.closedAt ?? new Date()) : null,
        ...(manualValueUpdate
          ? { current: await latestCheckinCurrent(tx, mctx.tenantId, input.id, input.value!) }
          : {}),
        updatedBy: mctx.actorId,
      },
    });
    return ok({
      result: { id: checkin.id },
      audit: {
        action: "goal.checkin",
        resourceType: "key_result",
        resourceId: input.id,
        changes: { status: { before: existing.status, after: input.status } },
      },
    });
  });
}

export interface RecordGoalProgressInput {
  keyResultId: string;
  /** Raw current value in the KR's metric (e.g. `2` of target 4). */
  value: number;
  /** Gewähltes Datum des Wert-Eintrags (setzt den neutralen Graf-Punkt); Default now. */
  entryDate?: Date | null;
}

/**
 * Setzt den Ist-Wert eines MANUELLEN Ziels (Asana „Update progress") und legt
 * einen **statuslosen** Check-in am gewählten Datum an — ein **neutraler**
 * Graf-Punkt (kein Status-Punkt). `objective.current` wird mitgestempelt.
 * Auto-/Rollup-Ziele sind abgelehnt — ihr Ist-Wert kommt aus KPIs/Unterzielen.
 */
export async function recordGoalProgress(
  ctx: RequestContext,
  input: RecordGoalProgressInput,
): Promise<Result<{ id: string }>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    const existing = await tx.objective.findFirst({
      where: { id: input.keyResultId, tenantId: mctx.tenantId },
    });
    if (!existing) {
      return err({ kind: "not_found" as const, resourceType: "KeyResult", id: input.keyResultId });
    }
    // Ist-Wert direkt pflegbar nur bei den Quellen, die ihn selbst tragen
    // (`manual`, `confidence`) — kpi_tree kommt aus KPIs, rollup aus den
    // Unterzielen.
    const childCount = await tx.objective.count({
      where: { parentObjectiveId: input.keyResultId, tenantId: mctx.tenantId },
    });
    const mode = effectiveProgressMode(existing.progressMode, childCount > 0);
    if (!acceptsDirectValue(mode)) {
      return err({
        kind: "validation" as const,
        issues: [
          "Ist-Wert wird aus KPIs bzw. Unterzielen abgeleitet — nur manuelle Ziele sind direkt pflegbar.",
        ],
      });
    }
    // Die Faust-zu-Fünf kennt fünf Stufen und keine Zwischenwerte. Der Guard
    // steht hier und nicht nur im Zod-Schema, weil die Skala eine fachliche
    // Aussage ist: eine 2,5 gibt es an einer Hand nicht.
    if (mode === "confidence" && !isConfidenceValue(input.value)) {
      return err({
        kind: "validation" as const,
        issues: [
          `Zuversicht ist eine Stufe von ${CONFIDENCE_MIN} bis ${CONFIDENCE_MAX} — „${input.value}" ist keine.`,
        ],
      });
    }
    const checkin = await upsertDayCheckin(tx, {
      tenantId: mctx.tenantId,
      objectiveId: input.keyResultId,
      day: dayStart(input.entryDate ?? new Date()),
      createdBy: mctx.actorId,
      // Status, Notiz und Sektionen bleiben **ungenannt** und damit unberührt:
      // ein nachgetragener Wert widerruft keine Aussage. Vorher stand hier
      // dreimal `null`, und das Status-Update desselben Tages war weg.
      value: input.value,
      progress: normalizeKrValue(input.value, existing.baseline, existing.target),
    });
    // `current` folgt dem zeitlich letzten Wert-Check-in (s. `latestCheckinCurrent`).
    const newCurrent = await latestCheckinCurrent(
      tx,
      mctx.tenantId,
      input.keyResultId,
      input.value,
    );
    await tx.objective.update({
      where: { id: input.keyResultId },
      data: { current: newCurrent, updatedBy: mctx.actorId },
    });
    return ok({
      result: { id: checkin.id },
      audit: {
        action: "goal.progress.updated",
        resourceType: "key_result",
        resourceId: input.keyResultId,
        changes: {
          current: {
            before: existing.current != null ? Number(existing.current) : null,
            after: newCurrent,
          },
        },
      },
    });
  });
}

/** Normalised 0..1 progress for a raw KR value; null when the span is unknown. */
/** Prisma-Decimal → number (null-durchreichend), lokal wie in den View-Loadern. */
function toFloat(d: unknown): number | null {
  return d == null ? null : Number(d);
}

function normalizeKrValue(value: number | null, baseline: unknown, target: unknown): number | null {
  if (value == null) return null;
  const b = baseline != null ? Number(baseline) : null;
  const t = target != null ? Number(target) : null;
  if (b == null || t == null || t === b) return null;
  return Math.max(0, Math.min(1, (value - b) / (t - b)));
}

export interface AddGoalCommentInput {
  target: GoalTarget;
  id: string;
  body: string;
}

/** Appends a free-text comment to a goal's activity feed. */
export async function addGoalComment(
  ctx: RequestContext,
  input: AddGoalCommentInput,
): Promise<Result<{ id: string }>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    // Jeder Ziel-Knoten ist ein Objective; Kommentare hängen an objectiveId.
    const owner = await tx.objective.findFirst({
      where: { id: input.id, tenantId: mctx.tenantId },
    });
    if (!owner) {
      return err({ kind: "not_found" as const, resourceType: "Objective", id: input.id });
    }
    const comment = await tx.goalComment.create({
      data: {
        tenantId: mctx.tenantId,
        objectiveId: input.id,
        body: input.body,
        createdBy: mctx.actorId,
      },
    });
    return ok({
      result: { id: comment.id },
      audit: {
        action: "goal.comment.added",
        resourceType: input.target === "objective" ? "objective" : "key_result",
        resourceId: input.id,
      },
    });
  });
}

// ── Verlaufseinträge bearbeiten und entfernen ───────────────────────────

/**
 * Bearbeiten und Löschen im Ziel-Verlauf.
 *
 * Die Berechtigung hat zwei Stufen, und die **maßgebliche ist hier**, nicht in
 * der Action: `target.manage` ist der grobe Vorfilter, aber wer einen Eintrag
 * anfassen darf, entscheidet sich an der Zeile selbst — der Verfasser darf
 * beides, die Ziel-Pflege nur löschen (`goalEntryEditDeniedReason`).
 *
 * Dasselbe Idiom wie bei den Gate-Abnahmen: **die Zeile ist die Berechtigung.**
 */

export interface EditGoalCheckinInput {
  id: string;
  /** Der Handelnde hält `target.manage` (aus der Action gereicht). */
  mayManage: boolean;
  status?: string | null;
  value?: number | null;
  sections?: GoalSection[] | null;
}

/**
 * Ändert einen Check-in **an Ort und Stelle**. Das Datum bleibt unberührt: der
 * Slot ist nach Tag verschlüsselt, ein Umdatieren liefe auf einen womöglich
 * belegten Tag. Wer das Datum ändern will, löscht und schreibt neu.
 */
export async function updateGoalCheckin(
  ctx: RequestContext,
  input: EditGoalCheckinInput,
): Promise<Result<{ id: string }>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    const row = await tx.goalCheckin.findFirst({
      where: { id: input.id, tenantId: mctx.tenantId },
    });
    if (!row) {
      return err({ kind: "not_found" as const, resourceType: "GoalCheckin", id: input.id });
    }
    const denied = goalEntryEditDeniedReason({
      authorId: row.createdBy,
      actorId: mctx.actorId,
      mayManage: input.mayManage,
    });
    if (denied) return err({ kind: "validation" as const, issues: [denied] });

    // `objectiveId` ist nullable (Altlast der Knoten-Vereinheitlichung); eine
    // verwaiste Zeile gehört zu keinem Ziel und ist hier nicht erreichbar.
    const objective = row.objectiveId
      ? await tx.objective.findFirst({ where: { id: row.objectiveId, tenantId: mctx.tenantId } })
      : null;
    if (!objective) {
      return err({ kind: "not_found" as const, resourceType: "Objective", id: input.id });
    }
    const patch: CheckinPatch = {};
    if (input.status !== undefined) patch.status = input.status;
    if (input.sections !== undefined) patch.sections = input.sections;
    if (input.value !== undefined) {
      patch.value = input.value;
      patch.progress = normalizeKrValue(input.value, objective.baseline, objective.target);
    }
    const slot = mergeCheckinSlot(rowToSlot(row), patch);
    await tx.goalCheckin.update({ where: { id: row.id }, data: slotToData(slot) });

    // Der Ist-Wert des Ziels folgt dem zeitlich letzten Wert-Check-in. Wurde an
    // einem Wert gedreht, muss er neu bestimmt werden — sonst zeigt das Ziel
    // eine Zahl, die keine Zeile mehr trägt.
    if (
      input.value !== undefined &&
      acceptsDirectValue(await progressModeOf(tx, mctx.tenantId, objective))
    ) {
      await tx.objective.update({
        where: { id: objective.id },
        data: {
          current: await latestCheckinCurrent(tx, mctx.tenantId, objective.id, 0),
          updatedBy: mctx.actorId,
        },
      });
    }
    return ok({
      result: { id: row.id },
      audit: {
        action: "goal.checkin.edited",
        resourceType: "objective",
        resourceId: objective.id,
        changes: { status: { before: row.status, after: slot.status } },
      },
    });
  });
}

export interface DeleteGoalEntryInput {
  id: string;
  /** Der Handelnde hält `target.manage` (aus der Action gereicht). */
  mayManage: boolean;
}

/** Entfernt einen Check-in aus dem Verlauf und zieht `current` nach. */
export async function deleteGoalCheckin(
  ctx: RequestContext,
  input: DeleteGoalEntryInput,
): Promise<Result<{ id: string }>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    const row = await tx.goalCheckin.findFirst({
      where: { id: input.id, tenantId: mctx.tenantId },
    });
    if (!row) {
      return err({ kind: "not_found" as const, resourceType: "GoalCheckin", id: input.id });
    }
    const denied = goalEntryDeleteDeniedReason({
      authorId: row.createdBy,
      actorId: mctx.actorId,
      mayManage: input.mayManage,
    });
    if (denied) return err({ kind: "validation" as const, issues: [denied] });

    await tx.goalCheckin.delete({ where: { id: row.id } });

    const objective = row.objectiveId
      ? await tx.objective.findFirst({ where: { id: row.objectiveId, tenantId: mctx.tenantId } })
      : null;
    // Trug die entfernte Zeile einen Wert, fällt `current` auf den vorherigen
    // Wert-Check-in zurück — `0` nur, wenn es gar keinen mehr gibt.
    if (
      objective &&
      row.value != null &&
      acceptsDirectValue(await progressModeOf(tx, mctx.tenantId, objective))
    ) {
      await tx.objective.update({
        where: { id: objective.id },
        data: {
          current: await latestCheckinCurrent(tx, mctx.tenantId, objective.id, 0),
          updatedBy: mctx.actorId,
        },
      });
    }
    return ok({
      result: { id: row.id },
      audit: {
        action: "goal.checkin.deleted",
        resourceType: "objective",
        resourceId: row.objectiveId ?? row.id,
      },
    });
  });
}

export interface EditGoalCommentInput {
  id: string;
  body: string;
  /** Der Handelnde hält `target.manage` (aus der Action gereicht). */
  mayManage: boolean;
}

/** Ändert den Text eines freien Kommentars. Nur der Verfasser. */
export async function updateGoalComment(
  ctx: RequestContext,
  input: EditGoalCommentInput,
): Promise<Result<{ id: string }>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    const row = await tx.goalComment.findFirst({
      where: { id: input.id, tenantId: mctx.tenantId },
    });
    if (!row) {
      return err({ kind: "not_found" as const, resourceType: "GoalComment", id: input.id });
    }
    const denied = goalEntryEditDeniedReason({
      authorId: row.createdBy,
      actorId: mctx.actorId,
      mayManage: input.mayManage,
    });
    if (denied) return err({ kind: "validation" as const, issues: [denied] });

    await tx.goalComment.update({ where: { id: row.id }, data: { body: input.body } });
    return ok({
      result: { id: row.id },
      audit: {
        action: "goal.comment.edited",
        resourceType: "objective",
        resourceId: row.objectiveId ?? row.id,
      },
    });
  });
}

/** Entfernt einen freien Kommentar aus dem Verlauf. */
export async function deleteGoalComment(
  ctx: RequestContext,
  input: DeleteGoalEntryInput,
): Promise<Result<{ id: string }>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    const row = await tx.goalComment.findFirst({
      where: { id: input.id, tenantId: mctx.tenantId },
    });
    if (!row) {
      return err({ kind: "not_found" as const, resourceType: "GoalComment", id: input.id });
    }
    const denied = goalEntryDeleteDeniedReason({
      authorId: row.createdBy,
      actorId: mctx.actorId,
      mayManage: input.mayManage,
    });
    if (denied) return err({ kind: "validation" as const, issues: [denied] });

    await tx.goalComment.delete({ where: { id: row.id } });
    return ok({
      result: { id: row.id },
      audit: {
        action: "goal.comment.deleted",
        resourceType: "objective",
        resourceId: row.objectiveId ?? row.id,
      },
    });
  });
}

/**
 * Die wirksame Fortschrittsquelle eines Knotens — `rollup`, sobald er Kinder
 * hat. Nur `manual`/`confidence` tragen `current` selbst; bei den anderen wäre
 * ein Nachziehen falsch, ihr Ist kommt aus KPIs bzw. der Kaskade.
 */
async function progressModeOf(
  tx: Prisma.TransactionClient,
  tenantId: string,
  objective: { id: string; progressMode: string | null },
): Promise<ReturnType<typeof effectiveProgressMode>> {
  const childCount = await tx.objective.count({
    where: { parentObjectiveId: objective.id, tenantId },
  });
  return effectiveProgressMode(objective.progressMode, childCount > 0);
}

// ── Goal picker (read) ──────────────────────────────────────────────────

/** Ein Ziel-Knoten für den Verbinden-/Eltern-Picker. */
export interface GoalPickerOption {
  id: string;
  /** Titel (als `name` für EntitySelect). */
  name: string;
  /** Eltern-Knoten (null = Top-Level) — für Baum-Darstellung im Picker. */
  parentObjectiveId: string | null;
  nodeKind: string;
  period: string | null;
  status: string | null;
}

/**
 * Tenant-scoped Ziel-Suche für den Drawer-Picker („Bestehendes Ziel verbinden",
 * Elternziel setzen). `q` filtert per Titel (case-insensitive). `excludeSubtreeOf`
 * blendet den Knoten **selbst + alle Nachfahren** aus (Zyklus-Guard fürs Umhängen,
 * via materialisiertem `path`-Präfix).
 */
export async function listGoalsForPicker(
  db: PrismaClient,
  tenantId: string,
  opts: { q?: string; excludeSubtreeOf?: string } = {},
): Promise<GoalPickerOption[]> {
  let excludePath: string | null = null;
  if (opts.excludeSubtreeOf) {
    const n = await db.objective.findFirst({
      where: { id: opts.excludeSubtreeOf, tenantId },
      select: { path: true },
    });
    excludePath = n?.path ?? null;
  }
  const rows = await db.objective.findMany({
    where: {
      tenantId,
      ...(opts.q ? { title: { contains: opts.q, mode: "insensitive" } } : {}),
      ...(opts.excludeSubtreeOf
        ? {
            AND: [
              { id: { not: opts.excludeSubtreeOf } },
              ...(excludePath ? [{ NOT: { path: { startsWith: `${excludePath}/` } } }] : []),
            ],
          }
        : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    // Baum-Picker braucht den vollen Satz (sonst verwaisen Kinder jenseits des Caps).
    take: 500,
    select: {
      id: true,
      title: true,
      parentObjectiveId: true,
      nodeKind: true,
      period: true,
      status: true,
    },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.title,
    parentObjectiveId: r.parentObjectiveId,
    nodeKind: r.nodeKind,
    period: r.period,
    status: r.status,
  }));
}

// ── Related-work-Suche (Epics + Features + PIs, ein Feld) ────────────────

/** Ein „Related work"-Treffer: Epic (€-tragend), Feature oder PI. */
export interface RelatedWorkOption {
  id: string;
  type: "epic" | "feature" | "pi";
  /** Titel (als `name` für die Anzeige). */
  name: string;
}

/**
 * Tenant-scoped Volltextsuche über Epics + Features (Initiatives) + PIs für das
 * vereinheitlichte „Related work"-Suchfeld im Drawer. `type` diskriminiert, welche
 * Verknüpfungs-Action der Client aufruft (Epic → GoalEpicLink, Feature/PI →
 * GoalRelatedWork). Ohne `q` die ersten Treffer je Kategorie (Cap).
 */
export async function searchRelatedWork(
  db: PrismaClient,
  tenantId: string,
  q: string,
): Promise<RelatedWorkOption[]> {
  const [inis, pis] = await Promise.all([
    db.initiative.findMany({
      where: {
        tenantId,
        deletedAt: null,
        level: { in: [InitiativeLevel.EPIC, InitiativeLevel.FEATURE] },
        ...(q ? { title: { contains: q, mode: "insensitive" as const } } : {}),
      },
      select: { id: true, title: true, level: true },
      orderBy: { title: "asc" },
      take: 40,
    }),
    db.programIncrement.findMany({
      where: { tenantId, ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}) },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 20,
    }),
  ]);
  const out: RelatedWorkOption[] = [];
  for (const i of inis) {
    out.push({
      id: i.id,
      type: i.level === InitiativeLevel.EPIC ? "epic" : "feature",
      name: i.title,
    });
  }
  for (const p of pis) out.push({ id: p.id, type: "pi", name: p.name });
  return out;
}
