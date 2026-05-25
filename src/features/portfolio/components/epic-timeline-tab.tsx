"use client";

import { useActionState, useState, startTransition, type ReactNode } from "react";
import { CheckCircle2, CircleDot, Circle, Lock } from "lucide-react";
import { saveTimelineAction } from "@/features/portfolio/actions/timeline";
import { advanceStageGateAction } from "@/features/portfolio/actions/stage-gate";
import type { TimelineFields, TimelineEstimatePhase, TimelineManualPhase } from "@/domain/timeline";

interface Props {
  epicId: string;
  stageGate: string;
  /** ISO timestamps for the automatic actuals. */
  createdAt: string;
  selectedForDetailingAt: string | null;
  hypothesisApprovedAt: string | null;
  selectedForAnalyzingAt: string | null;
  businessCaseApprovedAt: string | null;
  timeline: TimelineFields;
  canEdit: boolean;
  /** May advance the stage gate (`epic.approve`) — gates the "Für Analyse auswählen" action. */
  canAdvance: boolean;
}

const INPUT =
  "rounded-md border border-input bg-background px-2 py-1 text-sm shadow-xs focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60";

/** ISO datetime/date → de-DE display, or em dash. */
function fmt(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("de-DE");
}

type RowStatus = "done" | "current" | "upcoming";

function StatusIcon({ status }: { status: RowStatus }) {
  if (status === "done") return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
  if (status === "current") return <CircleDot className="h-4 w-4 text-primary" />;
  return <Circle className="h-4 w-4 text-muted-foreground/50" />;
}

/**
 * Epic Timeline — the lifecycle as phase milestones (stage gates L0–L5) with an
 * Estimate (owner forecast) and an Actual per phase. Funnel/Detailing/Business
 * Case actuals come from workflow events (read-only); Backlog/Implementation
 * actuals are entered by the Owner — setting the Implementation actual marks the
 * Epic Done. The Owner is nominated by the VMO on the Detailing phase.
 */
