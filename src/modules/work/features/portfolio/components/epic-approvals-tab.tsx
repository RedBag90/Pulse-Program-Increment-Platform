"use client";

import { APPROVAL_PARTIES, type ApprovalParty } from "@/modules/work/domain/business-case";
import {
  partyStatus,
  type ApprovalPhase,
  type ApprovalViewModel,
} from "@/modules/work/domain/epic-approval";
import {
  SubmitHypothesisButton,
  SubmitBusinessCaseButton,
  ReviseBusinessCaseButton,
  StartRevisionButtons,
  ResetApprovalButton,
} from "./approval-controls";
import { Link } from "@/i18n/navigation";
import { ApproverPicker, type TenantApprover } from "./approver-picker";
import { userLabel } from "@/components/detail/initiative-labels";
import { SectionLabel } from "@/components/ui/section-label";

const PARTY_LABELS: Record<ApprovalParty, string> = {
  mgmt: "MGMT",
  business_owner: "Business Owner",
  finance: "Finance",
  irt_owner: "IRT-Owner",
  lace_vmo: "LACE/VMO",
};

const STATUS_BADGE: Record<string, string> = {
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
  pending: "bg-amber-100 text-amber-800",
  unassigned: "bg-muted text-muted-foreground",
};

const STATUS_LABEL: Record<string, string> = {
  approved: "erteilt",
  rejected: "abgelehnt",
  pending: "offen",
  unassigned: "—",
};

export interface ApprovalRow {
  id: string;
  revision: number;
  kind: string;
  party: string | null;
  section: string | null;
  approverUserId: string | null;
  status: string;
  decidedAt: Date | null;
  comment: string | null;
}

