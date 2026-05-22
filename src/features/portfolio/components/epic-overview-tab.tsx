import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { EpicEditForm } from "./epic-edit-form";
import { STAGE_GATE_LABELS, STATUS_LABELS } from "@/components/detail/initiative-labels";
import { buildInitiativeSummary } from "@/domain/initiative-summary";
import { parseBusinessCase, computeBusinessCaseTotals } from "@/domain/business-case";
import type { StageGate, InitiativeStatus } from "@/domain/types";

/** Approval-workflow phase labels — see the Freigaben tab for the full workflow. */
const PHASE_LABELS: Record<string, string> = {
  draft: "Entwurf",
  hypothesis_review: "Hypothese in QS (VMO)",
  business_case: "Business Case",
  stakeholder_review: "Stakeholder-Freigaben",
  approved: "Freigegeben",
};

export interface EpicOverviewTabProps {
  epic: {
    id: string;
    title: string;
    description: string | null;
    stageGate: string;
    status: string;
    approvalPhase: string | null;
    ownerId: string;
    updatedAt: Date;
    approvedAt: Date | null;
    valueStream: { name: string } | null;
    businessCase: unknown;
    children: { status: string }[];
  };
  canEdit: boolean;
}

function formatAmount(n: number): string {
  return n > 0 ? n.toLocaleString("de-DE") : "—";
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="rounded border bg-muted/30 px-3 py-2 text-sm">{children}</div>
    </div>
  );
}

/**
 * Overview tab — mirrors the screenshot's structure: a derived summary band,
 * a responsive field grid, and the description. Field values come from data
 * the Epic already carries; financials are derived from the businessCase JSON.
 */
export function EpicOverviewTab({ epic, canEdit }: EpicOverviewTabProps) {
  const completedChildren = epic.children.filter((c) => c.status === "completed").length;

  const summary = buildInitiativeSummary({
    stageGate: epic.stageGate as StageGate,
    status: epic.status as InitiativeStatus,
    childCount: epic.children.length,
    completedChildCount: completedChildren,
    approvedAt: epic.approvedAt,
    updatedAt: epic.updatedAt,
  });

  const totals = computeBusinessCaseTotals(parseBusinessCase(epic.businessCase).current);

  return (
    <div className="space-y-8">
      <section>
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Summary
        </p>
        <p className="rounded bg-muted px-4 py-3 text-sm">{summary}</p>
      </section>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Field label="Stage">{STAGE_GATE_LABELS[epic.stageGate] ?? epic.stageGate}</Field>
        <Field label="Status">{STATUS_LABELS[epic.status] ?? epic.status}</Field>
        <Field label="Initiative Owner">
          <span className="font-mono text-xs">{epic.ownerId}</span>
        </Field>
        <Field label="Value Stream">{epic.valueStream?.name ?? "—"}</Field>
        <Field label="Net recurring benefits">{formatAmount(totals.recurringBenefit)}</Field>
        <Field label="One-time benefits">{formatAmount(totals.oneTimeBenefit)}</Field>
        <Field label="Implementation costs">{formatAmount(totals.implementationCost)}</Field>
      </section>

      <section className="flex flex-wrap items-center gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Freigabe-Status
        </p>
        <span className="text-sm font-medium">
          {PHASE_LABELS[epic.approvalPhase ?? "draft"] ?? epic.approvalPhase}
        </span>
        <Link
          href={`/portfolio/epics/${epic.id}?tab=approvals`}
          className="text-sm text-primary hover:underline"
        >
          Freigaben verwalten →
        </Link>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">Beschreibung</h2>
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
