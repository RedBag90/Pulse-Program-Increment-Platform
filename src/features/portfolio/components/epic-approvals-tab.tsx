import { APPROVAL_PARTIES, type ApprovalParty } from "@/domain/business-case";
import {
  APPROVAL_SECTIONS,
  partyStatus,
  sectionStatus,
  configuredParties,
  hasRejection,
  type ApprovalPhase,
  type ApprovalRecord,
  type ApprovalSection,
} from "@/domain/epic-approval";
import {
  SubmitHypothesisButton,
  DecideHypothesisButtons,
  SubmitBusinessCaseButton,
  ReviseBusinessCaseButton,
  ApprovalDecisionButtons,
  SectionSignoffButtons,
  StartRevisionButtons,
} from "./approval-controls";
import { ApproverPicker, type TenantApprover } from "./approver-picker";
import { PhaseStepper } from "./phase-stepper";
import { APPROVAL_PHASE_LABELS, userLabel } from "@/components/detail/initiative-labels";

const PHASE_LABELS = APPROVAL_PHASE_LABELS;

const PARTY_LABELS: Record<ApprovalParty, string> = {
  mgmt: "MGMT",
  business_owner: "Business Owner",
  finance: "Finance",
  irt_owner: "IRT-Owner",
  lace_vmo: "LACE/VMO",
};

