import type { ReactNode } from "react";
import { Info, ArrowRight, Flag } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { EpicClassificationForm } from "./epic-classification-form";
import { EpicEditForm } from "./epic-edit-form";
import { EpicGovernanceFlags } from "./epic-governance-flags";
import { EpicOwnerAssign } from "./epic-owner-assign";
import { EpicPlannedWindowForm } from "./epic-planned-window-form";
import { PhaseBadge } from "@/components/detail/phase-badge";
import { STAGE_GATE_LABELS } from "@/components/detail/initiative-labels";
import { buildInitiativeSummary } from "@/domain/initiative-summary";
import { parseBusinessCase, computeBusinessCaseTotals } from "@/domain/business-case";
import type { StageGate, InitiativeStatus } from "@/domain/types";

/** Compress the Epic's children-with-PIs into the derived Ist-Fenster (or null). */
function deriveIstWindow(
  children: { pi: { startDate: Date; endDate: Date } | null }[],
): { start: Date; end: Date } | null {
  let start: Date | null = null;
  let end: Date | null = null;
  for (const c of children) {
    if (!c.pi) continue;
    if (!start || c.pi.startDate < start) start = c.pi.startDate;
    if (!end || c.pi.endDate > end) end = c.pi.endDate;
  }
  return start && end ? { start, end } : null;
}

export interface EpicOverviewTabProps {
  epic: {
    id: string;
    title: string;
    description: string | null;
    stageGate: string;
    status: string;
    approvalPhase: string | null;
    ownerId: string | null;
    updatedAt: Date;
    approvedAt: Date | null;
    plannedStartAt: Date | null;
    plannedEndAt: Date | null;
    valueStream: { name: string } | null;
    businessCase: unknown;
    children: {
      status: string;
      pi: { startDate: Date; endDate: Date } | null;
    }[];
    needsSteeringAttention: boolean;
    stagedForBudgeting: boolean;
    /** Reifegrad-Modell v2: Stempel für die L5-Bestätigung. */
    impactRecognizedAt: Date | null;
    /** SAFe-Guardrails (Roadmap-G2): Solution/Epic/Enabler. */
    epicType: string | null;
    /** SAFe-Guardrails (Roadmap-G2): H1/H2/H3. */
    investmentHorizon: string | null;
  };
  canEdit: boolean;
  /** May nominate/replace the Epic owner (`epic.owner.assign`). */
  canAssignOwner: boolean;
  /** Reifegrad v2 Controlling-Capability für Impact-Confirm. */
  canConfirmImpact: boolean;
  approvers: { userId: string; roles: string[] }[];
  userLabels: Record<string, string>;
}

function formatAmount(n: number): string {
  return n > 0 ? n.toLocaleString("de-DE") : "—";
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="flex min-h-9 items-center rounded-lg border bg-muted/30 px-3 py-2 text-sm leading-snug">
        {children}
      </div>
    </div>
  );
}

/**
 * Overview tab — a calm summary callout, a card-based field grid (details +
 * financials), the approval-status row, and the description. Field values come
 * from data the Epic already carries; financials are derived from the
 * businessCase JSON.
 */
