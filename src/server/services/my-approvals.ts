import type { PrismaClient } from "@/generated/prisma";
import { InitiativeLevel } from "@/domain/types";
import type { Principal } from "@/server/auth/principal";
import type { ApprovalParty } from "@/domain/business-case";
import type { ApprovalSection } from "@/domain/epic-approval";
import { listFeaturesInReview } from "@/server/services/initiative-review";

/**
 * "Meine Freigaben" — the personal approval inbox. Aggregates every pending
 * approval assigned to the current principal across the four sources in the
 * app (Feature QS, Epic Hypothesis, Epic Party, Epic Section) into a single
 * normalised row shape. Each row carries enough context to render the inbox
 * and route the decide-action to the correct backend service.
 */

export type ApprovalKind = "feature_qs" | "epic_hypothesis" | "epic_party" | "epic_section";

export interface MyApprovalRow {
  /** Stable row id — `EpicApproval.id` for kinds 3/4, `<kind>:<entityId>` for kinds 1/2. */
  id: string;
  kind: ApprovalKind;
  title: string;
  href: string;
  context: {
    parentTitle?: string | null;
    artName?: string | null;
    valueStreamName?: string | null;
    party?: ApprovalParty | undefined;
    section?: ApprovalSection | undefined;
  };
  /** The id needed to dispatch the decide-action (feature.id / epic.id / approval.id). */
  target: { featureId?: string; epicId?: string; approvalId?: string; section?: ApprovalSection };
  requestedAt: Date;
}

/**
 * Every pending approval assigned to the principal — across all four sources —
 * sorted newest request first. Runs the four reads in parallel; uses the existing
 * `(approver_user_id, status)` index for kinds 3/4.
 */
export async function listMyApprovals(
  db: PrismaClient,
  principal: Principal,
): Promise<MyApprovalRow[]> {
  const { id: userId, tenantId, roles, scopes } = principal;
  const isRte = roles.includes("rte");
  const isAdmin = roles.includes("tenant_admin") || roles.includes("platform_admin");
  const isVmo = roles.includes("vmo");

  // Mirrors the gating on the Epic detail page (Approvals tab): admins decide
  // anywhere; a VMO decides hypotheses in their value streams *or*, if no value
  // stream has them pinned, in any value stream (matches the role-only policy
  // gate so the inbox doesn't go silent on misconfiguration).
  const hypothesisWhere = isAdmin
    ? { tenantId, level: InitiativeLevel.EPIC, deletedAt: null, approvalPhase: "hypothesis_review" }
    : isVmo
      ? {
          tenantId,
          level: InitiativeLevel.EPIC,
          deletedAt: null,
          approvalPhase: "hypothesis_review",
          valueStream: { vmoId: userId, deletedAt: null },
        }
      : null;

  const [featureQs, hypothesis, partyAndSection] = await Promise.all([
    // 1) Feature QS — only relevant if the principal is an RTE (or admin), with
    //    optional ART scope (empty scopes.artIds = all ARTs in the tenant).
    isRte || isAdmin
      ? listFeaturesInReview(db, tenantId, scopes.artIds.length > 0 ? scopes.artIds : undefined)
      : Promise.resolve([]),

    // 2) Epic hypothesis — VMO of the value stream, or admin.
    hypothesisWhere
      ? db.initiative.findMany({
          where: hypothesisWhere,
          select: {
            id: true,
            title: true,
            updatedAt: true,
            valueStream: { select: { id: true, name: true } },
          },
          orderBy: { updatedAt: "desc" },
        })
      : Promise.resolve(
          [] as Array<{
            id: string;
            title: string;
            updatedAt: Date;
            valueStream: { id: string; name: string } | null;
          }>,
        ),

    // 3 + 4) Epic party approvals and section sign-offs — assigned to me, pending,
    //        joined to the Epic's current revision.
    db.epicApproval.findMany({
      where: {
        tenantId,
        approverUserId: userId,
        status: "pending",
        initiative: { deletedAt: null, level: InitiativeLevel.EPIC },
      },
      select: {
        id: true,
        kind: true,
        party: true,
        section: true,
        revision: true,
        requestedAt: true,
        initiative: {
          select: {
            id: true,
            title: true,
            approvalRevision: true,
            approvalPhase: true,
            valueStream: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { requestedAt: "desc" },
    }),
  ]);

  const rows: MyApprovalRow[] = [];

  for (const f of featureQs) {
    rows.push({
      id: `feature_qs:${f.id}`,
      kind: "feature_qs",
      title: f.title,
      href: f.href,
      context: {
        parentTitle: f.parentTitle,
        artName: f.art?.name ?? null,
      },
      target: { featureId: f.id },
      // listFeaturesInReview doesn't expose a request timestamp; fall back to now()
      // for ordering. Real time-since data would need the initiative's updatedAt.
      requestedAt: new Date(),
    });
  }

  for (const h of hypothesis) {
    rows.push({
      id: `epic_hypothesis:${h.id}`,
      kind: "epic_hypothesis",
      title: h.title,
      href: `/epic/${h.id}`,
      context: {
        valueStreamName: h.valueStream?.name ?? null,
      },
      target: { epicId: h.id },
      requestedAt: h.updatedAt,
    });
  }

  for (const a of partyAndSection) {
    // Only surface rows that belong to the Epic's *current* revision (and an
    // approval-decidable phase). Older revisions are historical and not actionable.
    const epic = a.initiative;
    if (!epic) continue;
    const currentRevision = epic.approvalRevision ?? 1;
    if (a.revision !== currentRevision) continue;
    if (epic.approvalPhase !== "stakeholder_review") continue;

    if (a.kind === "party" && a.party) {
      rows.push({
        id: a.id,
        kind: "epic_party",
        title: epic.title,
        href: `/epic/${epic.id}`,
        context: {
          valueStreamName: epic.valueStream?.name ?? null,
          party: a.party as ApprovalParty,
        },
        target: { approvalId: a.id },
        requestedAt: a.requestedAt,
      });
    } else if (a.kind === "section" && a.section) {
      rows.push({
        id: a.id,
        kind: "epic_section",
        title: epic.title,
        href: `/epic/${epic.id}`,
        context: {
          valueStreamName: epic.valueStream?.name ?? null,
          section: a.section as ApprovalSection,
        },
        target: { epicId: epic.id, section: a.section as ApprovalSection },
        requestedAt: a.requestedAt,
      });
    }
  }

  rows.sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime());
  return rows;
}
