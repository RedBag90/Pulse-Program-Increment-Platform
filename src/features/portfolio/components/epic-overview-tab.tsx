import type { ReactNode } from "react";
import { Info, ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { EpicEditForm } from "./epic-edit-form";
import { PhaseBadge } from "@/components/detail/phase-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { STAGE_GATE_LABELS, initials } from "@/components/detail/initiative-labels";
import { buildInitiativeSummary } from "@/domain/initiative-summary";
import { parseBusinessCase, computeBusinessCaseTotals } from "@/domain/business-case";
import type { StageGate, InitiativeStatus } from "@/domain/types";

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
  /** Resolved owner display label (email), falling back to the owner id. */
  ownerName?: string | null;
  canEdit: boolean;
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
export function EpicOverviewTab({ epic, ownerName, canEdit }: EpicOverviewTabProps) {
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
  const owner = ownerName ?? epic.ownerId;

  return (
    <div className="space-y-8">
      <section className="flex gap-3 rounded-lg border border-l-4 border-l-primary bg-muted/40 p-4">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div>
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
            <span className="flex items-center gap-2">
              <Avatar size="sm">
                <AvatarFallback>{initials(owner)}</AvatarFallback>
              </Avatar>
              <span className="truncate">{owner}</span>
            </span>
          </Field>
          <Field label="Value Stream">{epic.valueStream?.name ?? "—"}</Field>
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