const SECTION_LABELS: Record<ApprovalSection, string> = {
  breakdown: "Breakdown",
  kpis: "KPIs",
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

interface Props {
  epicId: string;
  phase: ApprovalPhase;
  /** The Epic's active approval revision. */
  revision: number;
  approvals: ApprovalRow[];
  approvers: TenantApprover[];
  /** Resolved user-id → display label (email) map. */
  userLabels: Record<string, string>;
  currentUserId: string;
  canManage: boolean;
  canDecideHypothesis: boolean;
  /** Value-stream defaults that pre-fill an as-yet-unconfigured Epic. */
  defaultFinanceApproverId?: string | null;
  defaultVmoId?: string | null;
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

export function EpicApprovalsTab({
  epicId,
  phase,
  revision,
  approvals,
  approvers,
  userLabels,
  currentUserId,
  canManage,
  canDecideHypothesis,
  defaultFinanceApproverId,
  defaultVmoId,
}: Props) {
  // Live overview reflects the active revision; older rows are history.
  const currentApprovals = approvals.filter((a) => a.revision === revision);
  const pastApprovals = approvals.filter((a) => a.revision < revision);
  const pastRevisions = [...new Set(pastApprovals.map((a) => a.revision))].sort((x, y) => y - x);

  const records: ApprovalRecord[] = currentApprovals.map((a) => ({
    kind: a.kind === "section" ? "section" : "party",
    party: a.party as ApprovalParty | null,
    section: a.section as ApprovalSection | null,
    status: a.status as ApprovalRecord["status"],
  }));

  const current: Record<ApprovalParty, string[]> = {} as Record<ApprovalParty, string[]>;
  for (const p of APPROVAL_PARTIES) {
    current[p] = currentApprovals
      .filter((a) => a.kind === "party" && a.party === p && a.approverUserId)
      .map((a) => a.approverUserId as string);
  }
  // Pre-fill the Finance party from the value stream when not yet configured.
  if (current.finance.length === 0 && defaultFinanceApproverId) {
    current.finance = [defaultFinanceApproverId];
  }

  const currentSections: Record<ApprovalSection, string> = {} as Record<ApprovalSection, string>;
  for (const s of APPROVAL_SECTIONS) {
    const row = currentApprovals.find((a) => a.kind === "section" && a.section === s);
    // Pre-fill the section owner with the value stream's VMO when unset.
    currentSections[s] = row?.approverUserId ?? defaultVmoId ?? "";
  }

  const parties = configuredParties(records);
  const stakeholderRows = parties.length + APPROVAL_SECTIONS.length;
  const granted =
    parties.filter((p) => partyStatus(records, p) === "approved").length +
    APPROVAL_SECTIONS.filter((s) => sectionStatus(records, s) === "approved").length;
  const blocked = hasRejection(records);

  return (
    <div className="space-y-8">
      {/* Phase banner + the phase-appropriate action */}
      <section className="rounded-lg border bg-muted/30 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Freigabe-Phase · Revision {revision}
        </p>
        <p className="mb-3 text-lg font-medium">{PHASE_LABELS[phase]}</p>

        <div className="mb-4">
          <PhaseStepper phase={phase} />
        </div>

        {phase === "draft" && canManage && <SubmitHypothesisButton epicId={epicId} />}
        {phase === "hypothesis_review" &&
          (canDecideHypothesis ? (
            <DecideHypothesisButtons epicId={epicId} />
          ) : (
            <p className="text-sm text-muted-foreground">Wartet auf VMO-Freigabe der Hypothese.</p>
          ))}
        {phase === "business_case" && (
          <p className="text-sm text-muted-foreground">
            Hypothese freigegeben. Approver konfigurieren, dann Business Case einreichen.
          </p>
        )}
        {phase === "stakeholder_review" &&
          (blocked ? (
            <div className="space-y-2 rounded-md border border-red-200 bg-red-50 p-3">
              <p className="text-sm text-red-800">
                Eine oder mehrere Freigaben wurden abgelehnt. Überarbeite den Business Case, um eine
                neue Freigaberunde zu starten.
              </p>
              {canManage && <ReviseBusinessCaseButton epicId={epicId} />}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Erteilt {granted} / {stakeholderRows} — wartet auf ausstehende Freigaben.
            </p>
          ))}
        {phase === "approved" && (
          <div className="space-y-3">
            <p className="text-sm text-emerald-600">Alle Freigaben erteilt — Epic freigegeben.</p>
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
      </section>

      {/* Approver configuration — Business-Case phase only */}
      {phase === "business_case" && canManage && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">Approver konfigurieren</h2>
          <ApproverPicker
            epicId={epicId}
            approvers={approvers}
            current={current}
            currentSections={currentSections}
            userLabels={userLabels}
          />
          <div className="pt-2">
            <SubmitBusinessCaseButton epicId={epicId} />
          </div>
        </section>
      )}

      {/* Overview — who has approved, what is outstanding */}
      <section className="space-y-3">
        <h2 className="text-lg font-medium">Freigabe-Übersicht</h2>

        <div className="space-y-2">
          {APPROVAL_PARTIES.map((party) => {
            const rows = currentApprovals.filter((a) => a.kind === "party" && a.party === party);
            const status = partyStatus(records, party);
            return (
              <div key={party} className="rounded border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{PARTY_LABELS[party]}</span>
                  <Badge status={status} />
                </div>
                {rows.length > 0 && (
                  <ul className="mt-2 space-y-2">
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
                          {r.comment && <p className="mt-0.5 text-muted-foreground">{r.comment}</p>}
                        </div>
                        {phase === "stakeholder_review" &&
                          r.status === "pending" &&
                          r.approverUserId === currentUserId && (
                            <ApprovalDecisionButtons approvalId={r.id} />
                          )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>

        {/* Section sign-offs (Breakdown / KPIs) */}
        <div className="space-y-2">
          {APPROVAL_SECTIONS.map((section) => {
            const status = sectionStatus(records, section);
            const row = currentApprovals.find((a) => a.kind === "section" && a.section === section);
            return (
              <div key={section} className="flex items-center justify-between rounded border p-3">
                <div>
                  <span className="text-sm font-medium">{SECTION_LABELS[section]}</span>{" "}
                  <Badge status={status} />
                  {row?.approverUserId ? (
                    <span className="ml-2 text-xs text-muted-foreground">
                      {userLabel(row.approverUserId, userLabels)}
                    </span>
                  ) : (
                    <span className="ml-2 text-xs text-muted-foreground">
                      kein Verantwortlicher
                    </span>
                  )}
                  {row?.decidedAt && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      {new Date(row.decidedAt).toLocaleString("de-DE")}
                    </span>
                  )}
                </div>
                {phase === "stakeholder_review" &&
                  status !== "approved" &&
                  row?.approverUserId === currentUserId && (
                    <SectionSignoffButtons epicId={epicId} section={section} />
                  )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Past revision cycles (archived) */}
      {pastRevisions.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">Frühere Revisionen</h2>
          {pastRevisions.map((rev) => (
            <details key={rev} className="rounded border p-3">
              <summary className="cursor-pointer text-sm font-medium">Revision {rev}</summary>
              <ul className="mt-2 space-y-1 text-xs">
                {pastApprovals
                  .filter((a) => a.revision === rev)
                  .map((r) => (
                    <li key={r.id} className="flex items-center gap-2">
                      <span className="w-28 shrink-0 text-muted-foreground">
                        {r.kind === "section"
                          ? SECTION_LABELS[r.section as ApprovalSection]
                          : PARTY_LABELS[r.party as ApprovalParty]}
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
        </section>
      )}
    </div>
  );
}
