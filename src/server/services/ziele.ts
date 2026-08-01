import { Prisma, type PrismaClient } from "@/generated/prisma";
import type { Result } from "@/domain/errors";
import { ok, err } from "@/domain/errors";
import type { RequestContext } from "@/server/http/mutation-handler";
import { withAuditedTransaction, toMutationContext } from "@/server/services/mutation";
import {
  goalRecordedUpdate,
  OBJECTIVE_FIELD_KEYS,
  KEY_RESULT_FIELD_KEYS,
} from "@/server/services/goal-node-fields";
import { isClosed, isOpen, type GoalStatus } from "@/domain/goal-status";
import { clampPrecision, type MetricType } from "@/domain/goal-metric";
import { canReparent, planReparent } from "@/domain/goal-reparent";
import { autoKpiCurrent, isProgressMode, effectiveProgressMode } from "@/domain/goal-progress-mode";
import { latestMeasurement } from "@/domain/kpi-measurement";
import { dayStart } from "@/domain/calendar";
import { InitiativeLevel } from "@/domain/types";

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
  ownerId?: string | null;
  // Optionaler Metrik-Block (jeder Knoten kann messbar sein).
  metricName?: string | null;
  metricUnit?: string | null;
  metricType?: MetricType;
  precision?: number;
  currencyCode?: string | null;
  rollupWeight?: number | null;
  baseline?: number | null;
  target?: number | null;
  current?: number | null;
  formula?: "auto_from_kpi" | "manual";
  /** Fortschrittsquelle (manual | rollup | auto_kpi); null/undef ⇒ abgeleitet. */
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
        ownerId: input.ownerId ?? null,
        metricName: input.metricName ?? null,
        metricUnit: input.metricUnit ?? null,
        ...(input.metricType ? { metricType: input.metricType } : {}),
        ...(input.precision != null ? { precision: clampPrecision(input.precision) } : {}),
        currencyCode: input.currencyCode ?? null,
        rollupWeight: input.rollupWeight ?? null,
        baseline: input.baseline ?? null,
        target: input.target ?? null,
        current: input.current ?? null,
        ...(input.formula ? { formula: input.formula } : {}),
        progressMode: input.progressMode ?? null,
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
  status?: GoalStatus | null;
  dueDate?: Date | null;
  closingNote?: string | null;
  ownerId?: string | null;
  // Optionaler Metrik-Block + Fortschrittsquelle (jeder Knoten kann messbar sein).
  metricName?: string | null;
  metricUnit?: string | null;
  metricType?: MetricType;
  precision?: number;
  currencyCode?: string | null;
  rollupWeight?: number | null;
  includeInParentRollup?: boolean;
  baseline?: number | null;
  target?: number | null;
  current?: number | null;
  formula?: "auto_from_kpi" | "manual";
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
    const { changes, data } = goalRecordedUpdate(existing, input, OBJECTIVE_FIELD_KEYS);
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
  input: { id: string; newParentId?: string | null },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const newParentId = input.newParentId ?? null;
  return withAuditedTransaction(mctx, async (tx) => {
    const node = await tx.objective.findFirst({
      where: { id: input.id, tenantId: mctx.tenantId },
    });
    if (!node) {
      return err({ kind: "not_found" as const, resourceType: "Objective", id: input.id });
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

    // Kein-Op, wenn schon am Ziel-Parent.
    if ((node.parentObjectiveId ?? null) === newParentId) {
      return ok({
        result: undefined,
        audit: { action: "objective.updated", resourceType: "objective", resourceId: node.id },
      });
    }

    const subtree = await tx.objective.findMany({
      where: {
        tenantId: mctx.tenantId,
        OR: [{ id: node.id }, { path: { startsWith: `${node.path}/` } }],
      },
      select: { id: true, path: true, level: true },
    });
    // Reine Subtree-Re-Materialisierung (goal-reparent.ts) — der Service persistiert nur.
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

    return ok({
      result: undefined,
      audit: {
        action: "objective.updated",
        resourceType: "objective",
        resourceId: node.id,
        changes: {
          parentObjectiveId: { before: node.parentObjectiveId, after: newParentId },
        },
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
  baseline?: number | null;
  target?: number | null;
  current?: number | null;
  period?: string | null;
  formula?: "auto_from_kpi" | "manual";
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
        baseline: input.baseline ?? null,
        target: input.target ?? null,
        current: input.current ?? null,
        period: input.period ?? null,
        formula: input.formula ?? "auto_from_kpi",
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
  baseline?: number | null;
  target?: number | null;
  current?: number | null;
  period?: string | null;
  formula?: "auto_from_kpi" | "manual";
  status?: GoalStatus | null;
  dueDate?: Date | null;
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

/** One block of a structured status update (Asana-style composer). */
export interface GoalSection {
  title: string;
  body: string;
}

export interface CheckInGoalInput {
  target: GoalTarget;
  id: string;
  status: GoalStatus;
  /** Optional progress snapshot (0..1 rollup or raw KR value). */
  progress?: number | null;
  note?: string | null;
  /** Structured update sections (Epic 4); backward-compatible with `note`. */
  sections?: GoalSection[] | null;
  /** Gewähltes Datum des Status-Updates (setzt den Graf-Punkt); Default now. */
  entryDate?: Date | null;
}

/**
 * Ein Check-in **pro Tag**: überschreibt den bestehenden Check-in des Knotens an
 * diesem Tag (`day` = UTC-Mitternacht) vollständig — sonst neu anlegen. „Letzter
 * Eintrag des Tages gewinnt" (Wert-Eintrag und Status-Update teilen den Slot).
 */
async function upsertDayCheckin(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    objectiveId: string;
    day: Date;
    createdBy: string;
    status: string | null;
    value: number | null;
    progress: number | null;
    note?: string | null;
    sections?: GoalSection[] | null;
  },
): Promise<{ id: string }> {
  const next = new Date(input.day);
  next.setUTCDate(next.getUTCDate() + 1);
  const existing = await tx.goalCheckin.findFirst({
    where: {
      tenantId: input.tenantId,
      objectiveId: input.objectiveId,
      createdAt: { gte: input.day, lt: next },
    },
    select: { id: true },
    orderBy: { createdAt: "desc" },
  });
  const data = {
    status: input.status,
    value: input.value,
    progress: input.progress,
    note: input.note ?? null,
    sections:
      input.sections && input.sections.length > 0
        ? (input.sections as unknown as Prisma.InputJsonValue)
        : Prisma.DbNull,
    createdAt: input.day,
  };
  if (existing) {
    await tx.goalCheckin.update({ where: { id: existing.id }, data });
    return { id: existing.id };
  }
  const created = await tx.goalCheckin.create({
    data: {
      tenantId: input.tenantId,
      objectiveId: input.objectiveId,
      createdBy: input.createdBy,
      ...data,
    },
  });
  return { id: created.id };
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
    // Datum): `manual` friert die eigene `current`-Spalte ein, `auto_kpi` leitet
    // die einheitengleiche Summe der verknüpften Epic-KPIs ab. `current` selbst
    // bleibt unberührt (Wert-Pflege läuft über recordGoalProgress bzw. KPIs).
    const mode = isProgressMode(existing.progressMode) ? existing.progressMode : "manual";
    let rawValue: number | null;
    if (mode === "auto_kpi") {
      const links = await tx.goalEpicLink.findMany({
        where: { tenantId: mctx.tenantId, objectiveId: input.id, epic: { deletedAt: null } },
        select: { epic: { select: { kpis: { select: { unit: true, measurements: true } } } } },
      });
      const kpis = links.flatMap((l) =>
        l.epic.kpis.map((k) => ({ unit: k.unit, current: latestMeasurement(k.measurements) })),
      );
      rawValue = autoKpiCurrent(
        {
          metricUnit: existing.metricUnit,
          metricType: existing.metricType,
          currencyCode: existing.currencyCode,
        },
        kpis,
      );
    } else {
      rawValue = existing.current != null ? Number(existing.current) : null;
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
    await tx.objective.update({
      where: { id: input.id },
      data: { status: input.status, updatedBy: mctx.actorId },
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
    // Ist-Wert direkt pflegbar nur bei manueller Fortschrittsquelle — auto_kpi
    // kommt aus KPIs, rollup aus den Unterzielen.
    const childCount = await tx.objective.count({
      where: { parentObjectiveId: input.keyResultId, tenantId: mctx.tenantId },
    });
    const mode = effectiveProgressMode(existing.progressMode, childCount > 0);
    if (mode !== "manual") {
      return err({
        kind: "validation" as const,
        issues: [
          "Ist-Wert wird aus KPIs bzw. Unterzielen abgeleitet — nur manuelle Ziele sind direkt pflegbar.",
        ],
      });
    }
    const checkin = await upsertDayCheckin(tx, {
      tenantId: mctx.tenantId,
      objectiveId: input.keyResultId,
      day: dayStart(input.entryDate ?? new Date()),
      createdBy: mctx.actorId,
      status: null,
      value: input.value,
      progress: normalizeKrValue(input.value, existing.baseline, existing.target),
      note: null,
      sections: null,
    });
    await tx.objective.update({
      where: { id: input.keyResultId },
      data: { current: input.value, updatedBy: mctx.actorId },
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
            after: input.value,
          },
        },
      },
    });
  });
}

/** Normalised 0..1 progress for a raw KR value; null when the span is unknown. */
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

// ── Goal picker (read) ──────────────────────────────────────────────────

/** Ein Ziel-Knoten für den Verbinden-/Eltern-Picker. */
export interface GoalPickerOption {
  id: string;
  /** Titel (als `name` für EntitySelect). */
  name: string;
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
    take: 50,
    select: { id: true, title: true, nodeKind: true, period: true, status: true },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.title,
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
