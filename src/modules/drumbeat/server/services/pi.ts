import type { PrismaClient } from "@/generated/prisma";
import type { TenantId, ArtId, PiId, TimelineId } from "@/modules/core/kernel/domain/types";
import type { Result } from "@/modules/core/kernel/domain/errors";
import { ok, err, isErr } from "@/modules/core/kernel/domain/errors";
import {
  validatePiDates,
  evaluateClosure,
  canTransition,
  nextPiFromCadence,
  type PiStatus,
} from "@/modules/drumbeat/domain/pi-rules";
import { recordedUpdate } from "@/modules/core/kernel/server/recorded-update";
import type { RequestContext } from "@/server/http/mutation-handler";
import {
  withAuditedTransaction,
  toMutationContext,
  onUniqueConstraint,
} from "@/modules/core/kernel/server/mutation";
import { paginate, type PageParams } from "@/server/db/paginate";

export interface CreatePiInput {
  /** The shared Timeline this PI belongs to. PIs are no longer per-ART. */
  timelineId: TimelineId;
  name: string;
  startDate: Date;
  endDate: Date;
}

export interface UpdatePiInput {
  id: PiId;
  name?: string | undefined;
  startDate?: Date | undefined;
  endDate?: Date | undefined;
  status?: string | undefined;
}

export type { PiStatus };

export async function createPi(
  ctx: RequestContext,
  input: CreatePiInput,
): Promise<Result<{ id: PiId }>> {
  const mctx = toMutationContext(ctx);
  const { timelineId, name, startDate, endDate } = input;

  return withAuditedTransaction(
    mctx,
    async (tx) => {
      const timeline = await tx.timeline.findFirst({
        where: { id: timelineId, tenantId: mctx.tenantId },
        select: { id: true },
      });
      if (!timeline) {
        return err({ kind: "not_found" as const, resourceType: "Timeline", id: timelineId });
      }

      const others = await tx.programIncrement.findMany({
        where: { tenantId: mctx.tenantId, timelineId },
        select: { id: true, name: true, startDate: true, endDate: true },
      });

      const check = validatePiDates({
        name,
        start: startDate,
        end: endDate,
        otherPis: others,
        now: new Date(),
      });
      if (isErr(check)) return check;

      const pi = await tx.programIncrement.create({
        data: { tenantId: mctx.tenantId, timelineId, name, startDate, endDate },
      });

      return ok({
        result: { id: pi.id as PiId },
        audit: { action: "pi.created", resourceType: "program_increment", resourceId: pi.id },
      });
    },
    { onPrismaError: onUniqueConstraint(`PI "${name}" already exists in this Timeline`) },
  );
}

export async function updatePi(ctx: RequestContext, input: UpdatePiInput): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { id, name, startDate, endDate, status } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const existing = await tx.programIncrement.findFirst({
      where: { id, tenantId: mctx.tenantId },
    });
    if (!existing) {
      return err({ kind: "not_found" as const, resourceType: "ProgramIncrement", id });
    }

    if (existing.status === "completed" && status !== "completed") {
      return err({ kind: "conflict" as const, reason: "Cannot reopen a completed PI" });
    }

    // Lifecycle transitions to active/completed go through startPi/completePi,
    // which enforce the one-active-PI rule and the closure gate.
    if (status !== undefined && status !== existing.status && status !== "planned") {
      return err({
        kind: "conflict" as const,
        reason: `Use the ${status === "active" ? "start" : "complete"} action to move a PI to "${status}"`,
      });
    }

    // Validate dates (overlap, duration, past, name-unique) only when the
    // caller actually changes one of those fields.
    if (
      startDate !== undefined ||
      endDate !== undefined ||
      (name !== undefined && name !== existing.name)
    ) {
      const newStart = startDate ?? existing.startDate;
      const newEnd = endDate ?? existing.endDate;
      const newName = name ?? existing.name;
      const tlId = existing.timelineId;
      if (!tlId) {
        return err({
          kind: "conflict" as const,
          reason:
            "PI ohne Timeline-Verknuepfung kann nicht ueber den Timeline-Pfad editiert werden",
        });
      }
      const others = await tx.programIncrement.findMany({
        where: { tenantId: mctx.tenantId, timelineId: tlId },
        select: { id: true, name: true, startDate: true, endDate: true },
      });
      const check = validatePiDates({
        id,
        name: newName,
        start: newStart,
        end: newEnd,
        otherPis: others,
        now: new Date(),
      });
      if (isErr(check)) return check;
    }

    // startDate / endDate are written but not audited (PI dates are mostly
    // shifted in bulk during planning; the audit captures the name/status
    // governance changes that matter).
    const { changes, data } = recordedUpdate({
      existing,
      updates: { name, status },
      fields: ["name", "status"] as const,
    });

    await tx.programIncrement.update({
      where: { id },
      data: {
        ...data,
        ...(startDate !== undefined && { startDate }),
        ...(endDate !== undefined && { endDate }),
      },
    });

    return ok({
      result: undefined,
      audit: { action: "pi.updated", resourceType: "program_increment", resourceId: id, changes },
    });
  });
}

