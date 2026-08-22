import type { Prisma } from "@/generated/prisma";
import type { PrismaClient } from "@/generated/prisma";
import type {
  TenantId,
  EpicId,
  ValueStreamId,
} from "@/modules/core/kernel/domain/types";
import { InitiativeLevel } from "@/modules/core/kernel/domain/types";
import type { Result } from "@/modules/core/kernel/domain/errors";
import { ok, err, isErr } from "@/modules/core/kernel/domain/errors";
import { recordedUpdate } from "@/modules/core/kernel/server/recorded-update";
import type { EpicType, Horizon } from "@/modules/work/domain/portfolio-guardrails";
import type { RequestContext } from "@/server/http/mutation-handler";
import { withAuditedTransaction, toMutationContext } from "@/modules/core/kernel/server/mutation";
import { createInitiativeWithDerivedPath } from "@/modules/core/kernel/server/initiative-write";
import { loadAuthorizedEpic } from "@/modules/work/server/services/epic-access";
import { appendVersion } from "@/modules/work/domain/versioned-document";
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
import { timelinePlannedWindow } from "@/modules/work/domain/epic-schedule";
import { isSubmissionReady } from "@/modules/work/domain/submission";

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
  /** Participatory-Budgeting-Einreichungsfelder. `null` cleart, `undefined` belaesst. */
  mandatory?: boolean | undefined;
  costToMvp?: number | null | undefined;
  riskRating?: string | null | undefined;
  problemStatement?: string | null | undefined;
  mvpCut?: string | null | undefined;
  ifNotFunded?: string | null | undefined;
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
    mandatory,
    costToMvp,
    riskRating,
    problemStatement,
    mvpCut,
    ifNotFunded,
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
        mandatory: true,
        costToMvp: true,
        riskRating: true,
        problemStatement: true,
        mvpCut: true,
        ifNotFunded: true,
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

    // `costToMvp` ist Decimal — für den Diff auf number normalisieren (Prisma
    // akzeptiert number beim Update), damit existing/update typgleich sind.
    const existingForDiff = {
      ...existing,
      costToMvp: existing.costToMvp != null ? Number(existing.costToMvp) : null,
    };

    // Vormerk-Gate (B/S1.2): ein Epic darf nur auf den PB-Ballot, wenn es
    // einreichungsbereit ist. Prüfung gegen die *effektiven* Felder (existing +
    // dieses Update), damit „Feld setzen + vormerken" in einem Zug funktioniert.
    if (stagedForBudgeting === true) {
      const eff = {
        problemStatement:
          problemStatement !== undefined ? problemStatement : existing.problemStatement,
        mvpCut: mvpCut !== undefined ? mvpCut : existing.mvpCut,
        costToMvp: costToMvp !== undefined ? costToMvp : existingForDiff.costToMvp,
        riskRating: riskRating !== undefined ? riskRating : existing.riskRating,
        ifNotFunded: ifNotFunded !== undefined ? ifNotFunded : existing.ifNotFunded,
      };
      if (!isSubmissionReady(eff)) {
        return err({
          kind: "conflict" as const,
          reason:
            "Epic ist nicht einreichungsbereit — Pflichtfelder fehlen: Problem, MVP-Schnitt, Kosten bis MVP, Risiko, Wenn-nicht-finanziert.",
        });
      }
    }

    const { changes, data } = recordedUpdate({
      existing: existingForDiff,
      updates: {
        title,
        description,
        needsSteeringAttention,
        stagedForBudgeting,
        plannedStartAt,
        plannedEndAt,
        epicType,
        investmentHorizon,
        mandatory,
        costToMvp,
        riskRating,
        problemStatement,
        mvpCut,
        ifNotFunded,
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
        "mandatory",
        "costToMvp",
        "riskRating",
        "problemStatement",
        "mvpCut",
        "ifNotFunded",
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
// Reifegrad-Wechsel leben nicht mehr hier.
//
// `advanceStageGate` (manueller Sprung) und `confirmProposedStageGate`
// (Bestätigung eines Vorschlags) sind entfallen. Ein Wechsel wird beantragt und
// von namentlich benannten Personen abgenommen — siehe
// `server/services/stage-gate-transition.ts`. Die Rückwärts-Korrektur heisst
// dort `revertStageGate` und räumt anders als früher die Stempel des
// verlassenen Gates ab.
// ---------------------------------------------------------------------------

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

    // Kein Gate-Trigger mehr: dass der Business Case Inhalt hat, ist ein
    // Readiness-Kriterium, das beim Lesen abgeleitet wird (`gate-readiness.ts`).
    // Speichern verschiebt keinen Reifegrad — der Push ist ein eigener,
    // abgenommener Akt.

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

    // L5 heisst „Impact recognized on Balance Sheet", nicht „Implementation
    // done" — der Stempel entsteht bei der L4→L5-Abnahme durch das Controlling
    // (ADR-0018). Implementation-Actuals lösen deshalb keinen Wechsel aus.

    // Das geplante Zeitfenster folgt dem Reifegrad-Plan: L4.1 (implementation_
    // started) → L4.2 (implementation). `saveTimeline` ist damit die alleinige
    // Quelle der plannedStartAt/plannedEndAt-Spalten (Budget setzt sie nicht mehr).
    const { plannedStartAt, plannedEndAt } = timelinePlannedWindow(fields);

    await tx.initiative.update({
      where: { id: epicId },
      data: {
        updatedBy: mctx.actorId,
        timeline: fields as unknown as Prisma.InputJsonValue,
        plannedStartAt,
        plannedEndAt,
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

    // Die Timeline-Phase „Selected for Detailing" wird beim ersten Owner-Set
    // gestempelt. Das Gate selbst bewegt sich dadurch NICHT — dafür braucht es
    // einen abgenommenen Antrag (ADR-0018). Der Stempel ist set-once; rückt das
    // Epic später regulär auf L1, sieht `stampsForAdvance` ihn und stempelt
    // nicht doppelt.
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
// `confirmEpicImpact` ist entfallen.
//
// L5 („Impact realisiert") war der einzige Reifegrad mit eigenem Dialog und
// eigener Capability. Jetzt ist es der Wechsel L4→L5 wie jeder andere: das
// Controlling steht als Abnehmer auf der L5-Regel, und `impactRecognizedBy` /
// `impactComment` tragen die Person und den Kommentar der tatsächlichen
// Abnahme statt desjenigen, der den Dialog geöffnet hat.
// ---------------------------------------------------------------------------

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
