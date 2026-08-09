import { ok, err, type Result } from "@/domain/errors";
import { isRelatedWorkKind } from "@/modules/core/goals/domain/goal-related-work";
import { InitiativeLevel } from "@/domain/types";
import type { RequestContext } from "@/server/http/mutation-handler";
import {
  withAuditedTransaction,
  toMutationContext,
  onUniqueConstraint,
} from "@/modules/core/kernel/server/mutation";
import { notDeleted } from "@/server/db/soft-delete";

/**
 * Referenzielle „Related work"-Verknüpfung eines Ziels mit Feature/PI (Epic 5).
 * Kein Wertbeitrag — nur ein Deeplink. Epics laufen wertbringend über
 * `goal-epic-link.ts`. Gate `target.manage` in der Action.
 */
export async function addGoalRelatedWork(
  ctx: RequestContext,
  input: { objectiveId: string; kind: string; refId: string },
): Promise<Result<{ id: string }>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(
    mctx,
    async (tx) => {
      if (!isRelatedWorkKind(input.kind)) {
        return err({ kind: "validation" as const, issues: ["Ungültige Related-Work-Art."] });
      }
      const node = await tx.objective.findFirst({
        where: { id: input.objectiveId, tenantId: mctx.tenantId },
      });
      if (!node) {
        return err({
          kind: "not_found" as const,
          resourceType: "Objective",
          id: input.objectiveId,
        });
      }

      // Ref-Existenz prüfen (polymorph, keine harte FK).
      if (input.kind === "feature") {
        const f = await tx.initiative.findFirst({
          where: {
            id: input.refId,
            tenantId: mctx.tenantId,
            level: InitiativeLevel.FEATURE,
            ...notDeleted,
          },
        });
        if (!f) {
          return err({ kind: "not_found" as const, resourceType: "Initiative", id: input.refId });
        }
      } else {
        const pi = await tx.programIncrement.findFirst({
          where: { id: input.refId, tenantId: mctx.tenantId },
        });
        if (!pi) {
          return err({
            kind: "not_found" as const,
            resourceType: "ProgramIncrement",
            id: input.refId,
          });
        }
      }

      const row = await tx.goalRelatedWork.create({
        data: {
          tenantId: mctx.tenantId,
          objectiveId: input.objectiveId,
          kind: input.kind,
          refId: input.refId,
          createdBy: mctx.actorId,
        },
      });
      return ok({
        result: { id: row.id },
        audit: {
          action: "goal.related_work.added",
          resourceType: "goal_related_work",
          resourceId: row.id,
        },
      });
    },
    { onPrismaError: onUniqueConstraint("Diese Arbeit ist bereits verknüpft.") },
  );
}

export async function removeGoalRelatedWork(
  ctx: RequestContext,
  input: { objectiveId: string; kind: string; refId: string },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    await tx.goalRelatedWork.deleteMany({
      where: {
        tenantId: mctx.tenantId,
        objectiveId: input.objectiveId,
        kind: input.kind,
        refId: input.refId,
      },
    });
    return ok({
      result: undefined,
      audit: {
        action: "goal.related_work.removed",
        resourceType: "goal_related_work",
        resourceId: input.refId,
      },
    });
  });
}