export function EpicOverviewTab({
  epic,
  canEdit,
  canAssignOwner,
  canConfirmImpact,
  approvers,
  userLabels,
}: EpicOverviewTabProps) {
  const completedChildren = epic.children.filter((c) => c.status === "completed").length;
  const totalChildren = epic.children.length;
  // L4.2-Derivation (siehe `subStageFor` in @/domain/stage-gate): alle Child-
  // Features completed → L4.2 erreicht → Impact-Bestätigung freigeschaltet.
  const reachedL42 =
    epic.stageGate === "L4" && totalChildren > 0 && completedChildren === totalChildren;
  const showImpactConfirm = reachedL42 && canConfirmImpact && epic.impactRecognizedAt == null;

  const summary = buildInitiativeSummary({
    stageGate: epic.stageGate as StageGate,
    status: epic.status as InitiativeStatus,
    childCount: epic.children.length,
    completedChildCount: completedChildren,
    approvedAt: epic.approvedAt,
    updatedAt: epic.updatedAt,
  });

  const totals = computeBusinessCaseTotals(parseBusinessCase(epic.businessCase).current);

  // Der Confirm-Dialog und die L5-Bestätigungs-Anzeige leben jetzt im
  // Sub-Header (`EpicReifegradActivityBar` auf der Seite). `showImpactConfirm`
  // bleibt vorerst als no-op, damit die Hook-Reihenfolge stabil ist.
  void showImpactConfirm;

  return (
    <div className="space-y-8">
      <section className="flex gap-3 rounded-lg border border-l-4 border-l-primary bg-muted/40 p-4">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="flex-1">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Summary
          </p>
          <p className="mt-1 text-sm">{summary}</p>
        </div>
      </section>

      <section className="space-y-5">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <Field label="Stage (Funnel)">
            {STAGE_GATE_LABELS[epic.stageGate] ?? epic.stageGate}
          </Field>
          <Field label="Initiative Owner">
            <EpicOwnerAssign
              epicId={epic.id}
              ownerId={epic.ownerId}
              canAssignOwner={canAssignOwner}
              approvers={approvers}
              userLabels={userLabels}
            />
          </Field>
          <Field label="Value Stream">{epic.valueStream?.name ?? "—"}</Field>
        </div>

        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Geplantes Zeitfenster
          </p>
          <EpicPlannedWindowForm
            epicId={epic.id}
            plannedStartAt={epic.plannedStartAt}
            plannedEndAt={epic.plannedEndAt}
            derived={deriveIstWindow(epic.children)}
            canEdit={canEdit}
          />
        </div>

        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Financials
          </p>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            <Field label="Net recurring benefits">{formatAmount(totals.recurringBenefit)}</Field>
            <Field label="One-time benefits">{formatAmount(totals.oneTimeBenefit)}</Field>
            <Field label="Implementation costs">{formatAmount(totals.implementationCost)}</Field>
          </div>
        </div>
      </section>

      <section className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Freigabe-Status
        </span>
        <PhaseBadge phase={epic.approvalPhase ?? "draft"} />
        <Link
          href={`/portfolio/epics/${epic.id}?tab=approvals`}
          className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-primary transition-colors hover:bg-primary/10"
        >
          Freigaben verwalten
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </section>

      <section>
        <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          <Flag className="h-3.5 w-3.5" />
          Governance
        </p>
        {canEdit ? (
          <EpicGovernanceFlags
            epicId={epic.id}
            needsSteeringAttention={epic.needsSteeringAttention}
            stagedForBudgeting={epic.stagedForBudgeting}
          />
        ) : epic.needsSteeringAttention || epic.stagedForBudgeting ? (
          <ul className="flex flex-wrap gap-1.5">
            {epic.needsSteeringAttention && (
              <li className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                Steering-Meeting
              </li>
            )}
            {epic.stagedForBudgeting && (
              <li className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                Budget-Meeting
              </li>
            )}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Keine Markierung.</p>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-heading text-lg font-medium">Portfolio-Klassifikation</h2>
        <EpicClassificationForm
          epicId={epic.id}
          epicType={epic.epicType}
          investmentHorizon={epic.investmentHorizon}
          canEdit={canEdit}
        />
      </section>

      <section>
        <h2 className="mb-3 font-heading text-lg font-medium">Beschreibung</h2>
        {canEdit ? (
          <EpicEditForm
            id={epic.id}
            currentTitle={epic.title}
            currentDescription={epic.description ?? ""}
          />
        ) : (
          <p className="text-foreground">{epic.description ?? "Keine Beschreibung."}</p>
        )}
      </section>
    </div>
  );
}
