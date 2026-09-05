"use client";

import { useActionState, useState, startTransition, Fragment } from "react";
import { CheckCircle2, CircleDot, Circle, Lock, ChevronRight } from "lucide-react";
import { LIFECYCLE_STEPS } from "@/modules/work/features/portfolio/lib/epic-lifecycle";
import { saveTimelineAction } from "@/modules/work/features/portfolio/actions/timeline";
import type {
  TimelineFields,
  TimelineEstimatePhase,
  TimelineManualPhase,
} from "@/modules/work/domain/timeline";
import { STAGE_GATE_LABELS } from "@/components/detail/initiative-labels";
import { SectionLabel } from "@/components/ui/section-label";
import { reifegradGroups } from "@/modules/work/features/portfolio/lib/reifegrad-groups";
import { GateHistoryList } from "./gate/gate-history-list";
import type { LifecycleStep } from "@/modules/work/features/portfolio/lib/epic-lifecycle";
import type { EpicGateHistoryView } from "@/modules/work/server/views/epic-detail";
import { EpicOwnerAssign } from "./epic-owner-assign";
import type { TenantApprover } from "./approver-picker";

interface Props {
  epicId: string;
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
  /** Antragshistorie der Reifegrad-Wechsel — wer wann was beantragt/abgenommen hat. */
  gateHistory: EpicGateHistoryView[];
  /** Current Epic owner — nominated in the "Selected for Detailing" phase expander. */
  ownerId: string | null;
  /** May nominate/replace the Epic owner (`epic.owner.assign`). */
  canAssignOwner: boolean;
  /** Tenant approver pool (owner nomination + phase approvers). */
  approvers: TenantApprover[];
  userLabels: Record<string, string>;
  /**
   * Gate-based lifecycle status — the SAME 9-phase derivation the lifecycle
   * stepper above the screen renders (from the Stage Gate, not milestone
   * timestamps). The timeline's status column reads its done/current/upcoming
   * coloring from here so the two never diverge. The 9 rows map 1:1 to these
   * steps by `key`.
   */
  lifecycleSteps: LifecycleStep[];
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
 * (L5) wird gestempelt, wenn das Controlling die L4→L5-Abnahme erteilt (ADR-0018).
 * The Owner is nominated by the Portfolio Manager on the Detailing phase.
 */
export function EpicTimelineTab({
  epicId,
  createdAt,
  selectedForDetailingAt,
  hypothesisApprovedAt,
  selectedForAnalyzingAt,
  businessCaseApprovedAt,
  implementationStartedAt,
  impactRecognizedAt,
  timeline,
  canEdit,
  ownerId,
  canAssignOwner,
  approvers,
  userLabels,
  lifecycleSteps,
  gateHistory,
}: Props) {
  const [saveState, saveAction, saving] = useActionState(saveTimelineAction, {});
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  // Früher standen hier zwei fest verdrahtete Advance-Buttons (L1→L2 und
  // L3→L4) mit eigenen Sichtbarkeitsregeln — zwei von vier Stellen, an denen
  // sich ein Gate schieben liess. Beide sind in der Gate-Karte aufgegangen, die
  // jeden Wechsel gleich behandelt: beantragen, abnehmen lassen, vollziehen.

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

  // The status column reads the SHARED gate-based lifecycle status (same source
  // as the stepper above the screen) — no second derivation off milestone
  // timestamps. The 9 timeline rows map 1:1 to the 9 lifecycle steps by `key`.
  const statusByKey = new Map<string, RowStatus>(lifecycleSteps.map((s) => [s.key, s.status]));
  const statusFor = (key: string): RowStatus => statusByKey.get(key) ?? "upcoming";

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
    // „Umsetzung fertig" gehört der L4.2-Abnahme: das Ist-Datum entsteht dort
    // und wird hier nur angezeigt (der Service verwirft eingehende Werte).
    if (phase === "implementation") {
      return (
        <span className="text-sm" title="Wird durch die L4.2-Abnahme gesetzt">
          {actuals[phase] ? (
            fmt(actuals[phase])
          ) : (
            <span className="text-muted-foreground/80">— per L4.2-Abnahme</span>
          )}
        </span>
      );
    }
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

  // Die neun Zeilen sind die neun Lifecycle-Schritte — Titel, Untertitel und
  // Reifegrad-Spalte kommen aus `LIFECYCLE_STEPS`, derselben Quelle, aus der die
  // Statusfarbe schon gelesen wird. Vorher standen sie hier ein zweites Mal, auf
  // Englisch und im alten Wortschatz („Selected for Detailing", „Backlog"),
  // während der Stepper darüber längst „Detailing" und „Umsetzung" sagte.
  //
  // Nur was die Zeitleiste zusätzlich braucht, steht hier: welches Schätzfeld,
  // welches Ist-Datum, und ob die Zeile aufklappt.
  const EXTRAS: Record<
    string,
    {
      estimatePhase?: TimelineEstimatePhase;
      actualPhase?: TimelineManualPhase;
      actualIso?: string | null;
      expandable?: boolean;
    }
  > = {
    funnel: { actualIso: createdAt },
    detailing: { estimatePhase: "detailing", actualIso: selectedForDetailingAt, expandable: true },
    hypothesis: { estimatePhase: "hypothesis", actualIso: hypothesisApprovedAt },
    analyzing: { estimatePhase: "analyzing", actualIso: selectedForAnalyzingAt },
    business_case: { estimatePhase: "business_case", actualIso: businessCaseApprovedAt },
    backlog: { estimatePhase: "backlog", actualPhase: "backlog" },
    implementation_started: {
      estimatePhase: "implementation_started",
      actualIso: implementationStartedAt,
    },
    implementation: { estimatePhase: "implementation", actualPhase: "implementation" },
    done: { estimatePhase: "done", actualIso: impactRecognizedAt },
  };

  const phases: {
    key: string;
    title: string;
    subtitle: string;
    level: string;
    estimatePhase?: TimelineEstimatePhase;
    actualPhase?: TimelineManualPhase;
    actualIso?: string | null;
    expandable?: boolean;
  }[] = LIFECYCLE_STEPS.map((step) => ({
    key: step.key,
    title: step.label,
    subtitle: step.description,
    level: step.gate,
    ...EXTRAS[step.key],
  }));

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
   * Aufgeklappter Inhalt je Phase — heute nur noch die Owner-Nominierung an
   * „Selected for Detailing". Die Freigaben von Hypothese und Business Case
   * hingen einmal an den Phasen „Business hypothesis done" und „Business Case";
   * sie sind in die Reifegrad-Schritte L0 → L1 und L2 → L3.1 aufgegangen und
   * werden über die Gate-Karte am Kopf der Seite geführt.
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
    return null;
  }

  return (
    <div className="space-y-6" data-tour="epic-timeline-tab">
      <section className="space-y-2 rounded-lg border bg-card p-3.5">
        <SectionLabel>Reifegrad-Wechsel</SectionLabel>
        <GateHistoryList history={gateHistory} userLabels={userLabels} />
      </section>

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
                {phases.slice(g.start, g.start + g.span).map((phase) => {
                  return (
                    <li
                      key={phase.key}
                      className="grid grid-cols-[1.25rem_1fr] gap-x-3 gap-y-2 sm:grid-cols-[1.25rem_minmax(0,1fr)_11rem_11rem]"
                    >
                      <div className="flex justify-center sm:pt-0.5">
                        <StatusIcon status={statusFor(phase.key)} />
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
