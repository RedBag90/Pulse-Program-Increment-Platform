import { ok, err, type Result } from "@/modules/core/kernel/domain/errors";
import { checkEpicLink } from "@/domain/epic-link-invariant";
import { InitiativeLevel } from "@/modules/core/kernel/domain/types";
import type { RequestContext } from "@/server/http/mutation-handler";
import { authorizeResource } from "@/server/auth/authorize";
import { notDeleted } from "@/server/db/soft-delete";
import { withAuditedTransaction, toMutationContext } from "@/modules/core/kernel/server/mutation";

/**
 * Ziel ↔ Epic-Verknüpfungs-Service (Einheiten-Kaskade). Hängt ein Epic an einen
 * Ziel-Knoten (Objective) — optional über eine gewählte KPI samt Umrechnungsfaktor
 * (Ziel-Einheit je 1 KPI-Einheit). Ein Epic kann mehrere Ziele treiben; jede
 * Verknüpfung ist ein eigener (epicId, objectiveId)-Datensatz.
 *
 * Nutzt `kpi.bind` als Capability. Count-once auf **KPI-Ebene**:
 *  1. Validator `checkEpicLink` (pure) — Konflikt, falls die gewählte KPI schon
 *     ein anderes Ziel treibt; muss zum Epic gehören; Faktor erforderlich.
 *  2. Dieser Service — per-Epic advisory transaction lock *vor* dem Laden.
 *  3. DB-Backstop `UNIQUE(kpiId)` + `UNIQUE(epicId, objectiveId)` auf `goal_epic_links`.
 *
 * Permission wird gemäß ADR-0002 *nach* dem Load der Ziel-Rows geprüft.
 */
export interface EpicLinkInput {
  epicId: string;
  objectiveId: string;
  /** Gewählte Erfolgs-KPI; null/undefined = Alt-€-Ganz-Epic-Link. */
  kpiId?: string | null;
  conversionFactor?: number | null;
  /** "one_time" | "recurring" (Default recurring). */
  impactKind?: string;
  /** "monthly" | "yearly" (Default yearly). */
  recurringInterval?: string;
}

export async function linkEpicToGoal(
  ctx: RequestContext,
  input: EpicLinkInput,
): Promise<Result<{ epicId: string }>> {
  return applyEpicLink(ctx, input.epicId, input.objectiveId, {
    kpiId: input.kpiId ?? null,
    conversionFactor: input.conversionFactor ?? null,
    impactKind: input.impactKind ?? "recurring",
    recurringInterval: input.recurringInterval ?? "yearly",
  });
}

export async function unlinkEpicFromGoal(
  ctx: RequestContext,
  input: { epicId: string; objectiveId: string },
): Promise<Result<{ epicId: string }>> {
  return applyEpicLink(ctx, input.epicId, input.objectiveId, null);
}

interface LinkFields {
  kpiId: string | null;
  conversionFactor: number | null;
  impactKind: string;
  recurringInterval: string;
}

