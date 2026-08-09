"use client";

import { useActionState, useState, startTransition, Fragment } from "react";
import { CheckCircle2, CircleDot, Circle, Lock, ChevronRight, ArrowDown } from "lucide-react";
import { saveTimelineAction } from "@/modules/work/features/portfolio/actions/timeline";
import { advanceStageGateAction } from "@/modules/work/features/portfolio/actions/stage-gate";
import type {
  TimelineFields,
  TimelineEstimatePhase,
  TimelineManualPhase,
} from "@/modules/work/domain/timeline";
import { STAGE_GATE_LABELS } from "@/components/detail/initiative-labels";
import { SectionLabel } from "@/components/ui/section-label";
import { reifegradGroups } from "@/modules/work/features/portfolio/lib/reifegrad-groups";
import { EpicOwnerAssign } from "./epic-owner-assign";
import {
  EpicHypothesisApproval,
  EpicBusinessCaseApproval,
  type ApprovalRow,
} from "./epic-approvals-tab";
import type { TenantApprover } from "./approver-picker";
import type { ApprovalPhase } from "@/modules/work/domain/epic-approval";

interface Props {
  epicId: string;
  stageGate: string;
  /** ISO timestamps for the automatic actuals. */
  createdAt: string;
  selectedForDetailingAt: string | null;
  hypothesisApprovedAt: string | null;
  selectedForAnalyzingAt: string | null;
  businessCaseApprovedAt: string | null;
  /** Stamped when the Epic enters L4 (manual advance or first feature start). */
  implementationStartedAt: string | null;
  /** Set by Controlling on impact confirmation (L5). */
  impactRecognizedAt: string | null;
  timeline: TimelineFields;
  canEdit: boolean;
  /** May advance the stage gate (`epic.approve`) — gates the "Für Analyse auswählen" action. */
  canAdvance: boolean;
  /** Current Epic owner — nominated in the "Selected for Detailing" phase expander. */
  ownerId: string | null;
  /** May nominate/replace the Epic owner (`epic.owner.assign`). */
  canAssignOwner: boolean;
  /** Tenant approver pool (owner nomination + phase approvers). */
  approvers: TenantApprover[];
  userLabels: Record<string, string>;
  // ── Freigabe-Workflow (früher eigener „Freigaben"-Tab) — lebt jetzt im
  //    „Business Case"-Phasen-Expander. Nur aktiv bei multiPartyApproval. ──
  multiPartyApproval: boolean;
  approvalPhase: ApprovalPhase;
  approvalRevision: number;
  approvals: ApprovalRow[];
  currentUserId: string;
  defaultFinanceApproverId?: string | null;
  defaultVmoId?: string | null;
}

const INPUT =
  "rounded-md border border-input bg-background px-2 py-1 text-sm shadow-xs focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60";

/** ISO datetime/date → de-DE display, or em dash. */
function fmt(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("de-DE");
}

/** Tage seit Epoch (auf den Tag genau), oder null bei ungültigem Datum. */
function toDay(s: string | null | undefined): number | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : Math.floor(d.getTime() / 86_400_000);
}

