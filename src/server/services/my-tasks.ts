import type { PrismaClient } from "@/generated/prisma";
import { InitiativeLevel } from "@/modules/core/kernel/domain/types";
import type { Principal } from "@/server/auth/principal";

/**
 * "Meine Tasks" — the personal ownership inbox. Surfaces every Epic and
 * Feature where the principal is the Owner (or an explicit assignee), split
 * into an open bucket (work to drive forward) and a recently-completed bucket
 * (last 30 days, terminal state) for quick reference. Sibling to
 * `listMyApprovals` — that one surfaces *decisions* the principal owes, this
 * one surfaces *items* they own.
 */

export type TaskLevel = "epic" | "feature";

export interface MyTaskRow {
  id: string;
  level: TaskLevel;
  title: string;
  href: string;
  /**
   * `open` is the active backlog; `ready` is the subset of Features that are
   * approved + assigned to a PI + whose parent Epic is in L4/L5 (i.e. one
   * click away from `in_progress`); `done` is the 30-day archive.
   */
  bucket: "open" | "ready" | "done";
  /** Epic: stageGate. Feature: status. */
  state: {
    stageGate?: string;
    status?: string;
  };
  context: {
    valueStreamName?: string | null;
    artName?: string | null;
    parentEpicTitle?: string | null;
    piName?: string | null;
  };
  /** IDs für die Filter-Facetten (Page-Model). Werte spiegeln `context.*`-Labels. */
  ids: {
    valueStreamId: string | null;
    artId: string | null;
    parentEpicId: string | null;
    piId: string | null;
  };
  updatedAt: Date;
}

/** Features in these statuses are considered done; Epics at L5 are done. */
const FEATURE_TERMINAL = new Set(["completed", "cancelled"]);
const DONE_WINDOW_DAYS = 30;

/**
 * Every Epic + Feature assigned to the principal — `ownerId === me` or
 * `assigneeIds` contains me. Open items always returned; done items only when
 * updated within the last 30 days, so the inbox stays handlungsorientiert.
 * One Prisma read, partitioned in application code.
 */
export async function listMyTasks(db: PrismaClient, principal: Principal): Promise<MyTaskRow[]> {
  const { id: userId, tenantId } = principal;

  const rows = await db.initiative.findMany({
    where: {
      tenantId,
      deletedAt: null,
      level: { in: [InitiativeLevel.EPIC, InitiativeLevel.FEATURE] },
      OR: [{ ownerId: userId }, { assigneeIds: { has: userId } }],
    },
    select: {
      id: true,
      level: true,
      title: true,
      status: true,
      stageGate: true,
      piId: true,
      artId: true,
      valueStreamId: true,
      updatedAt: true,
      valueStream: { select: { id: true, name: true } },
      art: { select: { id: true, name: true } },
      // Pull the parent Epic's stageGate so we can label a Feature as "ready"
      // exactly when it's one click from in_progress (Epic in L4/L5).
      parent: { select: { id: true, title: true, stageGate: true, valueStreamId: true } },
      pi: { select: { id: true, name: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const cutoff = new Date(Date.now() - DONE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const out: MyTaskRow[] = [];

  for (const r of rows) {
    const isEpic = r.level === InitiativeLevel.EPIC;
    const isDone = isEpic ? r.stageGate === "L5" : FEATURE_TERMINAL.has(r.status);

    // Hide stale completions — only keep the last 30 days of done items.
    if (isDone && r.updatedAt < cutoff) continue;

    // "Bereit zu starten": Features that satisfy every server-side precondition
    // of `startFeature`. Surface them in a dedicated bucket with an inline button.
    const isReady =
      !isEpic &&
      !isDone &&
      r.status === "approved" &&
      r.piId !== null &&
      (r.parent?.stageGate === "L4" || r.parent?.stageGate === "L5");

    const bucket: MyTaskRow["bucket"] = isDone ? "done" : isReady ? "ready" : "open";

    // Für Features ist Epic = parent → Wertstrom kommt vom Parent.
    const vsId = isEpic ? r.valueStreamId : (r.parent?.valueStreamId ?? null);
    out.push({
      id: r.id,
      level: isEpic ? "epic" : "feature",
      title: r.title,
      href: isEpic ? `/portfolio/epics/${r.id}` : `/feature/${r.id}`,
      bucket,
      state: isEpic ? { stageGate: r.stageGate } : { status: r.status },
      context: {
        valueStreamName: r.valueStream?.name ?? null,
        artName: r.art?.name ?? null,
        parentEpicTitle: isEpic ? null : (r.parent?.title ?? null),
        piName: isEpic ? null : (r.pi?.name ?? null),
      },
      ids: {
        valueStreamId: vsId,
        artId: r.artId,
        parentEpicId: isEpic ? null : (r.parent?.id ?? null),
        piId: r.piId,
      },
      updatedAt: r.updatedAt,
    });
  }

  return out;
}
