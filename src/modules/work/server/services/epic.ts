import type { Prisma } from "@/generated/prisma";
import type { PrismaClient } from "@/generated/prisma";
import type {
  TenantId,
  EpicId,
  ValueStreamId,
  StageGate,
} from "@/modules/core/kernel/domain/types";
import { InitiativeLevel } from "@/modules/core/kernel/domain/types";
import type { Result } from "@/modules/core/kernel/domain/errors";
import { ok, err, isErr } from "@/modules/core/kernel/domain/errors";
import { recordedUpdate } from "@/modules/core/kernel/server/recorded-update";
import type { EpicType, Horizon } from "@/modules/work/domain/portfolio-guardrails";
import type { RequestContext } from "@/server/http/mutation-handler";
import { withAuditedTransaction, toMutationContext } from "@/modules/core/kernel/server/mutation";
import { createInitiativeWithDerivedPath } from "@/modules/core/kernel/server/initiative-write";
import {
  signalGateTrigger,
  confirmProposedAdvance,
  advanceGateManually,
} from "@/modules/work/server/services/stage-gate-engine";
import { loadAuthorizedEpic } from "@/modules/work/server/services/epic-access";
import { appendVersion } from "@/modules/work/domain/versioned-document";
import { effectivePractices } from "@/modules/core/kernel/domain/operating-model";
import {
  parseBenefitHypothesis,
  benefitHypothesisHasContent,
  type BenefitHypothesisFields,
  type BenefitHypothesis,
} from "@/modules/work/domain/benefit-hypothesis";
import {
  parseBusinessCase,
  businessCaseHasContent,
  type BusinessCaseFields,
  type BusinessCase,
} from "@/modules/work/domain/business-case";
import type { TimelineFields } from "@/modules/work/domain/timeline";

// ---------------------------------------------------------------------------
// Create Epic (level 0)
// ---------------------------------------------------------------------------

export interface CreateEpicInput {
  title: string;
  description?: string | undefined;
  valueStreamId: ValueStreamId;
}

export async function createEpic(
  ctx: RequestContext,
  input: CreateEpicInput,
): Promise<Result<{ id: EpicId }>> {
  const mctx = toMutationContext(ctx);
  const { title, description, valueStreamId } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    // Verify the value stream belongs to the same tenant (cross-tenant guard).
    const vs = await tx.valueStream.findFirst({
      where: { id: valueStreamId, tenantId: mctx.tenantId },
    });
    if (!vs) {
      return err({ kind: "not_found" as const, resourceType: "ValueStream", id: valueStreamId });
    }

    const epic = await createInitiativeWithDerivedPath(tx, {
      data: {
        tenantId: mctx.tenantId,
        level: InitiativeLevel.EPIC,
        title,
        // Epics start without an owner — the Portfolio Manager (or a superior role) nominates
        // one during detailing, which is what advances the Epic out of the Funnel.
        ownerId: null,
        assigneeIds: [],
        createdBy: mctx.actorId,
        updatedBy: mctx.actorId,
        valueStreamId,
        approvalPhase: "draft",
        ...(description !== undefined && { description }),
      },
    });

    return ok({
      result: { id: epic.id as EpicId },
      audit: { action: "initiative.created", resourceType: "initiative", resourceId: epic.id },
    });
  });
}

// ---------------------------------------------------------------------------
// Update Epic
// ---------------------------------------------------------------------------

export interface UpdateEpicInput {
  id: EpicId;
  title?: string | undefined;
  description?: string | undefined;
  needsSteeringAttention?: boolean | undefined;
  stagedForBudgeting?: boolean | undefined;
  /** Planned delivery window ("Soll"). `null` clears, `undefined` leaves unchanged. */
  plannedStartAt?: Date | null | undefined;
  plannedEndAt?: Date | null | undefined;
  /** SAFe Portfolio Guardrails. `null` cleart, `undefined` belaesst. */
  epicType?: EpicType | null | undefined;
  investmentHorizon?: Horizon | null | undefined;
}