export function EpicTimelineTab({
  epicId,
  stageGate,
  createdAt,
  selectedForDetailingAt,
  hypothesisApprovedAt,
  selectedForAnalyzingAt,
  businessCaseApprovedAt,
  timeline,
  canEdit,
  canAdvance,
}: Props) {
  const [saveState, saveAction, saving] = useActionState(saveTimelineAction, {});
  const [analyzeState, analyzeAction, analyzing] = useActionState(advanceStageGateAction, {});

  // "Selected for analyzing" is a deliberate manual step: once the hypothesis is
  // done and the Epic still sits at L1, an authorised user moves it into L2.
  const canSelectForAnalyzing =
    canAdvance && stageGate === "L1" && Boolean(hypothesisApprovedAt) && !selectedForAnalyzingAt;

  function selectForAnalyzing() {
    const fd = new FormData();
    fd.set("epicId", epicId);
    fd.set("toGate", "L2");
    startTransition(() => analyzeAction(fd));
  }

  const [estimates, setEstimates] = useState<Record<TimelineEstimatePhase, string>>(() => ({
    detailing: timeline.estimates.detailing ?? "",
    business_case: timeline.estimates.business_case ?? "",
    backlog: timeline.estimates.backlog ?? "",
    implementation: timeline.estimates.implementation ?? "",
  }));
  const [actuals, setActuals] = useState<Record<TimelineManualPhase, string>>(() => ({
    backlog: timeline.actuals.backlog ?? "",
    implementation: timeline.actuals.implementation ?? "",
  }));

  function save() {
    const payload = {
      estimates: Object.fromEntries(Object.entries(estimates).filter(([, v]) => v)),
      actuals: Object.fromEntries(Object.entries(actuals).filter(([, v]) => v)),
    };
    const fd = new FormData();
    fd.set("epicId", epicId);
    fd.set("timeline", JSON.stringify(payload));
    startTransition(() => saveAction(fd));
  }

  // Per-phase actual presence, in lifecycle order, drives the status column.
  const implementationActual = actuals.implementation;
  const actualPresent = [
    true, // funnel — createdAt is always set
    Boolean(selectedForDetailingAt), // selected for detailing (owner nominated → L1)
    Boolean(hypothesisApprovedAt), // business hypothesis done
    Boolean(selectedForAnalyzingAt), // selected for analyzing (→ L2)
    Boolean(businessCaseApprovedAt), // business case approved
    Boolean(actuals.backlog),
    Boolean(implementationActual),
    Boolean(implementationActual), // done reached when implementation is actualised
  ];
  const firstOpen = actualPresent.indexOf(false);
  const statusAt = (i: number): RowStatus =>
    actualPresent[i] ? "done" : i === firstOpen ? "current" : "upcoming";

  function EstimateCell({ phase }: { phase: TimelineEstimatePhase }) {
    return canEdit ? (
      <input
        type="date"
        aria-label="Estimate"
        value={estimates[phase]}
        onChange={(e) => setEstimates((p) => ({ ...p, [phase]: e.target.value }))}
        className={`${INPUT} w-full`}
      />
    ) : (
      <span className="text-sm text-muted-foreground/80">{fmt(estimates[phase])}</span>
    );
  }

  function ManualActualCell({ phase }: { phase: TimelineManualPhase }) {
    return canEdit ? (
      <input
        type="date"
        aria-label="Actual"
        value={actuals[phase]}
        onChange={(e) => setActuals((p) => ({ ...p, [phase]: e.target.value }))}
        className={`${INPUT} w-full`}
      />
    ) : (
      <span className="text-sm">{fmt(actuals[phase])}</span>
    );
  }

  const Row = ({
    index,
    children,
    last,
  }: {
    index: number;
    children: ReactNode;
    last?: boolean;
  }) => (
    <li className="grid grid-cols-[1.25rem_1fr] gap-x-3 gap-y-2 sm:grid-cols-[1.25rem_minmax(0,1fr)_11rem_11rem]">
      <div className="flex flex-col items-center">
        <StatusIcon status={statusAt(index)} />
        {!last && <span className="mt-1 w-px flex-1 bg-border" />}
      </div>
      {children}
    </li>
  );

  // Column headers (desktop)
  return (
    <div className="space-y-6">
      <div className="hidden grid-cols-[1.25rem_minmax(0,1fr)_11rem_11rem] gap-x-3 px-0 text-[11px] font-medium uppercase tracking-wider text-muted-foreground sm:grid">
        <span />
        <span>Phase</span>
        <span>Estimate</span>
        <span>Actual</span>
      </div>

      <ol className="space-y-4">
        {/* Funnel Entry — actual = creation date */}
        <Row index={0}>
          <div className="min-w-0">
            <p className="text-sm font-medium">Funnel Entry</p>
            <p className="text-xs text-muted-foreground">Erstellung des Epics</p>
          </div>
          <span className="text-sm text-muted-foreground/80 sm:pt-0.5">—</span>
          <span className="text-sm sm:pt-0.5">{fmt(createdAt)}</span>
        </Row>

        {/* Selected for Detailing — actual = owner nominated (→ L1) */}
        <Row index={1}>
          <div className="min-w-0">
            <p className="text-sm font-medium">Selected for Detailing</p>
            <p className="text-xs text-muted-foreground">Owner nominiert</p>
          </div>
          <EstimateCell phase="detailing" />
          <span className="text-sm sm:pt-0.5">{fmt(selectedForDetailingAt)}</span>
        </Row>

        {/* Business hypothesis done — actual = hypothesis approved */}
        <Row index={2}>
          <div className="min-w-0">
            <p className="text-sm font-medium">Business hypothesis done</p>
            <p className="text-xs text-muted-foreground">Benefit-Hypothese freigegeben</p>
          </div>
          <span className="text-sm text-muted-foreground/80 sm:pt-0.5">—</span>
          <span className="text-sm sm:pt-0.5">{fmt(hypothesisApprovedAt)}</span>
        </Row>

        {/* Selected for analyzing — manual step → L2 Analyzing */}
        <Row index={3}>
          <div className="min-w-0 space-y-1.5">
            <p className="text-sm font-medium">Selected for analyzing</p>
            <p className="text-xs text-muted-foreground">Für Analyse ausgewählt (L2)</p>
            {canSelectForAnalyzing && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={selectForAnalyzing}
                  disabled={analyzing}
                  className="rounded-md bg-secondary px-2 py-1 text-xs font-medium hover:bg-secondary/80 disabled:opacity-50"
                >
                  {analyzing ? "…" : "Für Analyse auswählen"}
                </button>
                {analyzeState.error && (
                  <span className="text-xs text-destructive">{analyzeState.error}</span>
                )}
              </div>
            )}
          </div>
          <span className="text-sm text-muted-foreground/80 sm:pt-0.5">—</span>
          <span className="text-sm sm:pt-0.5">{fmt(selectedForAnalyzingAt)}</span>
        </Row>

        {/* Business Case — actual = full approval finalized */}
        <Row index={4}>
          <div className="min-w-0">
            <p className="text-sm font-medium">Business Case</p>
            <p className="text-xs text-muted-foreground">Lean Business Case freigegeben</p>
          </div>
          <EstimateCell phase="business_case" />
          <span className="text-sm sm:pt-0.5">{fmt(businessCaseApprovedAt)}</span>
        </Row>

        {/* Backlog — manual actual */}
        <Row index={5}>
          <div className="min-w-0">
            <p className="text-sm font-medium">Backlog</p>
            <p className="text-xs text-muted-foreground">Portfolio-Backlog</p>
          </div>
          <EstimateCell phase="backlog" />
          <ManualActualCell phase="backlog" />
        </Row>

        {/* Implementation — manual actual → Done */}
        <Row index={6}>
          <div className="min-w-0">
            <p className="text-sm font-medium">Implementation</p>
            <p className="text-xs text-muted-foreground">
              Actual setzen markiert das Epic als <span className="font-medium">Done</span>.
            </p>
          </div>
          <EstimateCell phase="implementation" />
          <ManualActualCell phase="implementation" />
        </Row>

        {/* Done — terminal, no end date */}
        <Row index={7} last>
          <div className="min-w-0">
            <p className="text-sm font-medium">Done</p>
            <p className="text-xs text-muted-foreground">Abgeschlossen — kein Enddatum</p>
          </div>
          <span className="text-sm text-muted-foreground/80 sm:pt-0.5">—</span>
          <span className="text-sm sm:pt-0.5">—</span>
        </Row>
      </ol>

      {canEdit ? (
        <div className="flex items-center gap-3 border-t pt-4">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? "Speichern…" : "Termine speichern"}
          </button>
          {saveState.error && <span className="text-sm text-destructive">{saveState.error}</span>}
          {saveState.success && <span className="text-sm text-emerald-600">Gespeichert.</span>}
        </div>
      ) : (
        <p className="flex items-center gap-2 border-t pt-4 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5" />
          Nur der Epic Owner kann Termine bearbeiten.
        </p>
      )}
    </div>
  );
}
