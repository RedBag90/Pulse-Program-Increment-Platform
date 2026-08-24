import { Info, ArrowRight, Flag } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { EpicClassificationForm } from "./epic-classification-form";
import { EpicEditForm } from "./epic-edit-form";
import { EpicGovernanceFlags } from "./epic-governance-flags";
import { EpicPlannedWindowForm } from "./epic-planned-window-form";
import { PhaseBadge } from "@/components/detail/phase-badge";
import { SectionLabel } from "@/components/ui/section-label";
import { formatCompactEUR } from "@/lib/formatting";
import { buildInitiativeSummary } from "@/modules/core/kernel/domain/initiative-summary";
import { parseBusinessCase, computeBusinessCaseTotals } from "@/modules/work/domain/business-case";
import type { StageGate, InitiativeStatus } from "@/modules/core/kernel/domain/types";

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
  /** Nutzen bei 100 % KPI-Zielerreichung — direkt aus den KPIs berechnet. */
  kpiBenefit: { oneTimeBenefit: number; recurringBenefit: number };
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
export function EpicOverviewTab({ epic, canEdit, kpiBenefit }: EpicOverviewTabProps) {
  const completedChildren = epic.children.filter((c) => c.status === "completed").length;

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
          <div className="flex items-center gap-2 rounded-lg border border-dashed bg-card/50 px-3 py-3 text-sm text-muted-foreground">
            <Flag className="size-4 text-muted-foreground/60" />
            Keine Governance-Markierung.
          </div>
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