export async function updateEpic(
  ctx: RequestContext,
  input: UpdateEpicInput,
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const {
    id,
    title,
    description,
    needsSteeringAttention,
    stagedForBudgeting,
    plannedStartAt,
    plannedEndAt,
    epicType,
    investmentHorizon,
  } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const loaded = await loadAuthorizedEpic(tx, ctx.principal, mctx, {
      id,
      action: "epic.update",
      select: {
        title: true,
        description: true,
        needsSteeringAttention: true,
        stagedForBudgeting: true,
        plannedStartAt: true,
        plannedEndAt: true,
        epicType: true,
        investmentHorizon: true,
      },
    });
    if (isErr(loaded)) return loaded;
    const existing = loaded.value;

    // Effective post-update endpoints — used for the start ≤ end check so the
    // validation is correct when only one column is being touched.
    const nextStart = plannedStartAt === undefined ? existing.plannedStartAt : plannedStartAt;
    const nextEnd = plannedEndAt === undefined ? existing.plannedEndAt : plannedEndAt;
    if (nextStart && nextEnd && nextStart > nextEnd) {
      return err({
        kind: "conflict" as const,
        reason: "Endedatum des geplanten Zeitfensters liegt vor dem Startdatum",
      });
    }

    const { changes, data } = recordedUpdate({
      existing,
      updates: {
        title,
        description,
        needsSteeringAttention,
        stagedForBudgeting,
        plannedStartAt,
        plannedEndAt,
        epicType,
        investmentHorizon,
      },
      fields: [
        "title",
        "description",
        "needsSteeringAttention",
        "stagedForBudgeting",
        "plannedStartAt",
        "plannedEndAt",
        "epicType",
        "investmentHorizon",
      ] as const,
    });

    await tx.initiative.update({
      where: { id },
      data: { ...data, updatedBy: mctx.actorId },
    });

    return ok({
      result: undefined,
      audit: { action: "initiative.updated", resourceType: "initiative", resourceId: id, changes },
    });
  });
}

// ---------------------------------------------------------------------------
// Advance stage gate
// ---------------------------------------------------------------------------

export interface AdvanceStageGateInput {
  epicId: EpicId;
  toGate: StageGate;
  comment?: string | undefined;
}

/**
 * Advances (or steps back) an Epic's stage gate. Reaching L3 is the approval
 * decision — the approver, timestamp, and comment are persisted on the Epic so
 * they are visible without reading the audit log.
 */
export async function advanceStageGate(
  ctx: RequestContext,
  input: AdvanceStageGateInput,
): Promise<Result<{ from: StageGate; to: StageGate }>> {
  const mctx = toMutationContext(ctx);
  const { epicId, toGate, comment } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    // Stage gates only exist when the target operating model enables them. With
    // them switched off the portfolio shows a flat epic list and exposes no
    // "advance" affordance — reject any request that reaches the action anyway.
    const targetModel = await tx.targetOperatingModel.findFirst({
      where: { tenantId: mctx.tenantId, status: "active" },
      orderBy: { updatedAt: "desc" },
    });
    const practices = effectivePractices(targetModel);
    if (!practices.stageGates) {
      return err({
        kind: "forbidden" as const,
        reason: "Stage gates are not part of this tenant's target operating model",
      });
    }

    // Scope-aware seam check (ADR-0002): authorize against the loaded Epic
    // before the engine mutates it, so no `epic.approve` grant is satisfied
    // vacuously by an attacker-controlled id.
    const loaded = await loadAuthorizedEpic(tx, ctx.principal, mctx, {
      id: epicId,
      action: "epic.approve",
      select: { id: true },
    });
    if (isErr(loaded)) return loaded;

    // The manual move — transition validity, the blocked-auto-advance list and
    // the forward-precondition guards, plus the stamps + `stage_gate.advanced`
    // audit — all live in the pure engine + its adapter now.
    const moved = await advanceGateManually(tx, mctx, epicId, toGate, comment);
    if (isErr(moved)) return moved;

    return ok({
      result: moved.value,
      // `advanceGateManually` runs the engine with `emitAudit: false`, so this
      // withAuditedTransaction owns the single `stage_gate.advanced` row.
      audit: {
        action: "initiative.stage_gate.advanced" as const,
        resourceType: "initiative" as const,
        resourceId: epicId,
        changes: {
          stageGate: { before: moved.value.from, after: moved.value.to },
          ...(comment !== undefined && { comment: { before: null, after: comment } }),
        },
      },
    });
  });
}