/**
 * Sets the PI's capacity overrides used by the PI-Planning column overlay
 * (Job Size + €). Either field can be cleared individually by passing `null`;
 * `undefined` leaves the existing column untouched. Non-negative numbers only.
 */
export async function setPiCapacity(
  ctx: RequestContext,
  input: {
    id: PiId;
    capacityJobSize?: number | null | undefined;
    capacityAmount?: number | null | undefined;
  },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { id, capacityJobSize, capacityAmount } = input;

  if (capacityJobSize !== undefined && capacityJobSize !== null && capacityJobSize < 0) {
    return err({ kind: "conflict" as const, reason: "Job-Size-Kapazität darf nicht negativ sein" });
  }
  if (capacityAmount !== undefined && capacityAmount !== null && capacityAmount < 0) {
    return err({ kind: "conflict" as const, reason: "Budget-Override darf nicht negativ sein" });
  }

  return withAuditedTransaction(mctx, async (tx) => {
    const existing = await tx.programIncrement.findFirst({
      where: { id, tenantId: mctx.tenantId },
    });
    if (!existing) {
      return err({ kind: "not_found" as const, resourceType: "ProgramIncrement", id });
    }

    // Normalise the existing row's Decimal to a JS number before snapshotting,
    // so the audit reads numeric (not "Decimal(…)").
    const existingProjected = {
      capacityJobSize: existing.capacityJobSize,
      capacityAmount: existing.capacityAmount != null ? Number(existing.capacityAmount) : null,
    };
    const { changes, data } = recordedUpdate({
      existing: existingProjected,
      updates: { capacityJobSize, capacityAmount },
      fields: ["capacityJobSize", "capacityAmount"] as const,
    });

    await tx.programIncrement.update({ where: { id }, data });

    return ok({
      result: undefined,
      audit: {
        action: "pi.capacity.updated",
        resourceType: "program_increment",
        resourceId: id,
        changes,
      },
    });
  });
}

/**
 * Starts a PI: enforces that no other PI in the same Timeline is already active.
 */
export async function startPi(ctx: RequestContext, input: { id: PiId }): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { id } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const existing = await tx.programIncrement.findFirst({
      where: { id, tenantId: mctx.tenantId },
    });
    if (!existing) {
      return err({ kind: "not_found" as const, resourceType: "ProgramIncrement", id });
    }

    // Pure transition-validity: only planned → active is a legal start.
    // The one-active-PI-per-Timeline guard below is DB-dependent and stays here.
    if (!canTransition(existing.status as PiStatus, "active")) {
      return err({
        kind: "conflict" as const,
        reason: `Only a planned PI can be started (current status: ${existing.status})`,
      });
    }

    if (!existing.timelineId) {
      return err({
        kind: "conflict" as const,
        reason: "PI hat keine Timeline — kann nicht gestartet werden",
      });
    }
    const otherActive = await tx.programIncrement.findFirst({
      where: {
        tenantId: mctx.tenantId,
        timelineId: existing.timelineId,
        status: "active",
        id: { not: id },
      },
    });
    if (otherActive) {
      return err({
        kind: "conflict" as const,
        reason: `PI "${otherActive.name}" ist bereits in dieser Timeline aktiv; bitte zuerst abschließen`,
      });
    }

    await tx.programIncrement.update({ where: { id }, data: { status: "active" } });

    return ok({
      result: undefined,
      audit: {
        action: "pi.started",
        resourceType: "program_increment",
        resourceId: id,
        changes: { status: { before: existing.status, after: "active" } },
      },
    });
  });
}

/**
 * Completes an active PI (programmatischer Weg, nur v1-REST-API
 * `POST /api/v1/pis/[id]/complete`). Erzwingt vorher den Closure-Gate
 * (`evaluateClosure`). Aus dem UI ist dieser Weg entfallen — dort schließt
 * ausschließlich `advanceCadence` („PI abschließen & nächstes öffnen").
 */
