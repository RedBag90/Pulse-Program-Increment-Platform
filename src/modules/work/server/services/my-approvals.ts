import type { PrismaClient } from "@/generated/prisma";
import { InitiativeLevel } from "@/modules/core/kernel/domain/types";
import type { Principal } from "@/server/auth/principal";
import type { StageGate } from "@/modules/core/kernel/domain/types";
import { GATE_APPROVER_ROLE_LABELS, isGateApproverRole } from "@/modules/work/domain/gate-policy";

/**
 * „Meine Freigaben" — der persönliche Posteingang.
 *
 * Er hatte einmal vier Arme: Feature-QS, Hypothesen-Freigabe,
 * Business-Case-Parteien und Reifegrad-Abnahmen. Übrig ist einer. Die
 * Feature-QS fiel 2026-06 mit dem Feature-QA-Gate; Hypothese und Business Case
 * sind in die Reifegrad-Schritte L0 → L1 bzw. L2 → L3.1 aufgegangen — die
 * Abnahme dieser Schritte *ist* die inhaltliche Freigabe. Damit ist jede
 * Entscheidung, die hier landet, eine Gate-Abnahme.
 */

export type ApprovalKind = "epic_gate";

/** Die Felder, die jede Zeile trägt. */
interface MyApprovalRowBase {
  /** Stabile Zeilen-Id — die `StageGateApproval.id`. */
  id: string;
  title: string;
  href: string;
  context: {
    parentTitle?: string | null;
    artName?: string | null;
    valueStreamName?: string | null;
    /** Welcher Reifegrad-Wechsel abgenommen werden soll. */
    fromGate?: StageGate | undefined;
    toGate?: StageGate | undefined;
    /** Wofür ich zeichne („Business Owner", „Finance", …), sofern benannt. */
    roleLabel?: string | undefined;
  };
  requestedAt: Date;
}

/**
 * Eine offene Freigabe im Posteingang. Die Union hat heute nur ein Glied; sie
 * bleibt discriminated, damit `target` die Ids trägt, die die Entscheid-Action
 * braucht, und ein zweiter Arm ohne Umbau danebenpasst.
 */
export type MyApprovalRow = MyApprovalRowBase & {
  kind: "epic_gate";
  target: { transitionId: string };
};

/**
 * Alle offenen Abnahmen des Principals, neueste Anfrage zuerst. Läuft über den
 * `(approver_user_id, status)`-Index auf `stage_gate_approvals`.
 */
export async function listMyApprovals(
  db: PrismaClient,
  principal: Principal,
): Promise<MyApprovalRow[]> {
  const { id: userId, tenantId } = principal;

  const gateApprovals = await db.stageGateApproval.findMany({
    where: {
      tenantId,
      approverUserId: userId,
      status: "pending",
      transition: {
        status: "pending",
        initiative: { deletedAt: null, level: InitiativeLevel.EPIC },
      },
    },
    select: {
      id: true,
      role: true,
      requestedAt: true,
      transition: {
        select: {
          id: true,
          fromGate: true,
          toGate: true,
          initiative: {
            select: { id: true, title: true, valueStream: { select: { name: true } } },
          },
        },
      },
    },
    orderBy: { requestedAt: "desc" },
  });

  const rows: MyApprovalRow[] = gateApprovals.map((g) => {
    const epic = g.transition.initiative;
    const roleLabel =
      g.role && isGateApproverRole(g.role) ? GATE_APPROVER_ROLE_LABELS[g.role] : undefined;
    return {
      id: g.id,
      kind: "epic_gate" as const,
      title: epic.title,
      href: `/portfolio/epics/${epic.id}?tab=timeline`,
      context: {
        valueStreamName: epic.valueStream?.name ?? null,
        fromGate: g.transition.fromGate as StageGate,
        toGate: g.transition.toGate as StageGate,
        ...(roleLabel !== undefined && { roleLabel }),
      },
      target: { transitionId: g.transition.id },
      requestedAt: g.requestedAt,
    };
  });

  rows.sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime());
  return rows;
}