/**
 * Owner confirms a persisted gate proposal (`proposedStageGate`), advancing the
 * Epic one gate. Reuses the same portfolio-scoped `epic.approve` capability as
 * the manual {@link advanceStageGate}; the engine re-validates the proposal
 * against the current state and emits the `stage_gate.advanced` audit.
 */
export async function confirmProposedStageGate(
  ctx: RequestContext,
  input: { epicId: EpicId },
): Promise<Result<{ from: StageGate; to: StageGate }>> {
  const mctx = toMutationContext(ctx);
  const { epicId } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const loaded = await loadAuthorizedEpic(tx, ctx.principal, mctx, {
      id: epicId,
      action: "epic.approve",
      select: { id: true },
    });
    if (isErr(loaded)) return loaded;

    const confirmed = await confirmProposedAdvance(tx, mctx, epicId);
    if (isErr(confirmed)) return confirmed;

    return ok({
      result: confirmed.value,
      // `confirmProposedAdvance` runs the engine with `emitAudit: false`, so this
      // withAuditedTransaction owns the single `stage_gate.advanced` row.
      audit: {
        action: "initiative.stage_gate.advanced" as const,
        resourceType: "initiative" as const,
        resourceId: epicId,
        changes: { stageGate: { before: confirmed.value.from, after: confirmed.value.to } },
      },
    });
  });
}

// ---------------------------------------------------------------------------
// Save Epic artefacts — Benefit Hypothesis & Business Case (both versioned)
// ---------------------------------------------------------------------------

/** Most recent artefact versions to keep, to bound the JSON size. */
const ARTEFACT_HISTORY_LIMIT = 20;

export interface SaveBenefitHypothesisInput {
  epicId: EpicId;
  fields: BenefitHypothesisFields;
}

/**
 * Saves the Benefit Hypothesis for an Epic, keeping a version history: the
 * previous `current` (if it had content) is pushed onto `history`.
 */
export async function saveBenefitHypothesis(
  ctx: RequestContext,
  input: SaveBenefitHypothesisInput,
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { epicId, fields } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const loaded = await loadAuthorizedEpic(tx, ctx.principal, mctx, {
      id: epicId,
      action: "epic.update",
      select: { benefitHypothesis: true },
    });
    if (isErr(loaded)) return loaded;
    const existing = loaded.value;

    const prev = parseBenefitHypothesis(existing.benefitHypothesis);
    const next: BenefitHypothesis = appendVersion({
      previous: prev,
      nextFields: fields,
      hasContent: benefitHypothesisHasContent,
      savedBy: mctx.actorId,
      historyLimit: ARTEFACT_HISTORY_LIMIT,
    });

    await tx.initiative.update({
      where: { id: epicId },
      data: {
        updatedBy: mctx.actorId,
        benefitHypothesis: next as unknown as Prisma.InputJsonValue,
      },
    });

    return ok({
      result: undefined,
      audit: { action: "initiative.updated", resourceType: "initiative", resourceId: epicId },
    });
  });
}

export interface SaveBusinessCaseInput {
  epicId: EpicId;
  fields: BusinessCaseFields;
}

