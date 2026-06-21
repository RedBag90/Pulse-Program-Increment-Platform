import type { PrismaClient } from "@/generated/prisma";
import type { TenantId, ArtId, PiId, TimelineId } from "@/domain/types";
import type { Result } from "@/domain/errors";
import { ok, err, isErr } from "@/domain/errors";
import { validatePiDates } from "@/domain/pi-planning";
import { buildChangelog } from "@/domain/change-log";
import type { RequestContext } from "@/server/http/mutation-handler";
import {
  withAuditedTransaction,
  toMutationContext,
  onUniqueConstraint,
} from "@/server/services/mutation";
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

export type PiStatus = "planned" | "active" | "completed";

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
        select: { id: true, cadenceWeeks: true },
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
        cadenceWeeks: timeline.cadenceWeeks,
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
    // which enforce the one-active-PI rule and objective commitment checks.
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
      const timeline = await tx.timeline.findFirst({
        where: { id: tlId, tenantId: mctx.tenantId },
        select: { cadenceWeeks: true },
      });
      if (!timeline) {
        return err({ kind: "not_found" as const, resourceType: "Timeline", id: tlId });
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
        cadenceWeeks: timeline.cadenceWeeks,
        otherPis: others,
        now: new Date(),
      });
      if (isErr(check)) return check;
    }

    const changes = buildChangelog(
      { name: existing.name, status: existing.status },
      { ...(name !== undefined && { name }), ...(status !== undefined && { status }) },
      ["name", "status"],
    );

    await tx.programIncrement.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(startDate !== undefined && { startDate }),
        ...(endDate !== undefined && { endDate }),
        ...(status !== undefined && { status }),
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

    const changes = buildChangelog(
      {
        capacityJobSize: existing.capacityJobSize,
        capacityAmount: existing.capacityAmount != null ? Number(existing.capacityAmount) : null,
      },
      {
        ...(capacityJobSize !== undefined && { capacityJobSize }),
        ...(capacityAmount !== undefined && { capacityAmount }),
      },
      ["capacityJobSize", "capacityAmount"],
    );

    await tx.programIncrement.update({
      where: { id },
      data: {
        ...(capacityJobSize !== undefined && { capacityJobSize }),
        ...(capacityAmount !== undefined && { capacityAmount }),
      },
    });

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
 * Starts a PI: enforces that no other PI in the ART is active and that every
 * team in the ART has at least one committed PI Objective (concept PULSE-29).
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

    if (existing.status !== "planned") {
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

    // Every team in every subscribed ART must have at least one committed objective.
    const teams = await tx.team.findMany({
      where: { tenantId: mctx.tenantId, art: { timelineId: existing.timelineId } },
    });
    if (teams.length > 0) {
      const committed = await tx.piObjective.findMany({
        where: { tenantId: mctx.tenantId, piId: id, committed: true },
        select: { teamId: true },
      });
      const teamsWithObjectives = new Set(committed.map((o) => o.teamId));
      const missing = teams.filter((t) => !teamsWithObjectives.has(t.id));
      if (missing.length > 0) {
        return err({
          kind: "conflict" as const,
          reason: `These teams have no committed PI objectives: ${missing.map((t) => t.name).join(", ")}`,
        });
      }
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
 * Setzt Closure-Metadaten am PI: System-Demo-Datum, Inspect & Adapt-
 * Datum, Retrospektive-Notizen. Wird vom PI-Closure-Wizard pro Step
 * inkrementell aufgerufen — der Wizard speichert jede Eingabe sofort,
 * sodass ein Abbruch keinen Datenverlust bedeutet.
 */
export async function setPiClosureMeta(
  ctx: RequestContext,
  input: {
    id: PiId;
    systemDemoAt?: Date | null | undefined;
    inspectAdaptAt?: Date | null | undefined;
    retrospectiveNotes?: string | null | undefined;
  },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { id, systemDemoAt, inspectAdaptAt, retrospectiveNotes } = input;
  return withAuditedTransaction(mctx, async (tx) => {
    const existing = await tx.programIncrement.findFirst({
      where: { id, tenantId: mctx.tenantId },
    });
    if (!existing) {
      return err({ kind: "not_found" as const, resourceType: "ProgramIncrement", id });
    }
    const data: Record<string, unknown> = {};
    if (systemDemoAt !== undefined) data.systemDemoAt = systemDemoAt;
    if (inspectAdaptAt !== undefined) data.inspectAdaptAt = inspectAdaptAt;
    if (retrospectiveNotes !== undefined) {
      data.retrospectiveNotes = retrospectiveNotes;
      data.retrospectiveAt = retrospectiveNotes ? new Date() : null;
    }
    if (Object.keys(data).length === 0) {
      return ok({
        result: undefined,
        audit: {
          action: "pi.updated",
          resourceType: "program_increment",
          resourceId: id,
          changes: {},
        },
      });
    }
    await tx.programIncrement.update({ where: { id }, data });
    return ok({
      result: undefined,
      audit: {
        action: "pi.updated",
        resourceType: "program_increment",
        resourceId: id,
        changes: data as Record<string, unknown>,
      },
    });
  });
}

/**
 * Closure-Pre-Checks: jedes committed Objective hat eine Confidence
 * (1‒5), jedes offene/eskalierte Impediment ist ROAMed, System-Demo
 * + I&A sind terminiert, Retrospektive ist festgehalten. Liefert
 * eine Liste lesbarer Verstöße — leer = bereit für `completePi`.
 */
export async function evaluatePiClosure(
  db: PrismaClient,
  tenantId: TenantId,
  piId: PiId,
): Promise<{ ready: boolean; issues: string[] }> {
  const pi = await db.programIncrement.findFirst({
    where: { id: piId, tenantId },
    select: {
      id: true,
      systemDemoAt: true,
      inspectAdaptAt: true,
      retrospectiveNotes: true,
    },
  });
  if (!pi) return { ready: false, issues: ["PI nicht gefunden"] };

  const [uncommittedConfidence, openImpediments] = await Promise.all([
    db.piObjective.count({
      where: { tenantId, piId, committed: true, confidence: null },
    }),
    db.impediment.count({
      where: { tenantId, piId, status: { in: ["open", "escalated"] }, roamStatus: "open" },
    }),
  ]);

  const issues: string[] = [];
  if (uncommittedConfidence > 0) {
    issues.push(`${uncommittedConfidence} committed Objective(s) ohne Confidence-Bewertung`);
  }
  if (openImpediments > 0) {
    issues.push(`${openImpediments} offene Impediment(s) ohne ROAM-Status`);
  }
  if (!pi.systemDemoAt) issues.push("System-Demo-Termin fehlt");
  if (!pi.inspectAdaptAt) issues.push("Inspect & Adapt-Termin fehlt");
  if (!pi.retrospectiveNotes || pi.retrospectiveNotes.trim() === "") {
    issues.push("Retrospektive-Notizen fehlen");
  }
  return { ready: issues.length === 0, issues };
}

/** Completes an active PI. Erzwingt vorher die Closure-Pre-Checks. */
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

    if (existing.status !== "active") {
      return err({
        kind: "conflict" as const,
        reason: `Only an active PI can be completed (current status: ${existing.status})`,
      });
    }

    // Belt & suspenders: dieselben Checks wie der Wizard, serverseitig.
    const [uncommittedConfidence, openImpediments] = await Promise.all([
      tx.piObjective.count({
        where: { tenantId: mctx.tenantId, piId: id, committed: true, confidence: null },
      }),
      tx.impediment.count({
        where: {
          tenantId: mctx.tenantId,
          piId: id,
          status: { in: ["open", "escalated"] },
          roamStatus: "open",
        },
      }),
    ]);
    const issues: string[] = [];
    if (uncommittedConfidence > 0) {
      issues.push(`${uncommittedConfidence} committed Objective(s) ohne Confidence`);
    }
    if (openImpediments > 0) {
      issues.push(`${openImpediments} offene Impediment(s) ohne ROAM`);
    }
    if (!existing.systemDemoAt) issues.push("System-Demo-Termin fehlt");
    if (!existing.inspectAdaptAt) issues.push("Inspect & Adapt-Termin fehlt");
    if (!existing.retrospectiveNotes || existing.retrospectiveNotes.trim() === "") {
      issues.push("Retrospektive-Notizen fehlen");
    }
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
 * Delete a planned PI and cascade: assigned features return to the backlog
 * (piId → null), objectives are removed, and impediments are detached but
 * kept in the ART log.
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

    // Impediments are kept (ART-scoped) but detached from the PI.
    await tx.impediment.updateMany({
      where: { tenantId: mctx.tenantId, piId: id },
      data: { piId: null },
    });

    await tx.piObjective.deleteMany({ where: { tenantId: mctx.tenantId, piId: id } });
    await tx.programIncrement.delete({ where: { id } });

    return ok({
      result: undefined,
      audit: { action: "pi.deleted", resourceType: "program_increment", resourceId: id },
    });
  });
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
  const art = await db.art.findFirst({
    where: { id: artId, tenantId },
    select: { timelineId: true },
  });
  if (!art?.timelineId) {
    return { items: [], total: 0, page: 1, pageSize: pageParams.pageSize ?? 200 };
  }
  const where = { tenantId, timelineId: art.timelineId };
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
  const arts = await db.art.findMany({
    where: { id: { in: artIds }, tenantId, deletedAt: null, timelineId: { not: null } },
    select: { id: true, timelineId: true },
  });
  const timelineIds = [...new Set(arts.map((a) => a.timelineId!))];
  if (timelineIds.length === 0) return [];
  const rows = await db.programIncrement.findMany({
    where: { tenantId, timelineId: { in: timelineIds } },
    select: { id: true, name: true, timelineId: true, startDate: true },
    orderBy: { startDate: "desc" },
  });
  // Stamp each PI with one representative artId from the input list.
  const firstArtByTimeline = new Map<string, string>();
  for (const a of arts) {
    if (a.timelineId && !firstArtByTimeline.has(a.timelineId)) {
      firstArtByTimeline.set(a.timelineId, a.id);
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
  const art = await db.art.findFirst({
    where: { id: artId, tenantId },
    select: { timelineId: true },
  });
  if (!art?.timelineId) return [];
  return db.programIncrement.findMany({
    where: { tenantId, timelineId: art.timelineId },
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
