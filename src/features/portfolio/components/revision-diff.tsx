import type { ReactNode } from "react";
import { costSliceLabel, type BusinessCaseFields } from "@/domain/business-case";
import type { BenefitHypothesisFields } from "@/domain/benefit-hypothesis";

/** One compared field: its label and the baseline / new rendered values. */
export interface DiffRow {
  label: string;
  before: string;
  after: string;
}

function val(v: string | number | undefined | null): string {
  return v === undefined || v === null || v === "" ? "—" : String(v);
}

function lines(v: string[] | undefined): string {
  return v && v.length > 0 ? v.join("\n") : "—";
}

function slices(v: BusinessCaseFields["costSlices"]): string {
  if (!v || v.length === 0) return "—";
  return v.map((s, i) => `${costSliceLabel(i)}: ${s.amount ?? "—"}`).join("\n");
}

/** Field rows for a Business Case comparison. `approvals` is omitted (replaced by the workflow). */
export function businessCaseDiffRows(
  baseline: BusinessCaseFields,
  current: BusinessCaseFields,
): DiffRow[] {
  const row = (label: string, key: keyof BusinessCaseFields): DiffRow => ({
    label,
    before: val(baseline[key] as string | number | undefined),
    after: val(current[key] as string | number | undefined),
  });
  return [
    row("Funnel Entry Date", "funnelEntryDate"),
    row("Key Stakeholders", "keyStakeholders"),
    row("Initiative Description", "initiativeDescription"),
    row("Business Outcome Hypothesis", "businessOutcomeHypothesis"),
    row("Leading Indicators", "leadingIndicators"),
    row("In Scope", "inScope"),
    row("Out of Scope", "outOfScope"),
    row("What you need to believe", "whatYouNeedToBelieve"),
    row("Customers affected", "customersAffected"),
    row("Impact on solutions", "impactOnSolutions"),
    row("Analysis Summary", "analysisSummary"),
    {
      label: "Implementierungskosten",
      before: slices(baseline.costSlices),
      after: slices(current.costSlices),
    },
    row("Einmaliger Nutzen", "oneTimeBenefit"),
    row("Wiederkehrender Nutzen (p.a.)", "recurringBenefit"),
  ];
}

/** Field rows for a Benefit Hypothesis comparison. */
export function benefitHypothesisDiffRows(
  baseline: BenefitHypothesisFields,
  current: BenefitHypothesisFields,
): DiffRow[] {
  return [
    {
      label: "Maßnahmen-Hypothese",
      before: val(baseline.measuresHypothesis),
      after: val(current.measuresHypothesis),
    },
    {
      label: "Veränderung ggü. Startpunkt",
      before: val(baseline.changeFromBaseline),
      after: val(current.changeFromBaseline),
    },
    {
      label: "Business Outcomes",
      before: lines(baseline.businessOutcomes),
      after: lines(current.businessOutcomes),
    },
    {
      label: "Leading Indicators",
      before: lines(baseline.leadingIndicators),
      after: lines(current.leadingIndicators),
    },
    { label: "Risks & Abhängigkeiten", before: lines(baseline.risks), after: lines(current.risks) },
  ];
}

/**
 * Side-by-side scaffold for the Epic Owner working a revision: the last approved
 * version (left, read-only) next to the editable new version (right). Same
 * column headers as {@link RevisionDiff} for visual continuity. Stacks on narrow
 * screens.
 */
export function RevisionEditLayout({ left, right }: { left: ReactNode; right: ReactNode }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Letzte Freigabe
        </p>
        {left}
      </div>
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Neue Version
        </p>
        {right}
      </div>
    </div>
  );
}

/**
 * Read-only side-by-side comparison: the last approved revision (left) against
 * the current/new version (right). Changed fields are pastel-highlighted.
 */
export function RevisionDiff({ rows }: { rows: DiffRow[] }) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-4 px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <span>Letzte Freigabe</span>
        <span>Neue Version</span>
      </div>
      {rows.map((r) => {
        const changed = r.before !== r.after;
        return (
          <div
            key={r.label}
            className={`rounded border p-2 ${changed ? "border-amber-200 bg-amber-50" : "bg-muted/20"}`}
          >
            <p className="mb-1 text-xs font-medium text-muted-foreground">{r.label}</p>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <p className="whitespace-pre-line text-foreground/60">{r.before}</p>
              <p className="whitespace-pre-line text-foreground">{r.after}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