/** Estimate-vs-Actual: pünktlich/früh (emerald) oder verspätet (amber). */
function VarianceBadge({ estimate, actual }: { estimate: string; actual: string }) {
  const e = toDay(estimate);
  const a = toDay(actual);
  if (e == null || a == null) return null;
  const diff = a - e; // Tage (positiv = später als geplant)
  const late = diff > 0;
  const label = diff === 0 ? "pünktlich" : late ? `+${diff} T` : `${-diff} T früher`;
  return (
    <span
      className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
        late
          ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200"
          : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
      }`}
      title={`Ist ${late ? diff + " Tage nach" : diff === 0 ? "am" : -diff + " Tage vor"} dem Estimate`}
    >
      {label}
    </span>
  );
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
 * Case/Implementation-started actuals come from workflow events (read-only);
 * Backlog/Implementation-done actuals are entered by the Owner. Impact Realized
 * (L5) is stamped by Controlling via confirmEpicImpact. The Owner is nominated by
 * the Portfolio Manager on the Detailing phase.
 */
export function EpicTimelineTab({
  epicId,
  stageGate,
  createdAt,
  selectedForDetailingAt,
  hypothesisApprovedAt,
  selectedForAnalyzingAt,
  businessCaseApprovedAt,
  implementationStartedAt,
  impactRecognizedAt,
  timeline,
  canEdit,
  canAdvance,
  ownerId,
  canAssignOwner,
  approvers,
  userLabels,
  multiPartyApproval,
  approvalPhase,
  approvalRevision,
  approvals,
  currentUserId,
  defaultFinanceApproverId,
  defaultVmoId,
}: Props) {
  const [saveState, saveAction, saving] = useActionState(saveTimelineAction, {});
  const [analyzeState, analyzeAction, analyzing] = useActionState(advanceStageGateAction, {});
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

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

  // Manueller L3→L4-Übergang („Implementation started"), entkoppelt vom Feature-Start.
  const canStartImplementation = canAdvance && stageGate === "L3";

  function startImplementation() {
    const fd = new FormData();
    fd.set("epicId", epicId);
    fd.set("toGate", "L4");
    startTransition(() => analyzeAction(fd));
  }

  const [estimates, setEstimates] = useState<Record<TimelineEstimatePhase, string>>(() => ({
    detailing: timeline.estimates.detailing ?? "",
    hypothesis: timeline.estimates.hypothesis ?? "",
    analyzing: timeline.estimates.analyzing ?? "",
    business_case: timeline.estimates.business_case ?? "",
    backlog: timeline.estimates.backlog ?? "",
    implementation_started: timeline.estimates.implementation_started ?? "",
    implementation: timeline.estimates.implementation ?? "",
    done: timeline.estimates.done ?? "",
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
    Boolean(actuals.backlog), // backlog
    Boolean(implementationStartedAt), // implementation started (→ L4)
    Boolean(implementationActual), // implementation done (owner-set actual)
    Boolean(impactRecognizedAt), // impact realized (L5 — set by Controlling)
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
        className={`${INPUT} w-full self-start`}
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
        className={`${INPUT} w-full self-start`}
      />
    ) : (
      <span className="text-sm">{fmt(actuals[phase])}</span>
    );
  }

  // Lifecycle phases in order. `level` (L0–L5) drives the left Reifegrad gutter;
  // `estimatePhase` → editable Owner estimate (every phase except Funnel);
  // `actualPhase` → editable manual actual; `actualIso` → read-only workflow
  // actual; no actual field → em dash.
  const phases: {
    key: string;
    title: string;
    subtitle: string;
    level: string;
    estimatePhase?: TimelineEstimatePhase;
    actualPhase?: TimelineManualPhase;
    actualIso?: string | null;
    expandable?: boolean;
  }[] = [
    {
      key: "funnel",
      title: "Funnel Entry",
      subtitle: "Erstellung des Epics",
      level: "L0",
      actualIso: createdAt,
    },
    {
      key: "detailing",
      title: "Selected for Detailing",
      subtitle: "Owner nominiert",
      level: "L1",
      estimatePhase: "detailing",
      actualIso: selectedForDetailingAt,
      expandable: true,
    },
    {
      key: "hypothesis",
      title: "Business hypothesis done",
      subtitle: "Benefit-Hypothese freigegeben",
      level: "L1",
      estimatePhase: "hypothesis",
      actualIso: hypothesisApprovedAt,
      expandable:
        multiPartyApproval && (approvalPhase === "draft" || approvalPhase === "hypothesis_review"),
    },
    {
      key: "analyzing",
      title: "Selected for analyzing",
      subtitle: "Für Analyse ausgewählt",
      level: "L2",
      estimatePhase: "analyzing",
      actualIso: selectedForAnalyzingAt,
    },
    {
      key: "business_case",
      title: "Business Case",
      subtitle: "Lean Business Case freigegeben",
      level: "L2",
      estimatePhase: "business_case",
      actualIso: businessCaseApprovedAt,
      expandable: multiPartyApproval,
    },
    {
      key: "backlog",
      title: "Backlog",
      subtitle: "Portfolio-Backlog",
      level: "L3",
      estimatePhase: "backlog",
      actualPhase: "backlog",
    },
    {
      key: "implementation_started",
      title: "Implementation started",
      subtitle: "Umsetzung gestartet",
      level: "L4",
      estimatePhase: "implementation_started",
      actualIso: implementationStartedAt,
    },
    {
      key: "implementation",
      title: "Implementation done",
      subtitle: "Ist-Datum = Umsetzung abgeschlossen.",
      level: "L4",
      estimatePhase: "implementation",
      actualPhase: "implementation",
    },
    {
      key: "done",
      title: "Impact Realized",
      subtitle: "Impact durch Controlling bestätigt",
      level: "L5",
      estimatePhase: "done",
      actualIso: impactRecognizedAt,
    },
  ];

  const groups = reifegradGroups(phases.map((p) => p.level));

  function EstimateSlot({ phase }: { phase: (typeof phases)[number] }) {
    if (!phase.estimatePhase)
      return <span className="text-sm text-muted-foreground/80 sm:pt-0.5">—</span>;
    return <EstimateCell phase={phase.estimatePhase} />;
  }

  function ActualSlot({ phase }: { phase: (typeof phases)[number] }) {
    const estimate = phase.estimatePhase ? estimates[phase.estimatePhase] : "";
    const actualDate = phase.actualPhase ? actuals[phase.actualPhase] : (phase.actualIso ?? "");
    const variance =
      estimate && actualDate ? <VarianceBadge estimate={estimate} actual={actualDate} /> : null;

    if (phase.actualPhase) {
      return (
        <div className="space-y-1">
          <ManualActualCell phase={phase.actualPhase} />
          {variance}
        </div>
      );
    }
    if (phase.actualIso !== undefined) {
      return (
        <div className="flex flex-wrap items-center gap-1.5 sm:pt-0.5">
          <span className="text-sm">{fmt(phase.actualIso)}</span>
          {variance}
        </div>
      );
    }
    return <span className="text-sm text-muted-foreground/80 sm:pt-0.5">—</span>;
  }

  /**
   * Aufgeklappter Inhalt je Phase: Owner-Nominierung an „Selected for Detailing",
   * Hypothese-Freigabe an „Business hypothesis done", Business-Case-/Stakeholder-
   * Freigabe an „Business Case". Die Phasen selbst ersetzen den Freigabe-Stepper.
   */
  function ExpandedContent({ phase }: { phase: (typeof phases)[number] }) {
    if (phase.key === "detailing") {
      return (
        <div className="space-y-2 rounded-md border bg-muted/20 p-3">
          <SectionLabel>Epic Owner</SectionLabel>
          <EpicOwnerAssign
            epicId={epicId}
            ownerId={ownerId}
            canAssignOwner={canAssignOwner}
            approvers={approvers}
            userLabels={userLabels}
          />
        </div>
      );
    }
    if (phase.key === "hypothesis" && multiPartyApproval) {
      return (
        <div className="rounded-md border bg-muted/20 p-3">
          <EpicHypothesisApproval epicId={epicId} phase={approvalPhase} canManage={canEdit} />
        </div>
      );
    }
    if (phase.key === "business_case" && multiPartyApproval) {
      return (
        <div className="rounded-md border bg-muted/20 p-3">
          <EpicBusinessCaseApproval
            epicId={epicId}
            phase={approvalPhase}
            revision={approvalRevision}
            approvals={approvals}
            approvers={approvers}
            userLabels={userLabels}
            currentUserId={currentUserId}
            canManage={canEdit}
            defaultFinanceApproverId={defaultFinanceApproverId ?? null}
            defaultVmoId={defaultVmoId ?? null}
          />
        </div>
      );
    }
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Column headers (desktop) — pl offset = Reifegrad-Gutter (2.5rem) + gap (0.75rem). */}
      <div className="hidden gap-x-3 pl-[3.25rem] sm:grid sm:grid-cols-[1.25rem_minmax(0,1fr)_11rem_11rem]">
        <span />
        <SectionLabel>Phase</SectionLabel>
        <SectionLabel>Estimate</SectionLabel>
        <SectionLabel>Actual</SectionLabel>
      </div>

      {/* Ein Block je Reifegrad-Gruppe: links das L-Kürzel, durch eine vertikale
          Linie von den Phasen getrennt — die Linie spannt über alle Phasen der Gruppe. */}
      <div className="space-y-4">
        {groups.map((g) => (
          <Fragment key={`${g.level}-${g.start}`}>
            <div className="flex gap-3">
              <div
                className="flex w-[2.5rem] shrink-0 items-start justify-end gap-2"
                title={STAGE_GATE_LABELS[g.level] ?? g.level}
              >
                <span className="pt-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
                  {g.level}
                </span>
                <span className="w-px self-stretch bg-border" />
              </div>

              <ol className="flex-1 space-y-4">
                {phases.slice(g.start, g.start + g.span).map((phase, j) => {
                  const index = g.start + j;
                  return (
                    <li
                      key={phase.key}
                      className="grid grid-cols-[1.25rem_1fr] gap-x-3 gap-y-2 sm:grid-cols-[1.25rem_minmax(0,1fr)_11rem_11rem]"
                    >
                      <div className="flex justify-center sm:pt-0.5">
                        <StatusIcon status={statusAt(index)} />
                      </div>
                      <div className="min-w-0 space-y-1.5">
                        {phase.expandable ? (
                          <button
                            type="button"
                            onClick={() => toggle(phase.key)}
                            aria-expanded={expanded.has(phase.key)}
                            className="flex items-center gap-1 text-sm font-medium hover:text-primary"
                          >
                            <ChevronRight
                              className={`size-3.5 shrink-0 transition-transform ${
                                expanded.has(phase.key) ? "rotate-90" : ""
                              }`}
                            />
                            {phase.title}
                          </button>
                        ) : (
                          <p className="text-sm font-medium">{phase.title}</p>
                        )}
                        <p className="text-xs text-muted-foreground">{phase.subtitle}</p>
                      </div>
                      <EstimateSlot phase={phase} />
                      <ActualSlot phase={phase} />
                      {phase.expandable && expanded.has(phase.key) && (
                        <div className="col-span-2 sm:col-span-4">
                          <ExpandedContent phase={phase} />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>

            {/* Advance-Button im Übergang L1→L2: zwischen „Business hypothesis done"
              und „Selected for analyzing". */}
            {g.level === "L1" && canSelectForAnalyzing && (
              <div className="flex flex-wrap items-center gap-2 pl-[3.25rem]">
                <button
                  type="button"
                  onClick={selectForAnalyzing}
                  disabled={analyzing}
                  className="inline-flex items-center gap-1 rounded-md bg-secondary px-2.5 py-1 text-xs font-medium hover:bg-secondary/80 disabled:opacity-50"
                >
                  <ArrowDown className="size-3.5" />
                  {analyzing ? "…" : "Für Analyse auswählen"}
                </button>
                {analyzeState.error && (
                  <span className="text-xs text-destructive">{analyzeState.error}</span>
                )}
              </div>
            )}

            {/* Advance-Button im Übergang L3→L4: zwischen „Backlog" und „Implementation started". */}
            {g.level === "L3" && canStartImplementation && (
              <div className="flex flex-wrap items-center gap-2 pl-[3.25rem]">
                <button
                  type="button"
                  onClick={startImplementation}
                  disabled={analyzing}
                  className="inline-flex items-center gap-1 rounded-md bg-secondary px-2.5 py-1 text-xs font-medium hover:bg-secondary/80 disabled:opacity-50"
                >
                  <ArrowDown className="size-3.5" />
                  {analyzing ? "…" : "Implementation starten"}
                </button>
                {analyzeState.error && (
                  <span className="text-xs text-destructive">{analyzeState.error}</span>
                )}
              </div>
            )}
          </Fragment>
        ))}
      </div>

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
