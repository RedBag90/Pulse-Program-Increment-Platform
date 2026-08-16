import type { PrismaClient } from "@/generated/prisma";
import { InitiativeLevel } from "@/modules/core/kernel/domain/types";
import type { Principal } from "@/server/auth/principal";
import type { ApprovalParty } from "@/modules/work/domain/business-case";
import type { ApprovalSection } from "@/modules/work/domain/epic-approval";
/**
 * "Meine Freigaben" — the personal approval inbox. Aggregates every pending
 * Epic approval assigned to the current principal (Hypothesis, Party,
 * Section) into a single normalised row shape. Feature-QS war hier 2026-06
 * mit der Abschaffung des Feature-QA-Gates entfernt; Features brauchen
 * keine Freigabe mehr.
 */

export type ApprovalKind = "epic_hypothesis" | "epic_party" | "epic_section";

/** The fields every approval row carries, regardless of kind. */
interface MyApprovalRowBase {
  /** Stable row id — `EpicApproval.id` for party/section, `<kind>:<entityId>` for hypothesis. */
  id: string;
  title: string;
  href: string;
  context: {
    parentTitle?: string | null;
    artName?: string | null;
    valueStreamName?: string | null;
    party?: ApprovalParty | undefined;
    section?: ApprovalSection | undefined;
  };
  requestedAt: Date;
}

/**
 * A pending approval in the personal inbox, discriminated on `kind`: each kind
 * carries exactly the `target` ids its decide-action needs — so consumers narrow
 * on `kind` instead of asserting optional fields non-null.
 */
export type MyApprovalRow = MyApprovalRowBase &
  (
    | { kind: "epic_hypothesis"; target: { epicId: string } }
    | { kind: "epic_party"; target: { approvalId: string } }
    | { kind: "epic_section"; target: { epicId: string; section: ApprovalSection } }
  );

/**
 * Every pending approval assigned to the principal — across all four sources —
 * sorted newest request first. Runs the four reads in parallel; uses the existing
 * `(approver_user_id, status)` index for kinds 3/4.
 */
export async function listMyApprovals(
  db: PrismaClient,
  principal: Principal,
): Promise<MyApprovalRow[]> {
  const { id: userId, tenantId, roles } = principal;
  const isAdmin = roles.includes("tenant_admin") || roles.includes("platform_admin");
  const isReviewer = roles.includes("portfolio_manager");

  // Mirrors the gating on the Epic detail page (Approvals tab): admins decide
  // anywhere; a Portfolio Manager (the VS's pinned reviewer, formerly "VMO")
  // decides hypotheses in the value streams they're pinned on via `vmoId`.
  const hypothesisWhere = isAdmin
    ? { tenantId, level: InitiativeLevel.EPIC, deletedAt: null, approvalPhase: "hypothesis_review" }
    : isReviewer
      ? {
          tenantId,
          level: InitiativeLevel.EPIC,
          deletedAt: null,
          approvalPhase: "hypothesis_review",
          valueStream: { vmoId: userId, deletedAt: null },
        }
      : null;

  const [hypothesis, partyAndSection] = await Promise.all([
    // 1) Epic hypothesis — Portfolio Manager of the value stream, or admin.
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

    // 2 + 3) Epic party approvals and section sign-offs — assigned to me, pending,
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

  for (const h of hypothesis) {
    rows.push({
      id: `epic_hypothesis:${h.id}`,
      kind: "epic_hypothesis",
      title: h.title,
      href: `/portfolio/epics/${h.id}?tab=benefit-hypothesis`,
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
        href: `/portfolio/epics/${epic.id}?tab=business-case`,
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
        href: `/portfolio/epics/${epic.id}?tab=${a.section}`,
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