/**
 * Offene, un-ge-ROAM-te Issues über die ARTs einer Timeline — die geteilte
 * Projektion, die sowohl der Closure-Gate (`completePi`) als auch die nicht-
 * blockierende Fortschreib-Warnung (`advanceCadence`) lesen. (Eigene Richtung
 * als `resolveArtTimelines`: dort ART→Timeline, hier Timeline→ARTs.)
 */
async function countOpenRoamIssues(
  tx: Pick<PrismaClient, "art" | "issue">,
  tenantId: string,
  timelineId: string | null,
): Promise<number> {
  if (!timelineId) return 0;
  const arts = await tx.art.findMany({ where: { tenantId, timelineId }, select: { id: true } });
  const artIds = arts.map((a) => a.id);
  if (artIds.length === 0) return 0;
  return tx.issue.count({
    where: { tenantId, deletedAt: null, roamStatus: "open", artId: { in: artIds } },
  });
}

export async function completePi(ctx: RequestContext, input: { id: PiId }): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { id } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const existing = await tx.programIncrement.findFirst({
      where: { id, tenantId: mctx.tenantId },
    });
    if (!existing) {
      return err({ kind: "not_found" as const, resourceType: "ProgramIncrement", id });
    }

    // Pure transition-validity: only active → completed is a legal completion.
    if (!canTransition(existing.status as PiStatus, "completed")) {
      return err({
        kind: "conflict" as const,
        reason: `Only an active PI can be completed (current status: ${existing.status})`,
      });
    }

    // Belt & suspenders: dieselben Checks wie der Wizard, serverseitig — die
    // Regel lebt in der Domain (evaluateClosure), hier nur die tx-Projektion.
    const openIssues = await countOpenRoamIssues(tx, mctx.tenantId, existing.timelineId);
    const issues = evaluateClosure({
      openUnroamedIssues: openIssues,
      systemDemoAt: existing.systemDemoAt,
      inspectAdaptAt: existing.inspectAdaptAt,
      retrospectiveNotes: existing.retrospectiveNotes,
    });
    if (issues.length > 0) {
      return err({
        kind: "conflict" as const,
        reason: `PI-Abschluss nicht möglich: ${issues.join(" · ")}`,
      });
    }

    await tx.programIncrement.update({ where: { id }, data: { status: "completed" } });

    return ok({
      result: undefined,
      audit: {
        action: "pi.completed",
        resourceType: "program_increment",
        resourceId: id,
        changes: { status: { before: existing.status, after: "completed" } },
      },
    });
  });
}

/**
 * Kadenz fortschreiben (Rolling-Window): schließt das **aktive** PI ab und öffnet
 * das nächste — ohne das harte Closure-Gate zu erzwingen (offene Punkte kommen als
 * `warnings` zurück, blockieren aber nicht). Fehlt das nächste PI, wird es aus der
 * Kadenz (`nextPiFromCadence`) erzeugt. Bewusst getrennt von `completePi`/`startPi`
 * (die das Gate bzw. die eine-aktive-Invariante erzwingen) — hier ein leichtes
 * Weiterrollen als eine Transaktion.
 */