function Badge({ status }: { status: string }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs ${STATUS_BADGE[status] ?? STATUS_BADGE.unassigned}`}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

/**
 * Hypothese-Freigabe — eingebettet im „Business hypothesis done"-Phasen-Expander
 * der Timeline. Nur relevant, solange die Hypothese noch nicht durch ist; die
 * Entscheidung selbst trifft der Portfolio Manager in „Meine Freigaben".
 */
export function EpicHypothesisApproval({
  epicId,
  phase,
  canManage,
}: {
  epicId: string;
  phase: ApprovalPhase;
  canManage: boolean;
}) {
  if (phase === "draft") {
    return (
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Reiche die Benefit-Hypothese zur QS beim Portfolio Manager ein.
        </p>
        {canManage && <SubmitHypothesisButton epicId={epicId} />}
      </div>
    );
  }
  if (phase === "hypothesis_review") {
    return (
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Wartet auf Portfolio-Manager-Freigabe der Hypothese — die Entscheidung erfolgt in{" "}
          <Link href="/my-approvals" className="font-medium text-primary hover:underline">
            Meine Freigaben
          </Link>
          .
        </p>
        {canManage && (
          <div className="border-t pt-2">
            <ResetApprovalButton epicId={epicId} />
          </div>
        )}
      </div>
    );
  }
  return null;
}

interface BusinessCaseApprovalProps {
  epicId: string;
  phase: ApprovalPhase;
  /** The Epic's active approval revision. */
  revision: number;
  approvals: ApprovalRow[];
  /** Server-derived active-revision view (records, owner maps, counts). */
  approvalView: ApprovalViewModel;
  approvers: TenantApprover[];
  /** Resolved user-id → display label (email) map. */
  userLabels: Record<string, string>;
  currentUserId: string;
  canManage: boolean;
}

/**
 * Business-Case-/Stakeholder-Freigabe — eingebettet im „Business Case"-Phasen-
 * Expander der Timeline. Approver-Konfiguration, Einreichen, Freigabe-Übersicht
 * und Revisionen. Ohne Phasen-Stepper/-Banner: die Timeline zeigt den Lifecycle.
 */
export function EpicBusinessCaseApproval({
  epicId,
  phase,
  revision,
  approvals,
  approvalView,
  approvers,
  userLabels,
  currentUserId,
  canManage,
}: BusinessCaseApprovalProps) {
  // Live overview reflects the active revision; older rows are history. The
  // active-revision derivation (records, owner maps, counts) is owned by the
  // server view (`buildApprovalView`); the raw rows stay only for per-row
  // rendering (dates/comments/ids) and the archived past revisions.
  const currentApprovals = approvals.filter((a) => a.revision === revision);
  const pastApprovals = approvals.filter((a) => a.revision < revision);
  const pastRevisions = [...new Set(pastApprovals.map((a) => a.revision))].sort((x, y) => y - x);

  const {
    records,
    partyOwners: current,
    counts: { stakeholderRows, granted, blocked },
  } = approvalView;

  // Beim Konfigurieren zeigt der Picker bereits alle Parteien/Sektionen editierbar —
  // dann die read-only Übersicht ausblenden (sonst dieselbe Liste doppelt).
  const editable = phase === "business_case" && canManage;

  return (
    <div className="space-y-4">
      {/* Kopf: Phasen-Status (statt Banner/Stepper — den Lifecycle zeigt die Timeline). */}
      <div className="space-y-2">
        <SectionLabel>Freigaben · Revision {revision}</SectionLabel>

        {(phase === "draft" || phase === "hypothesis_review") && (
          <p className="text-xs text-muted-foreground">
            Zuerst muss die Hypothese freigegeben sein (Phase „Business hypothesis done").
          </p>
        )}
        {phase === "business_case" && !canManage && (
          <p className="text-xs text-muted-foreground">
            Approver werden konfiguriert, dann wird der Business Case eingereicht.
          </p>
        )}
        {phase === "stakeholder_review" &&
          (blocked ? (
            <div className="space-y-2 rounded-md border border-red-200 bg-red-50 p-3">
              <p className="text-xs text-red-800">
                Eine oder mehrere Freigaben wurden abgelehnt. Überarbeite den Business Case, um eine
                neue Freigaberunde zu starten.
              </p>
              {canManage && <ReviseBusinessCaseButton epicId={epicId} />}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Erteilt {granted} / {stakeholderRows} — wartet auf ausstehende Freigaben.
            </p>
          ))}
        {phase === "approved" && (
          <div className="space-y-2">
            <p className="text-xs text-emerald-600">Alle Freigaben erteilt — Epic freigegeben.</p>
            {canManage && (
              <div>
                <p className="mb-1 text-xs text-muted-foreground">
                  Inhalte überarbeiten und neuen Freigabe-Zyklus starten:
                </p>
                <StartRevisionButtons epicId={epicId} />
              </div>
            )}
          </div>
        )}

        {/* Mid-flight reset: der Epic Owner kann den laufenden Zyklus abbrechen. */}
        {canManage && (phase === "business_case" || phase === "stakeholder_review") && (
          <div className="border-t pt-2">
            <ResetApprovalButton epicId={epicId} />
          </div>
        )}
      </div>

      {/* Approver konfigurieren — nur in der Business-Case-Phase */}
      {editable && (
        <div className="space-y-3">
          <SectionLabel>Approver konfigurieren</SectionLabel>
          <ApproverPicker
            epicId={epicId}
            approvers={approvers}
            current={current}
            userLabels={userLabels}
          />
          <div className="pt-1">
            <SubmitBusinessCaseButton epicId={epicId} />
          </div>
        </div>
      )}

      {/* Übersicht (read-only) — nur wenn NICHT konfiguriert wird (sonst doppelt zum Picker).
          Parteien und Sektionen teilen sich dieselbe kompakte Zeilen-Form. */}
      {!editable && (
        <div className="space-y-2">
          <SectionLabel>Freigabe-Übersicht</SectionLabel>

          <div className="space-y-1.5">
            {/* Parteien (Mehrfach-Approver) */}
            {APPROVAL_PARTIES.map((party) => {
              const rows = currentApprovals.filter((a) => a.kind === "party" && a.party === party);
              const status = partyStatus(records, party);
              return (
                <div key={party} className="rounded-md border bg-card px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium">{PARTY_LABELS[party]}</span>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {rows.length === 0 && <span>kein Verantwortlicher</span>}
                      <Badge status={status} />
                    </div>
                  </div>
                  {rows.length > 0 && (
                    <ul className="mt-1.5 space-y-1">
                      {rows.map((r) => (
                        <li key={r.id} className="flex items-start justify-between gap-3 text-xs">
                          <div className="min-w-0">
                            <span className="font-medium">
                              {userLabel(r.approverUserId, userLabels)}
                            </span>{" "}
                            <Badge status={r.status} />
                            {r.decidedAt && (
                              <span className="ml-2 text-muted-foreground">
                                {new Date(r.decidedAt).toLocaleString("de-DE")}
                              </span>
                            )}
                            {r.comment && (
                              <p className="mt-0.5 text-muted-foreground">{r.comment}</p>
                            )}
                          </div>
                          {phase === "stakeholder_review" &&
                            r.status === "pending" &&
                            r.approverUserId === currentUserId && (
                              <Link
                                href="/my-approvals"
                                className="shrink-0 text-xs font-medium text-primary hover:underline"
                              >
                                In „Meine Freigaben" entscheiden →
                              </Link>
                            )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Frühere Revisionen (archiviert) */}
      {pastRevisions.length > 0 && (
        <div className="space-y-2">
          <SectionLabel>Frühere Revisionen</SectionLabel>
          {pastRevisions.map((rev) => (
            <details key={rev} className="rounded-md border bg-card px-3 py-2">
              <summary className="cursor-pointer text-sm font-medium">Revision {rev}</summary>
              <ul className="mt-2 space-y-1 text-xs">
                {pastApprovals
                  .filter((a) => a.revision === rev)
                  .map((r) => (
                    <li key={r.id} className="flex items-center gap-2">
                      <span className="w-28 shrink-0 text-muted-foreground">
                        {PARTY_LABELS[r.party as ApprovalParty] ?? r.kind}
                      </span>
                      {r.approverUserId && (
                        <span className="font-medium">
                          {userLabel(r.approverUserId, userLabels)}
                        </span>
                      )}
                      <Badge status={r.status} />
                      {r.decidedAt && (
                        <span className="text-muted-foreground">
                          {new Date(r.decidedAt).toLocaleString("de-DE")}
                        </span>
                      )}
                    </li>
                  ))}
              </ul>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