/**
 * Saves the Business Case for an Epic, keeping a version history: the previous
 * `current` (if it had content) is pushed onto `history`.
 */
export async function saveBusinessCase(
  ctx: RequestContext,
  input: SaveBusinessCaseInput,
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { epicId, fields } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const loaded = await loadAuthorizedEpic(tx, ctx.principal, mctx, {
      id: epicId,
      action: "epic.update",
      select: { businessCase: true },
    });
    if (isErr(loaded)) return loaded;
    const existing = loaded.value;

    const prev = parseBusinessCase(existing.businessCase);
    const next: BusinessCase = appendVersion({
      previous: prev,
      nextFields: fields,
      hasContent: businessCaseHasContent,
      savedBy: mctx.actorId,
      historyLimit: ARTEFACT_HISTORY_LIMIT,
    });

    await tx.initiative.update({
      where: { id: epicId },
      data: {
        updatedBy: mctx.actorId,
        businessCase: next as unknown as Prisma.InputJsonValue,
      },
    });

    // Reifegrad-Modell v2: L2.1 = „BC in Arbeit". Sobald Inhalt im Business Case
    // existiert, schlaegt der Trigger L1→L2 vor (owner-confirm) — die
    // Sub-Step-Derivation (subStageFor) macht daraus dann L2.1 bzw. L2.2 nach
    // BC-Approval. Der Trigger ist no-op, wenn kein Inhalt da ist bzw. das Epic
    // schon auf L2 oder weiter ist.
    if (businessCaseHasContent(fields)) {
      await signalGateTrigger(tx, mctx, epicId, "business_case_saved");
    }

    return ok({
      result: undefined,
      audit: { action: "initiative.updated", resourceType: "initiative", resourceId: epicId },
    });
  });
}

// ---------------------------------------------------------------------------
// Timeline — owner estimates + manual actuals; Implementation actual ⇒ Done
// ---------------------------------------------------------------------------

export interface SaveTimelineInput {
  epicId: EpicId;
  fields: TimelineFields;
}

/**
 * Saves the owner-controlled timeline (estimates + the manual Backlog/
 * Implementation actuals). Setting the Implementation actual is the one
 * lifecycle coupling: it marks the Epic Done (stage gate → L5).
 */
export async function saveTimeline(
  ctx: RequestContext,
  input: SaveTimelineInput,
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { epicId, fields } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const loaded = await loadAuthorizedEpic(tx, ctx.principal, mctx, {
      id: epicId,
      action: "epic.update",
      select: { id: true },
    });
    if (isErr(loaded)) return loaded;

    // Reifegrad-Modell v2: L5 ist im neuen Modell nicht mehr „Implementation
    // done", sondern „Impact recognized on Balance Sheet" — gesetzt vom
    // Controlling über `confirmEpicImpact`. Das Setzen der Implementation-
    // Actuals löst deshalb kein Stage-Advance mehr aus.

    await tx.initiative.update({
      where: { id: epicId },
      data: {
        updatedBy: mctx.actorId,
        timeline: fields as unknown as Prisma.InputJsonValue,
      },
    });

    return ok({
      result: undefined,
      audit: { action: "initiative.updated", resourceType: "initiative", resourceId: epicId },
    });
  });
}

// ---------------------------------------------------------------------------
// Assign Epic Owner (Portfolio Manager)
// ---------------------------------------------------------------------------

