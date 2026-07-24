import { ok, err, type Result } from "@/domain/errors";
import { checkEpicLink, type GoalLinkTarget } from "@/domain/epic-link-invariant";
import { InitiativeLevel } from "@/domain/types";
import type { RequestContext } from "@/server/http/mutation-handler";
import { authorizeResource } from "@/server/auth/authorize";
import { notDeleted } from "@/server/db/soft-delete";
import { withAuditedTransaction, toMutationContext } from "@/server/services/mutation";

/**
 * Ziel ↔ Epic-Verknüpfungs-Service ("Related work"). Hängt ein Epic direkt an
 * einen Ziel-Knoten (Objective ODER Key Result); der von den Epic-KPIs
 * bestimmte Mehrwert rollt danach in den Ziel-Trio (goals-rollup `epicLinkTrio`).
 *
 * Nutzt `kpi.bind` als Capability (dieselbe „Wert an ein Ziel hängen"-
 * Verantwortung wie die KPI-Bindung). Drei Durchsetzungs-Seams für die
 * Count-once-Invariante (spiegelt `kpi-binding.ts`):
 *  1. Validator `checkEpicLink` (pure) — Konflikt, falls KPIs des Epics schon
 *     einzeln via `KrKpiContribution` gebunden sind.
 *  2. Dieser Service — per-Epic advisory transaction lock *vor* dem Laden, damit
 *     zwei konkurrierende Verknüpfungen desselben Epics deterministisch statt am
 *     `UNIQUE(epicId)` scheitern.
 *  3. DB-Backstop `UNIQUE(epicId)` auf `goal_epic_links`.
 *
 * Permission wird gemäß ADR-0002 *nach* dem Load der Ziel-Rows geprüft.
 */
export interface EpicLinkTargetInput {
  /** Genau eine von beiden gesetzt. */
  objectiveId?: string | null;
  keyResultId?: string | null;
}

export async function linkEpicToGoal(
  ctx: RequestContext,
  input: { epicId: string } & EpicLinkTargetInput,
): Promise<Result<{ epicId: string }>> {
  return applyEpicLink(ctx, input.epicId, {
    objectiveId: input.objectiveId ?? null,
    keyResultId: input.keyResultId ?? null,
  });
}

export async function unlinkEpicFromGoal(
  ctx: RequestContext,
  input: { epicId: string },
): Promise<Result<{ epicId: string }>> {
  return applyEpicLink(ctx, input.epicId, null);
}

async function applyEpicLink(
  ctx: RequestContext,
  epicId: string,
  target: GoalLinkTarget | null,
): Promise<Result<{ epicId: string }>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    // Per-epic advisory transaction lock — serializes concurrent link/unlink of
    // the same epic so the second comer sees the first's commit and is rejected
    // deterministically rather than tripping the UNIQUE(epicId) backstop.
    // $executeRaw (nicht $queryRaw): pg_advisory_xact_lock liefert `void`, das
    // $queryRaw als Ergebnis-Spalte nicht deserialisieren kann.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${epicId})::int8)`;

    const existing = await tx.goalEpicLink.findFirst({
      where: { tenantId: mctx.tenantId, epicId },
    });

    // Count-once: how many of this epic's KPIs are already individually KR-bound.
    const boundKpiCount = await tx.krKpiContribution.count({
      where: { tenantId: mctx.tenantId, kpi: { initiativeId: epicId } },
    });

    const planResult = checkEpicLink({
      epicId,
      target,
      existing: existing ? { epicId, objectiveId: existing.objectiveId, keyResultId: null } : null,
      boundKpiCount,
    });
    if (!planResult.ok) return planResult;
    const plan = planResult.value;

    switch (plan.kind) {
      case "noop": {
        return ok({
          result: { epicId },
          audit: {
            action: target ? ("goal.epic.linked" as const) : ("goal.epic.unlinked" as const),
            resourceType: "goal_epic_link" as const,
            resourceId: existing?.id ?? epicId,
          },
        });
      }
      case "delete": {
        const authz = authorizeResource(ctx.principal, "kpi.bind", { tenantId: mctx.tenantId });
        if (!authz.ok) return authz;
        await tx.goalEpicLink.delete({ where: { id: existing!.id } });
        return ok({
          result: { epicId },
          audit: {
            action: "goal.epic.unlinked" as const,
            resourceType: "goal_epic_link" as const,
            resourceId: existing!.id,
          },
        });
      }
      case "rebind":
      case "create": {
        // target is non-null on create/rebind (validator guarantees it).
        const t = target!;
        // Validate the epic is a live EPIC in this tenant.
        const epic = await tx.initiative.findFirst({
          where: {
            id: epicId,
            tenantId: mctx.tenantId,
            level: InitiativeLevel.EPIC,
            ...notDeleted,
          },
        });
        if (!epic) {
          return err({ kind: "not_found" as const, resourceType: "Initiative", id: epicId });
        }
        // Ziel-Knoten (Goal-Knoten-Vereinheitlichung): jeder Ziel-Knoten ist ein
        // Objective; die Ziel-id kommt als objectiveId (oder alt keyResultId).
        const nodeId = t.objectiveId ?? t.keyResultId;
        if (!nodeId) {
          return err({
            kind: "validation" as const,
            issues: ["Ziel-Knoten fehlt: objectiveId muss gesetzt sein."],
          });
        }
        const node = await tx.objective.findFirst({
          where: { id: nodeId, tenantId: mctx.tenantId },
        });
        if (!node) {
          return err({ kind: "not_found" as const, resourceType: "Objective", id: nodeId });
        }

        const authz = authorizeResource(ctx.principal, "kpi.bind", { tenantId: mctx.tenantId });
        if (!authz.ok) return authz;

        if (plan.kind === "rebind") {
          await tx.goalEpicLink.delete({ where: { id: existing!.id } });
        }
        const created = await tx.goalEpicLink.create({
          data: {
            tenantId: mctx.tenantId,
            objectiveId: nodeId,
            epicId,
            createdBy: mctx.actorId,
          },
        });
        return ok({
          result: { epicId },
          audit: {
            action: "goal.epic.linked" as const,
            resourceType: "goal_epic_link" as const,
            resourceId: created.id,
          },
        });
      }
    }
  });
}