export async function advanceCadence(
  ctx: RequestContext,
  input: { piId: PiId },
): Promise<Result<{ from: string; to: string; warnings: string[] }>> {
  const mctx = toMutationContext(ctx);

  return withAuditedTransaction(mctx, async (tx) => {
    const active = await tx.programIncrement.findFirst({
      where: { id: input.piId, tenantId: mctx.tenantId },
    });
    if (!active) {
      return err({ kind: "not_found" as const, resourceType: "ProgramIncrement", id: input.piId });
    }
    if (active.status !== "active") {
      return err({
        kind: "conflict" as const,
        reason: `Nur ein aktives PI kann fortgeschrieben werden (Status: ${active.status}).`,
      });
    }
    if (!active.timelineId) {
      return err({ kind: "conflict" as const, reason: "PI ohne Timeline kann nicht fortgeschrieben werden." });
    }

    // Nicht-blockierende Warnung — bewusst NUR der handlungsrelevante Punkt:
    // offene ROAM-Issues (dafür gibt es eine Oberfläche). Die Closure-Ceremonies
    // (System-Demo/Inspect&Adapt/Retro) werden hier NICHT geprüft, weil es keine
    // UI zum Setzen der Termine gibt; das volle Gate bleibt allein in `completePi`.
    const openIssues = await countOpenRoamIssues(tx, mctx.tenantId, active.timelineId);
    const warnings: string[] = [];
    if (openIssues > 0) warnings.push(`${openIssues} offene Issue(s) ohne ROAM`);

    // Ablaufendes PI abschließen (leicht — ohne Gate-Blocker).
    await tx.programIncrement.update({ where: { id: active.id }, data: { status: "completed" } });

    // Nächstes PI: frühestes mit späterem Start; sonst aus der Kadenz erzeugen.
    const siblings = await tx.programIncrement.findMany({
      where: { tenantId: mctx.tenantId, timelineId: active.timelineId },
      orderBy: { startDate: "asc" },
      select: { id: true, name: true, startDate: true, endDate: true },
    });
    const existingNext = siblings.find(
      (p) => p.id !== active.id && p.startDate.getTime() > active.startDate.getTime(),
    );

    let nextId: string;
    let nextName: string;
    if (existingNext) {
      nextId = existingNext.id;
      nextName = existingNext.name;
    } else {
      const spec = nextPiFromCadence(siblings);
      if (!spec) {
        return err({ kind: "conflict" as const, reason: "Kadenz nicht ableitbar." });
      }
      // Bewusst NICHT über `createPi`: die Kadenz-Ableitung (`nextPiFromCadence`)
      // ist kontiguierlich per Konstruktion — die Datums-/Überlappungs-Validierung
      // von `createPi` wäre hier redundant, und dieser Insert muss in derselben
      // Transaktion wie der Abschluss des aktiven PI laufen. `createPi` (mit
      // Validierung) bleibt der Weg für manuell/aus-Standard angelegte PIs.
      const created = await tx.programIncrement.create({
        data: {
          tenantId: mctx.tenantId,
          timelineId: active.timelineId,
          name: spec.name,
          startDate: spec.startDate,
          endDate: spec.endDate,
          status: "planned",
        },
        select: { id: true, name: true },
      });
      nextId = created.id;
      nextName = created.name;
    }

    // Nächstes PI aktivieren (die Invariante hält, da das alte gerade completed wurde).
    await tx.programIncrement.update({ where: { id: nextId }, data: { status: "active" } });

    return ok({
      result: { from: active.name, to: nextName, warnings },
      audit: {
        action: "pi.cadence.advanced" as const,
        resourceType: "program_increment" as const,
        resourceId: nextId,
        changes: { from: { before: active.name, after: null }, to: { before: null, after: nextName } },
      },
    });
  });
}

/**
 * Delete a planned PI and cascade: assigned features return to the backlog
 * (piId → null) and issues are detached but kept in the ART log.
 *
 * Sibling: `detachArtFromTimeline` ([timeline.ts](./timeline.ts)) handles a
 * different lifecycle event — an ART leaving a Timeline while the PI rows
 * stay. The two functions look similar but encode different policies. See
 * `docs/adr/0005-cascade-unlink-stays-split.md` for why they stay separate.
 */
export async function deletePi(ctx: RequestContext, input: { id: PiId }): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { id } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const pi = await tx.programIncrement.findFirst({ where: { id, tenantId: mctx.tenantId } });
    if (!pi) {
      return err({ kind: "not_found" as const, resourceType: "ProgramIncrement", id });
    }
    if (pi.status !== "planned") {
      return err({ kind: "conflict" as const, reason: "Only a planned PI can be deleted" });
    }

    // Features assigned to this PI fall back to the backlog.
    await tx.initiative.updateMany({
      where: { tenantId: mctx.tenantId, piId: id },
      data: { piId: null },
    });

    // Issues are kept (ART-scoped) but detached from the PI.
    await tx.issue.updateMany({
      where: { tenantId: mctx.tenantId, piId: id },
      data: { piId: null },
    });

    await tx.programIncrement.delete({ where: { id } });

    return ok({
      result: undefined,
      audit: { action: "pi.deleted", resourceType: "program_increment", resourceId: id },
    });
  });
}

/**
 * The shared "an ART's PIs live on its Timeline" join, in one place. Resolves a
 * set of ARTs to their Timeline ids in a single query; ARTs without a Timeline
 * are simply absent from the returned map. `includeDeleted: true` (the single-
 * ART reads) matches their historical "by id + tenant only" lookup; the multi-
 * ART planning picker passes `false` to drop soft-deleted ARTs. Drumbeat-
 * internal — no layering concern.
 */
