import type { Prisma } from "@/generated/prisma";
import { InitiativeLevel, type TenantId } from "@/modules/core/kernel/domain/types";
import type { Result } from "@/modules/core/kernel/domain/errors";
import { ok, err } from "@/modules/core/kernel/domain/errors";
import type { RequestContext } from "@/server/http/mutation-handler";
import {
  withAuditedTransaction,
  toMutationContext,
  onUniqueConstraint,
} from "@/modules/core/kernel/server/mutation";
import { isBvValue } from "@/modules/drumbeat/domain/pi-feedback";
import { writeBvActual } from "@/modules/drumbeat/server/services/feature-bv-actual";

/**
 * **PI-Feedback** — eine Runde je ART und PI, in der benannte Personen den
 * Business Value der abgeschlossenen Features bestätigen oder korrigieren.
 *
 * Anfragen und Übernehmen sind über die Action-Capabilities
 * (`pi.feedback.request` / `pi.feedback.apply`, ART-scoped) geschützt; hier
 * wird zusätzlich gegen die geladene Zeile geprüft, dass Runde, PI und ART
 * zusammengehören (ADR-0002). Antworten darf nur, wer in der Runde benannt
 * ist — das prüft allein dieser Service.
 */

type Tx = Prisma.TransactionClient;

const notFound = (resourceType: string, id: string) =>
  err({ kind: "not_found" as const, resourceType, id });
const conflict = (reason: string, values?: Record<string, string | number>) =>
  err({ kind: "conflict" as const, reason, ...(values ? { values } : {}) });

/**
 * Die gefragte Menge: die abgeschlossenen Features des ARTs im PI, wie sie
 * jetzt stehen. Nicht eingefroren — ein Feature, das nach der Anfrage fertig
 * wird, gehört dazu.
 */
export function completedFeaturesWhere(tenantId: string, piId: string, artId: string) {
  return {
    tenantId,
    level: InitiativeLevel.FEATURE,
    deletedAt: null,
    piId,
    artId,
    status: "completed",
  } satisfies Prisma.InitiativeWhereInput;
}

async function loadPiForArt(tx: Tx, tenantId: TenantId, piId: string, artId: string) {
  const [pi, art] = await Promise.all([
    tx.programIncrement.findFirst({
      where: { id: piId, tenantId },
      select: { id: true, name: true, status: true, timelineId: true, artId: true },
    }),
    tx.art.findFirst({
      where: { id: artId, tenantId, deletedAt: null },
      select: { id: true, timelineId: true },
    }),
  ]);
  if (!pi) return notFound("ProgramIncrement", piId);
  if (!art) return notFound("Art", artId);
  // Der PI gehört dem ART über dessen Taktung (oder, alt, direkt).
  const gehoert = pi.timelineId != null ? pi.timelineId === art.timelineId : pi.artId === art.id;
  if (!gehoert) return notFound("ProgramIncrement", piId);
  return ok(pi);
}

export interface RequestPiFeedbackInput {
  piId: string;
  artId: string;
  reviewerIds: readonly string[];
  dueDate: Date | null;
}

/**
 * Fordert Feedback an — oder ergänzt die offene Runde dieses ARTs und PIs um
 * weitere Personen (eine Frist ersetzt die alte). Nur beim laufenden oder
 * abgeschlossenen PI: ein geplanter hat noch nichts geliefert.
 */
export async function requestPiFeedback(
  ctx: RequestContext,
  input: RequestPiFeedbackInput,
): Promise<Result<{ requestId: string; added: number }>> {
  const mctx = toMutationContext(ctx);
  const reviewerIds = [...new Set(input.reviewerIds)];
  if (reviewerIds.length === 0) return conflict("drumbeat.feedback.errors.keinePerson");

  return withAuditedTransaction(
    mctx,
    async (tx) => {
      const pi = await loadPiForArt(tx, mctx.tenantId, input.piId, input.artId);
      if (!pi.ok) return pi;
      if (pi.value.status !== "active" && pi.value.status !== "completed") {
        return conflict("drumbeat.feedback.errors.piNochGeplant");
      }

      // Nur Personen des Mandanten.
      const bekannt = await tx.userRoleAssignment.findMany({
        where: { tenantId: mctx.tenantId, userId: { in: reviewerIds } },
        select: { userId: true },
        distinct: ["userId"],
      });
      if (bekannt.length !== reviewerIds.length) {
        return conflict("drumbeat.feedback.errors.unbekanntePerson");
      }

      const open = await tx.piFeedbackRequest.findFirst({
        where: { tenantId: mctx.tenantId, piId: input.piId, artId: input.artId, status: "open" },
        select: { id: true, dueDate: true },
      });
      const request =
        open ??
        (await tx.piFeedbackRequest.create({
          data: {
            tenantId: mctx.tenantId,
            piId: input.piId,
            artId: input.artId,
            dueDate: input.dueDate,
            requestedBy: mctx.actorId,
          },
          select: { id: true, dueDate: true },
        }));
      if (open && input.dueDate) {
        await tx.piFeedbackRequest.update({
          where: { id: open.id },
          data: { dueDate: input.dueDate },
        });
      }
      const created = await tx.piFeedbackReviewer.createMany({
        data: reviewerIds.map((userId) => ({
          tenantId: mctx.tenantId,
          requestId: request.id,
          userId,
          createdBy: mctx.actorId,
        })),
        skipDuplicates: true,
      });

      return ok({
        result: { requestId: request.id, added: created.count },
        audit: {
          action: "pi.feedback.requested" as const,
          resourceType: "program_increment" as const,
          resourceId: input.piId,
          changes: {
            artId: { before: null, after: input.artId },
            reviewers: { before: null, after: reviewerIds },
            dueDate: { before: null, after: input.dueDate?.toISOString().slice(0, 10) ?? null },
          },
        },
      });
    },
    { onPrismaError: onUniqueConstraint("drumbeat.feedback.errors.rundeLaeuftSchon") },
  );
}