export async function assignEpicOwner(
  ctx: RequestContext,
  input: { epicId: EpicId; ownerId: string },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { epicId, ownerId } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    // Scope-aware seam check (ADR-0002): a value_stream_owner may only assign
    // owners within their own stream; portfolio_manager / admins are
    // unscoped.
    const loaded = await loadAuthorizedEpic(tx, ctx.principal, mctx, {
      id: epicId,
      action: "epic.owner.assign",
      select: { ownerId: true, selectedForDetailingAt: true },
    });
    if (isErr(loaded)) return loaded;
    const existing = loaded.value;

    // L0→L1 (stage-gate) bleibt beim Hypothesis-Approval. Aber das Kanban
    // verschiebt das Epic visuell sofort nach „Hypothese erstellen", sobald
    // ein Owner zugewiesen ist (siehe `bucketFor` in portfolio-overview.ts).
    // Passend dazu stempeln wir die Timeline-Phase „Selected for Detailing"
    // beim ersten Owner-Set — der advanceStageGate-Pfad bleibt idempotentes
    // Safety-Net fuer manuelle Spruenge ohne Owner.
    const stampSelectedForDetailing =
      existing.ownerId == null && existing.selectedForDetailingAt == null;
    const detailingAtNow = stampSelectedForDetailing ? new Date() : null;

    const { changes, data } = recordedUpdate({
      existing,
      updates: {
        ownerId,
        ...(detailingAtNow ? { selectedForDetailingAt: detailingAtNow } : {}),
      },
      fields: ["ownerId", "selectedForDetailingAt"] as const,
    });
    await tx.initiative.update({
      where: { id: epicId },
      data: { ...data, updatedBy: mctx.actorId },
    });

    return ok({
      result: undefined,
      audit: {
        action: "epic.owner.assigned",
        resourceType: "initiative",
        resourceId: epicId,
        changes,
      },
    });
  });
}

// ---------------------------------------------------------------------------
// Confirm Epic Impact (Reifegrad v2: L5 = "Impact realisiert")
// ---------------------------------------------------------------------------

/**
 * Controlling bestätigt, dass der prognostizierte Nutzen des Epics auf der
 * Balance-Sheet bzw. den KPIs angekommen ist. Setzt `impactRecognizedAt`,
 * `impactRecognizedBy`, `impactComment` und schiebt das Epic auf L5.
 *
 * Vorbedingungen:
 *  - Epic ist auf `L4` (L5-Sprung sonst falsch);
 *  - alle Child-Features sind `completed` (= L4.2 derived);
 *  - `impactRecognizedAt === null` (idempotent — kein doppeltes Stempeln).
 */
export async function confirmEpicImpact(
  ctx: RequestContext,
  input: { epicId: EpicId; comment?: string | undefined },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { epicId, comment } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const loaded = await loadAuthorizedEpic(tx, ctx.principal, mctx, {
      id: epicId,
      action: "epic.impact.confirm",
      select: { id: true },
    });
    if (isErr(loaded)) return loaded;

    // L5 = „Impact realisiert". The L4-gate + all-children-completed checks and
    // the impactRecognized* stamps + audit now live in the engine: signal the
    // completion fact (creates the L5 proposal iff ready), then confirm it.
    await signalGateTrigger(tx, mctx, epicId, "features_completed");
    const confirmed = await confirmProposedAdvance(tx, mctx, epicId, { comment });
    if (isErr(confirmed)) return confirmed;

    return ok({
      result: undefined,
      // `confirmProposedAdvance` runs the engine with `emitAudit: false`, so this
      // withAuditedTransaction owns the single `stage_gate.advanced` row.
      audit: {
        action: "initiative.stage_gate.advanced",
        resourceType: "initiative",
        resourceId: epicId,
        changes: {
          stageGate: { before: confirmed.value.from, after: confirmed.value.to },
          ...(comment ? { impactComment: { before: null, after: comment } } : {}),
        },
      },
    });
  });
}

// ---------------------------------------------------------------------------
// Delete Epic (soft)
// ---------------------------------------------------------------------------

