/**
 * **Die Verknuepfung Epic ↔ Solution.**
 *
 * Sie blieb in Work zurueck, als die Solution selbst nach Core zog (ADR-0022):
 * hier wird ein **Epic** autorisiert (`epic.update`), und ein Epic ist Arbeit.
 * Die Naht war schon vorher sichtbar — es ist die einzige Funktion der alten
 * Datei, die `loadAuthorizedEpic` brauchte.
 */

import type { Result } from "@/modules/core/kernel/domain/errors";
import { ok, err } from "@/modules/core/kernel/domain/errors";
import type { RequestContext } from "@/server/http/mutation-handler";
import { withAuditedTransaction, toMutationContext } from "@/modules/core/kernel/server/mutation";
import { notDeleted } from "@/server/db/soft-delete";
import { loadAuthorizedEpic } from "@/modules/work/server/services/epic-access";

/**
 * Setzt die Solution-Zuordnungen eines Epics (n:m) + die Primär-Solution. Alle
 * Solutions müssen im **Value Stream des Epics** liegen; die Primär muss im Set
 * enthalten sein (bzw. `null` bei leerem Set). Ersetzt den bestehenden Satz.
 */
export async function setEpicSolutions(
  ctx: RequestContext,
  input: { epicId: string; solutionIds: string[]; primarySolutionId: string | null },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { epicId } = input;
  // Duplikate raus.
  const solutionIds = [...new Set(input.solutionIds)];
  let primarySolutionId = input.primarySolutionId;

  return withAuditedTransaction(mctx, async (tx) => {
    const loaded = await loadAuthorizedEpic(tx, ctx.principal, mctx, {
      id: epicId,
      action: "epic.update",
      select: { id: true, valueStreamId: true },
    });
    if (!loaded.ok) return loaded;
    const epic = loaded.value;

    // Primär muss im Set liegen; leeres Set → keine Primär.
    if (solutionIds.length === 0) {
      primarySolutionId = null;
    } else if (primarySolutionId == null || !solutionIds.includes(primarySolutionId)) {
      // Erste als Primär, wenn keine gültige gewählt.
      primarySolutionId = solutionIds[0]!;
    }

    if (solutionIds.length > 0) {
      if (epic.valueStreamId == null) {
        return err({ kind: "conflict" as const, reason: "Epic hat keinen Value Stream." });
      }
      const valid = await tx.solution.findMany({
        where: {
          id: { in: solutionIds },
          tenantId: mctx.tenantId,
          valueStreamId: epic.valueStreamId,
          ...notDeleted,
        },
        select: { id: true },
      });
      if (valid.length !== solutionIds.length) {
        return err({
          kind: "conflict" as const,
          reason: "Alle Solutions müssen zum Value Stream des Epics gehören.",
        });
      }
    }

    // Satz ersetzen: alte Links weg, neue anlegen.
    await tx.epicSolution.deleteMany({ where: { epicId } });
    if (solutionIds.length > 0) {
      await tx.epicSolution.createMany({
        data: solutionIds.map((solutionId) => ({
          tenantId: mctx.tenantId,
          epicId,
          solutionId,
          createdBy: mctx.actorId,
        })),
      });
    }
    await tx.initiative.update({
      where: { id: epicId },
      data: { primarySolutionId, updatedBy: mctx.actorId },
    });

    return ok({
      result: undefined,
      audit: {
        action: "epic.solutions.set",
        resourceType: "initiative",
        resourceId: epicId,
        changes: { solutions: { before: null, after: solutionIds.length } },
      },
    });
  });
}