export interface FeedbackAnswerInput {
  featureId: string;
  businessValue: number;
  comment: string | null;
}

/**
 * Die Antwort einer benannten Person. Sie ersetzt eine frühere Antwort
 * derselben Person vollständig — bis die Runde übernommen ist, darf sie
 * nachbessern.
 */
export async function submitPiFeedback(
  ctx: RequestContext,
  input: { requestId: string; answers: readonly FeedbackAnswerInput[] },
): Promise<Result<{ answered: number }>> {
  const mctx = toMutationContext(ctx);

  return withAuditedTransaction(mctx, async (tx) => {
    const request = await tx.piFeedbackRequest.findFirst({
      where: { id: input.requestId, tenantId: mctx.tenantId },
      select: { id: true, piId: true, artId: true, status: true },
    });
    if (!request) return notFound("PiFeedbackRequest", input.requestId);
    const reviewer = await tx.piFeedbackReviewer.findUnique({
      where: { requestId_userId: { requestId: request.id, userId: mctx.actorId } },
      select: { id: true },
    });
    // Wer nicht benannt ist, sieht die Runde nicht.
    if (!reviewer) return notFound("PiFeedbackRequest", input.requestId);
    if (request.status !== "open") return conflict("drumbeat.feedback.errors.schonUebernommen");

    const erlaubt = new Set(
      (
        await tx.initiative.findMany({
          where: completedFeaturesWhere(mctx.tenantId, request.piId, request.artId),
          select: { id: true },
        })
      ).map((f) => f.id),
    );
    for (const a of input.answers) {
      if (!erlaubt.has(a.featureId)) return conflict("drumbeat.feedback.errors.featureNichtDabei");
      if (!isBvValue(a.businessValue)) return conflict("drumbeat.feedback.errors.keinSkalenwert");
    }

    await tx.piFeedbackAnswer.deleteMany({ where: { reviewerId: reviewer.id } });
    await tx.piFeedbackAnswer.createMany({
      data: input.answers.map((a) => ({
        tenantId: mctx.tenantId,
        reviewerId: reviewer.id,
        featureId: a.featureId,
        businessValue: a.businessValue,
        comment: a.comment?.trim() || null,
      })),
    });
    await tx.piFeedbackReviewer.update({
      where: { id: reviewer.id },
      data: { status: "submitted", submittedAt: new Date() },
    });

    return ok({
      result: { answered: input.answers.length },
      audit: {
        action: "pi.feedback.submitted" as const,
        resourceType: "program_increment" as const,
        resourceId: request.piId,
        changes: { answers: { before: null, after: input.answers.length } },
      },
    });
  });
}

/**
 * **Übernehmen:** schreibt je Feature den Ist-Business-Value und den WSJF mit
 * Ist-Wert, je Feature ein Eintrag in dessen Historie, und schließt die Runde.
 * Ein Feature ohne Wert in `values` bleibt unverändert.
 */
export async function applyPiFeedback(
  ctx: RequestContext,
  input: {
    requestId: string;
    artId: string;
    values: readonly { featureId: string; businessValue: number }[];
  },
): Promise<Result<{ applied: number }>> {
  const mctx = toMutationContext(ctx);

  return withAuditedTransaction(mctx, async (tx) => {
    const request = await tx.piFeedbackRequest.findFirst({
      where: { id: input.requestId, tenantId: mctx.tenantId },
      select: { id: true, piId: true, artId: true, status: true },
    });
    // Die Capability galt dem ART aus der Eingabe — die Runde muss ihm gehören.
    if (!request || request.artId !== input.artId) {
      return notFound("PiFeedbackRequest", input.requestId);
    }
    if (request.status !== "open") return conflict("drumbeat.feedback.errors.schonUebernommen");

    const features = await tx.initiative.findMany({
      where: completedFeaturesWhere(mctx.tenantId, request.piId, request.artId),
      select: {
        id: true,
        wsjfBusinessValueActual: true,
        wsjfTimeCriticality: true,
        wsjfRiskReduction: true,
        wsjfJobSize: true,
      },
    });
    const byId = new Map(features.map((f) => [f.id, f]));
    for (const v of input.values) {
      if (!byId.has(v.featureId)) return conflict("drumbeat.feedback.errors.featureNichtDabei");
      if (!isBvValue(v.businessValue)) return conflict("drumbeat.feedback.errors.keinSkalenwert");
    }

    for (const v of input.values) {
      await writeBvActual(tx, mctx, byId.get(v.featureId)!, v.businessValue);
    }
    await tx.piFeedbackRequest.update({
      where: { id: request.id },
      data: { status: "applied", appliedBy: mctx.actorId, appliedAt: new Date() },
    });

    return ok({
      result: { applied: input.values.length },
      audit: {
        action: "pi.feedback.applied" as const,
        resourceType: "program_increment" as const,
        resourceId: request.piId,
        changes: { applied: { before: null, after: input.values.length } },
      },
    });
  });
}