async function resolveArtTimelines(
  db: PrismaClient,
  tenantId: TenantId,
  artIds: readonly string[],
  { includeDeleted = false }: { includeDeleted?: boolean } = {},
): Promise<Map<string, string>> {
  if (artIds.length === 0) return new Map();
  const arts = await db.art.findMany({
    where: {
      id: { in: artIds as string[] },
      tenantId,
      timelineId: { not: null },
      ...(includeDeleted ? {} : { deletedAt: null }),
    },
    select: { id: true, timelineId: true },
  });
  return new Map(arts.map((a) => [a.id, a.timelineId as string]));
}

/**
 * Single-ART convenience over `resolveArtTimelines`: the ART's Timeline id, or
 * `null` when it has none. Backs `listPis`/`listArtPlanningPis`; keeps the
 * legacy "find by id + tenant, deleted or not" behavior (`includeDeleted`).
 */
async function resolveTimelineForArt(
  db: PrismaClient,
  tenantId: TenantId,
  artId: ArtId,
): Promise<string | null> {
  const map = await resolveArtTimelines(db, tenantId, [artId], { includeDeleted: true });
  return map.get(artId) ?? null;
}

/**
 * PIs of one ART — routes through the ART's Timeline. Returns [] when the ART
 * has no Timeline yet (the page surfaces an empty-state CTA in that case).
 */
export async function listPis(
  db: PrismaClient,
  tenantId: TenantId,
  artId: ArtId,
  pageParams: PageParams = { page: 1, pageSize: 200 },
) {
  const timelineId = await resolveTimelineForArt(db, tenantId, artId);
  if (!timelineId) {
    return { items: [], total: 0, page: 1, pageSize: pageParams.pageSize ?? 200 };
  }
  const where = { tenantId, timelineId };
  const include = { _count: { select: { initiatives: true } } };
  const orderBy = { startDate: "desc" as const };

  return paginate(
    ({ take, skip }) => db.programIncrement.findMany({ where, include, orderBy, take, skip }),
    () => db.programIncrement.count({ where }),
    pageParams,
  );
}

/**
 * Program Increments across several ARTs at once — feeds the per-feature PI
 * picker on the Epic Breakdown tab, where child Features may span ARTs. Each
 * row carries an `artId` stamp for back-compat with existing callers; it
 * names the first subscribed ART of that PI's Timeline (deterministic, but
 * only a display hint — multiple ARTs may share the same Timeline-PI).
 */
export async function listProgramIncrementsForArts(
  db: PrismaClient,
  tenantId: TenantId,
  artIds: string[],
) {
  if (artIds.length === 0) return [];
  // Multi-ART variant of the same ART→Timeline join; drops soft-deleted ARTs.
  const artTimelines = await resolveArtTimelines(db, tenantId, artIds, { includeDeleted: false });
  const timelineIds = [...new Set(artTimelines.values())];
  if (timelineIds.length === 0) return [];
  const rows = await db.programIncrement.findMany({
    where: { tenantId, timelineId: { in: timelineIds } },
    select: { id: true, name: true, timelineId: true, startDate: true },
    orderBy: { startDate: "desc" },
  });
  // Stamp each PI with one representative artId from the input list.
  const firstArtByTimeline = new Map<string, string>();
  for (const [id, timelineId] of artTimelines) {
    if (!firstArtByTimeline.has(timelineId)) {
      firstArtByTimeline.set(timelineId, id);
    }
  }
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    artId: firstArtByTimeline.get(r.timelineId!) ?? null,
    startDate: r.startDate,
  }));
}

/** PIs of one ART (via its Timeline) with sprint counts — backs PI-Planning. */
export async function listArtPlanningPis(db: PrismaClient, tenantId: TenantId, artId: ArtId) {
  const timelineId = await resolveTimelineForArt(db, tenantId, artId);
  if (!timelineId) return [];
  return db.programIncrement.findMany({
    where: { tenantId, timelineId },
    select: {
      id: true,
      name: true,
      status: true,
      startDate: true,
      endDate: true,
      capacityJobSize: true,
      capacityAmount: true,
    },
    orderBy: { startDate: "asc" },
  });
}

export async function getPi(db: PrismaClient, tenantId: TenantId, id: PiId) {
  return db.programIncrement.findFirst({
    where: { id, tenantId },
    include: {
      // The Timeline + all ARTs subscribed — replaces the single-ART include.
      timeline: {
        include: {
          arts: { select: { id: true, name: true } },
        },
      },
      initiatives: {
        where: { deletedAt: null, level: 1 },
        select: {
          id: true,
          title: true,
          status: true,
          wsjfComputed: true,
          artId: true,
          art: { select: { id: true, name: true } },
        },
        orderBy: [{ artId: "asc" }, { wsjfComputed: "desc" }],
      },
    },
  });
}