export async function softDeleteEpic(
  ctx: RequestContext,
  input: { id: EpicId },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { id } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    // Scope-aware seam check (ADR-0002): authorize against the loaded Epic
    // before the soft-delete cascades, closing the previous bare-find gap.
    const loaded = await loadAuthorizedEpic(tx, ctx.principal, mctx, {
      id,
      action: "epic.delete",
      select: { id: true },
    });
    if (isErr(loaded)) return loaded;

    // Cascade soft-delete to all child features.
    const features = await tx.initiative.findMany({
      where: {
        parentId: id,
        tenantId: mctx.tenantId,
        level: InitiativeLevel.FEATURE,
        deletedAt: null,
      },
      select: { id: true },
    });
    const featureIds = features.map((f) => f.id);

    if (featureIds.length > 0) {
      await tx.initiative.updateMany({
        where: { id: { in: featureIds }, tenantId: mctx.tenantId },
        data: { deletedAt: new Date(), updatedBy: mctx.actorId },
      });
    }

    await tx.initiative.update({
      where: { id },
      data: { deletedAt: new Date(), updatedBy: mctx.actorId },
    });

    return ok({
      result: undefined,
      audit: { action: "initiative.deleted", resourceType: "initiative", resourceId: id },
    });
  });
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** Optionale Portfolio-Filter für die Epic-Liste (Mehrfachauswahl je Dimension;
 *  leere Arrays = keine Einschränkung). Wird vom Portfolio-Overview-Loader gefüllt. */
export interface EpicListFilter {
  valueStreamIds?: string[] | undefined;
  stageGates?: string[] | undefined;
  statuses?: string[] | undefined;
  ownerIds?: string[] | undefined;
}

export async function listEpics(
  db: PrismaClient,
  tenantId: TenantId,
  filter: EpicListFilter = {},
) {
  const vs = filter.valueStreamIds ?? [];
  const gates = filter.stageGates ?? [];
  const statuses = filter.statuses ?? [];
  const owners = filter.ownerIds ?? [];
  return db.initiative.findMany({
    where: {
      tenantId,
      level: InitiativeLevel.EPIC,
      deletedAt: null,
      ...(vs.length ? { valueStreamId: { in: vs } } : {}),
      ...(gates.length ? { stageGate: { in: gates } } : {}),
      ...(statuses.length ? { status: { in: statuses } } : {}),
      ...(owners.length ? { ownerId: { in: owners } } : {}),
    },
    include: { valueStream: { select: { id: true, name: true } } },
    orderBy: [{ stageGate: "asc" }, { createdAt: "desc" }],
  });
}

/**
 * Portfolio-Overview-Variante von {@link listEpics}: identische Filter +
 * Sortierung, aber ein expliziter `select` auf exakt die Felder, die der
 * Overview-Builder (`buildPortfolioOverviewModel`) liest. Spart die grossen
 * JSON-Spalten (`benefitHypothesis`/`businessCase`/`baseline*`), die die
 * Landing-Page nie anfasst — `timeline` bleibt, weil `l4DueSoon` es via
 * `parseTimeline` auswertet. `listEpics` bleibt unangetastet (die v1-API
 * liefert die vollen Rows als JSON weiter).
 */
export async function listEpicsForOverview(
  db: PrismaClient,
  tenantId: TenantId,
  filter: EpicListFilter = {},
) {
  const vs = filter.valueStreamIds ?? [];
  const gates = filter.stageGates ?? [];
  const statuses = filter.statuses ?? [];
  const owners = filter.ownerIds ?? [];
  return db.initiative.findMany({
    where: {
      tenantId,
      level: InitiativeLevel.EPIC,
      deletedAt: null,
      ...(vs.length ? { valueStreamId: { in: vs } } : {}),
      ...(gates.length ? { stageGate: { in: gates } } : {}),
      ...(statuses.length ? { status: { in: statuses } } : {}),
      ...(owners.length ? { ownerId: { in: owners } } : {}),
    },
    select: {
      id: true,
      title: true,
      status: true,
      stageGate: true,
      ownerId: true,
      businessCaseApprovedAt: true,
      updatedAt: true,
      needsSteeringAttention: true,
      timeline: true,
      valueStream: { select: { id: true, name: true } },
    },
    orderBy: [{ stageGate: "asc" }, { createdAt: "desc" }],
  });
}