async function applyEpicLink(
  ctx: RequestContext,
  epicId: string,
  objectiveId: string,
  fields: LinkFields | null,
): Promise<Result<{ epicId: string }>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    // Per-epic advisory transaction lock — serializes concurrent link/unlink of
    // the same epic so competing writes see each other's commit and fail
    // deterministically rather than tripping a UNIQUE backstop.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${epicId})::int8)`;

    const existing = await tx.goalEpicLink.findFirst({
      where: { tenantId: mctx.tenantId, epicId, objectiveId },
    });

    // Count-once auf KPI-Ebene: nur die GEWÄHLTE KPI prüfen.
    const chosenKpiId = fields?.kpiId ?? null;
    let chosenKpiLinkedElsewhere = false;
    let chosenKpiBelongsToEpic = false;
    if (chosenKpiId) {
      chosenKpiLinkedElsewhere =
        (await tx.goalEpicLink.count({
          where: {
            tenantId: mctx.tenantId,
            kpiId: chosenKpiId,
            NOT: { epicId, objectiveId },
          },
        })) > 0;
      chosenKpiBelongsToEpic =
        (await tx.kpi.count({
          where: { id: chosenKpiId, tenantId: mctx.tenantId, initiativeId: epicId },
        })) > 0;
    }

    const planResult = checkEpicLink({
      target: fields
        ? { objectiveId, kpiId: chosenKpiId, conversionFactor: fields.conversionFactor }
        : null,
      existing: existing ? { kpiId: existing.kpiId } : null,
      chosenKpiLinkedElsewhere,
      chosenKpiBelongsToEpic,
    });
    if (!planResult.ok) return planResult;
    const plan = planResult.value;

    switch (plan.kind) {
      case "noop": {
        return ok({
          result: { epicId },
          audit: {
            action: "goal.epic.unlinked" as const,
            resourceType: "goal_epic_link" as const,
            resourceId: existing?.id ?? epicId,
          },
        });
      }
      case "delete": {
        const authz = authorizeResource(ctx.principal, "kpi.bind", { tenantId: mctx.tenantId });
        if (!authz.ok) return authz;
        await tx.goalEpicLink.delete({ where: { id: existing!.id } });
        // „Kein Wert ohne Verknüpfung": die Bewertung lebt am Link, also beim
        // Entlinken die €-Bewertung der KPI leeren (valuePerUnit → null).
        if (existing!.kpiId) {
          await tx.kpi.update({
            where: { id: existing!.kpiId },
            data: { valuePerUnit: null },
          });
        }
        return ok({
          result: { epicId },
          audit: {
            action: "goal.epic.unlinked" as const,
            resourceType: "goal_epic_link" as const,
            resourceId: existing!.id,
          },
        });
      }
      case "create":
      case "update": {
        const f = fields!; // non-null on create/update
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
        const node = await tx.objective.findFirst({
          where: { id: objectiveId, tenantId: mctx.tenantId },
        });
        if (!node) {
          return err({ kind: "not_found" as const, resourceType: "Objective", id: objectiveId });
        }

        const authz = authorizeResource(ctx.principal, "kpi.bind", { tenantId: mctx.tenantId });
        if (!authz.ok) return authz;

        const data = {
          kpiId: f.kpiId,
          conversionFactor: f.conversionFactor,
          impactKind: f.impactKind,
          recurringInterval: f.recurringInterval,
        };
        const row =
          plan.kind === "update"
            ? await tx.goalEpicLink.update({ where: { id: existing!.id }, data })
            : await tx.goalEpicLink.create({
                data: {
                  tenantId: mctx.tenantId,
                  objectiveId,
                  epicId,
                  createdBy: mctx.actorId,
                  ...data,
                },
              });

        // Die Nutzenbewertung wird ausschließlich am Ziel-Link gepflegt und in die
        // gewählte KPI zurückgeschrieben (die ~35 €-Ökonomie-Verbraucher lesen weiter
        // KPI.valuePerUnit). €-Wert nur bei €-Zielen: bei Nicht-€-Zielen (NPS/%) bleibt
        // valuePerUnit leer — der strategische Effekt erscheint in den Nutzen-Kacheln.
        if (f.kpiId) {
          await tx.kpi.update({
            where: { id: f.kpiId },
            data: {
              benefitKind: f.impactKind,
              recurringInterval: f.recurringInterval,
              valuePerUnit: node.metricType === "currency" ? f.conversionFactor : null,
            },
          });
        }
        // Wechselte die gewählte KPI (Update mit anderem kpiId), die alte entwerten.
        if (plan.kind === "update" && existing!.kpiId && existing!.kpiId !== f.kpiId) {
          await tx.kpi.update({
            where: { id: existing!.kpiId },
            data: { valuePerUnit: null },
          });
        }
        return ok({
          result: { epicId },
          audit: {
            action: "goal.epic.linked" as const,
            resourceType: "goal_epic_link" as const,
            resourceId: row.id,
          },
        });
      }
    }
  });
}
