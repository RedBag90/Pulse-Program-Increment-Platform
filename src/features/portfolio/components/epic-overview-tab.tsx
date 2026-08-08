import type { ReactNode } from "react";
import { Info, ArrowRight, Flag } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { EpicClassificationForm } from "./epic-classification-form";
import { EpicEditForm } from "./epic-edit-form";
import { EpicGovernanceFlags } from "./epic-governance-flags";
import { EpicPlannedWindowForm } from "./epic-planned-window-form";
import { PhaseBadge } from "@/components/detail/phase-badge";
import { STAGE_GATE_LABELS, userLabel, initials } from "@/components/detail/initiative-labels";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SectionLabel } from "@/components/ui/section-label";
import { formatCompactEUR } from "@/lib/formatting";
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
  /** Reifegrad v2 Controlling-Capability für Impact-Confirm. */
  canConfirmImpact: boolean;
  /** Resolved user-id → display label (email) map — für die read-only Owner-Anzeige. */
  userLabels: Record<string, string>;
  /** Nutzen bei 100 % KPI-Zielerreichung — direkt aus den KPIs berechnet. */
  kpiBenefit: { oneTimeBenefit: number; recurringBenefit: number };
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <SectionLabel className="mb-1.5">{label}</SectionLabel>
      <div className="flex min-h-9 items-center rounded-lg border bg-card px-3 py-2 text-sm leading-snug shadow-xs">
        {children}
      </div>
    </div>
  );
}

/** Kennzahl-Kachel (Wirtschaftlichkeit) — großer € -Wert mit semantischem Akzent. */
function StatTile({
  label,
  value,
  accent,
  sub,
}: {
  label: string;
  value: number;
  accent?: "emerald" | "default";
  sub?: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-xs">
      <SectionLabel>{label}</SectionLabel>
      <p
        className={`mt-1 text-2xl font-semibold tracking-tight tabular-nums ${
          accent === "emerald" && value > 0 ? "text-emerald-600 dark:text-emerald-400" : ""
        }`}
      >
        {value > 0 ? formatCompactEUR(value) : "—"}
      </p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
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
  canConfirmImpact,
  userLabels,
  kpiBenefit,
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

  const totals = computeBusinessCaseTotals(
    parseBusinessCase(epic.businessCase).current,
    kpiBenefit,
  );

  // Der Confirm-Dialog und die L5-Bestätigungs-Anzeige leben jetzt im
  // Sub-Header (`EpicReifegradActivityBar` auf der Seite). `showImpactConfirm`
  // bleibt vorerst als no-op, damit die Hook-Reihenfolge stabil ist.
  void showImpactConfirm;

  return (
    <div className="space-y-8">
      <section className="flex gap-3 rounded-lg border border-l-4 border-l-primary bg-card p-4 shadow-xs">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="flex-1">
          <SectionLabel>Summary</SectionLabel>
          <p className="mt-1 text-sm">{summary}</p>
        </div>
      </section>

      <section className="space-y-5">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <Field label="Stage (Funnel)">
            {STAGE_GATE_LABELS[epic.stageGate] ?? epic.stageGate}
          </Field>
          <Field label="Initiative Owner">
            {epic.ownerId ? (
              <span className="flex items-center gap-2">
                <Avatar size="sm">
                  <AvatarFallback>{initials(userLabel(epic.ownerId, userLabels))}</AvatarFallback>
                </Avatar>
                <span className="truncate">{userLabel(epic.ownerId, userLabels)}</span>
              </span>
            ) : (
              <span className="text-muted-foreground">Nicht zugewiesen</span>
            )}
          </Field>
          <Field label="Value Stream">{epic.valueStream?.name ?? "—"}</Field>
        </div>

        <div>
          <SectionLabel className="mb-2">Geplantes Zeitfenster</SectionLabel>
          <EpicPlannedWindowForm
            epicId={epic.id}
            plannedStartAt={epic.plannedStartAt}
            plannedEndAt={epic.plannedEndAt}
            derived={deriveIstWindow(epic.children)}
            canEdit={canEdit}
          />
        </div>

        <div>
          <SectionLabel className="mb-2">Wirtschaftlichkeit</SectionLabel>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            <StatTile
              label="Nutzen wiederkehrend p.a."
              value={totals.recurringBenefit}
              accent="emerald"
            />
            <StatTile label="Einmaliger Effekt" value={totals.oneTimeBenefit} />
            <StatTile label="Umsetzungskosten" value={totals.implementationCost} />
          </div>
        </div>
      </section>

      <section className="flex flex-wrap items-center gap-3 rounded-lg border bg-card px-4 py-3 shadow-xs">
        <SectionLabel>Freigabe-Status</SectionLabel>
        <PhaseBadge phase={epic.approvalPhase ?? "draft"} />
        <Link
          href={`/portfolio/epics/${epic.id}?tab=timeline`}
          className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-primary transition-colors hover:bg-primary/10"
        >
          Freigaben verwalten
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </section>

      <section>
        <SectionLabel className="mb-2 flex items-center gap-1.5">
          <Flag className="h-3.5 w-3.5" />
          Governance
        </SectionLabel>
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