/**
 * Epics with everything the portfolio epics-list page-model needs in one
 * query: KPI rows (`baseline`, `target`, `measurements` — the page-model
 * picks the latest measurement as the current value) and `EpicApproval`
 * rows (for the active-revision pending count). Child Feature counts come
 * from a separate `groupBy` (see `countEpicChildFeatures` below) — Prisma's
 * `_count` filter syntax is awkward enough that a second tiny query is
 * cleaner than tortured includes.
 */
export async function listEpicsForPortfolioList(db: PrismaClient, tenantId: TenantId) {
  return db.initiative.findMany({
    where: { tenantId, level: InitiativeLevel.EPIC, deletedAt: null },
    include: {
      valueStream: { select: { id: true, name: true } },
      kpis: {
        select: {
          baseline: true,
          target: true,
          measurements: true,
          valuePerUnit: true,
          benefitKind: true,
          recurringInterval: true,
        },
      },
      epicApprovals: { select: { revision: true, status: true } },
    },
    orderBy: [{ stageGate: "asc" }, { createdAt: "desc" }],
  });
}

/**
 * Per-Epic child Feature count map. One `groupBy` over the Features table —
 * cheaper than nesting `_count` with a `where` clause through Prisma.
 */
export async function countEpicChildFeatures(
  db: PrismaClient,
  tenantId: TenantId,
): Promise<Map<string, number>> {
  const rows = await db.initiative.groupBy({
    by: ["parentId"],
    where: { tenantId, level: InitiativeLevel.FEATURE, deletedAt: null },
    _count: { _all: true },
  });
  const out = new Map<string, number>();
  for (const r of rows) {
    if (r.parentId) out.set(r.parentId, r._count._all);
  }
  return out;
}

/**
 * Per-Epic *completed*-child-feature count. Mirrors {@link countEpicChildFeatures}
 * with a status filter so the page-model can derive the sub-stage L4.2 = „alle
 * Child-Features completed".
 */
export async function countEpicCompletedChildFeatures(
  db: PrismaClient,
  tenantId: TenantId,
): Promise<Map<string, number>> {
  const rows = await db.initiative.groupBy({
    by: ["parentId"],
    where: {
      tenantId,
      level: InitiativeLevel.FEATURE,
      deletedAt: null,
      status: "completed",
    },
    _count: { _all: true },
  });
  const out = new Map<string, number>();
  for (const r of rows) {
    if (r.parentId) out.set(r.parentId, r._count._all);
  }
  return out;
}

export async function getEpic(db: PrismaClient, tenantId: TenantId, id: EpicId) {
  return db.initiative.findFirst({
    where: { id, tenantId, level: InitiativeLevel.EPIC, deletedAt: null },
    include: {
      valueStream: { select: { id: true, name: true, financeApproverId: true, vmoId: true } },
      children: {
        where: { deletedAt: null },
        select: {
          id: true,
          title: true,
          level: true,
          status: true,
          description: true,
          // Grundlage der Sortierung „Neueste/Älteste zuerst" in der
          // Deliverables-Tabelle — ohne das Feld fehlt ihr der Bezugspunkt.
          createdAt: true,
          artId: true,
          piId: true,
          acceptanceCriteria: true,
          wsjfBusinessValue: true,
          wsjfTimeCriticality: true,
          wsjfRiskReduction: true,
          wsjfJobSize: true,
          wsjfComputed: true,
          featureType: true,
          art: { select: { id: true, name: true } },
          // The Features' PI windows feed the "Ist"-Ableitung of the Epic's
          // planned delivery window on the Overview tab and on the roadmap.
          pi: { select: { id: true, name: true, startDate: true, endDate: true } },
        },
        orderBy: { wsjfComputed: "desc" },
      },
    },
  });
}
