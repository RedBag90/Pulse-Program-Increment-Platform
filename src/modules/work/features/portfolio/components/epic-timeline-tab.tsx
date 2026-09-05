"use client";

import { useActionState, useState, startTransition } from "react";
import { CheckCircle2, CircleDot, Circle, Lock, ChevronRight } from "lucide-react";
import {
  lifecycleSpans,
  type LifecycleSpan,
} from "@/modules/work/features/portfolio/lib/epic-lifecycle";
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
  /** Investitionsentscheidung (L3.2) — Rückfall, wenn kein Ist gepflegt ist. */
  approvedAt: string | null;
  /** Bestätigte fertige Umsetzung (L4.2) — ebenso als Rückfall. */
  implementationCompletedAt: string | null;
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
 * Die Zeitleiste eines Epics: **acht Prozessabschnitte, getrennt durch acht
 * Tore**, entlang einer Bahn, die sichtbar durch jedes Tor hindurchläuft.
 *
 * Der **Abschnitt** sagt, woran gearbeitet wird und wie lange schon; das **Tor**
 * darunter, was erreicht ist, wenn das Epic die Schwelle überschreitet — mit
 * Soll und Ist, denn ein Datum ist ein Ereignis, keine Strecke.
 *
 * Vorher waren es neun gleichartige Zeilen, in denen Prozess und Meilenstein
 * nicht auseinanderzuhalten waren; zwei davon trugen zwei Namen für dasselbe
 * Tor (→L1). Die Dauern sind rein abgeleitet (`lifecycleSpans`), ohne ein
 * einziges neues Feld: ein Abschnitt läuft vom vorigen Tor bis zu seinem
 * eigenen — oder, solange das offen ist, bis heute.
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
  approvedAt,
  implementationCompletedAt,
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

  // Ein Eintrag je Abschnitt: der Schritt (aus dem geteilten Modell), seine
  // Dauer und das Ist-Datum seines Tores. Titel, Beschreibung, Reifegrad und
  // Meilenstein kommen aus `LIFECYCLE_STEPS` — dieselbe Quelle, aus der der
  // Stepper über der Fläche liest; die Zeitleiste schreibt sie nicht selbst.
  //
  // Zwei Tore lesen ihr Ist aus einem **manuell** gepflegten Feld. Ist dort
  // nichts gepflegt, springt der Workflow-Stempel ein — sonst risse die Kette
  // der Dauern genau in der Mitte, sobald jemand die zwei Felder auslässt.
  const gateActualIso: Record<string, string | null> = {
    detailing: selectedForDetailingAt,
    hypothesis: hypothesisApprovedAt,
    analyzing: selectedForAnalyzingAt,
    business_case: businessCaseApprovedAt,
    backlog: actuals.backlog || approvedAt,
    implementation_started: implementationStartedAt,
    implementation: actuals.implementation || implementationCompletedAt,
    done: impactRecognizedAt,
  };

  const toDate = (iso: string | null | undefined): Date | null => {
    if (!iso) return null;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const runningIndex = lifecycleSteps.findIndex((s) => s.status === "current");
  const spans = lifecycleSpans({
    createdAt: new Date(createdAt),
    gateActuals: lifecycleSteps.map((s) => toDate(gateActualIso[s.key])),
    runningIndex: runningIndex === -1 ? null : runningIndex,
    now: new Date(),
  });

  const rows = lifecycleSteps.map((step, i) => ({
    step,
    span: spans[i]!,
    /** Nur die zwei Tore mit manuell gepflegtem Ist sind hier bearbeitbar. */
    manualPhase: (step.key === "backlog"
      ? "backlog"
      : step.key === "implementation"
        ? "implementation"
        : null) as TimelineManualPhase | null,
    actualIso: gateActualIso[step.key] ?? null,
  }));

  const groups = reifegradGroups(rows.map((r) => r.step.gate));

  /** Das Soll eines Tores — vom Owner geschätzt. */
  function SollCell({ phase }: { phase: TimelineEstimatePhase }) {
    return canEdit ? (
      <input
        type="date"
        aria-label="Soll"
        value={estimates[phase]}
        onChange={(e) => setEstimates((p) => ({ ...p, [phase]: e.target.value }))}
        className={`${INPUT} w-full`}
      />
    ) : (
      <span className="text-sm text-muted-foreground/80">{fmt(estimates[phase])}</span>
    );
  }

  /** Das Ist eines Tores — Stempel, oder für zwei Tore ein gepflegtes Feld. */
  function IstCell({ row }: { row: (typeof rows)[number] }) {
    const estimate = estimates[row.step.key as TimelineEstimatePhase] ?? "";
    const variance =
      estimate && row.actualIso ? (
        <VarianceBadge estimate={estimate} actual={row.actualIso} />
      ) : null;

    if (row.manualPhase === "backlog" && canEdit) {
      return (
        <div className="space-y-1">
          <ManualActualCell phase="backlog" />
          {variance}
        </div>
      );
    }
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-sm">{fmt(row.actualIso)}</span>
        {variance}
      </div>
    );
  }

  /** „7 Tage" · „läuft seit 12.6. · Tag 3" · „noch nicht begonnen". */
  function Dauer({ span }: { span: LifecycleSpan }) {
    if (span.days == null) {
      return <span className="text-[11px] text-muted-foreground/70">noch nicht begonnen</span>;
    }
    const label = span.running
      ? `läuft seit ${fmt(span.from?.toISOString() ?? null)} · Tag ${span.days}`
      : `${span.days} ${span.days === 1 ? "Tag" : "Tage"}`;
    return (
      <span
        className={`text-[11px] tabular-nums ${span.running ? "font-medium text-primary" : "text-muted-foreground/70"}`}
      >
        {label}
      </span>
    );
  }

  return (
    <div className="space-y-6" data-tour="epic-timeline-tab">
      <section className="space-y-2 rounded-lg border bg-card p-3.5">
        <SectionLabel>Reifegrad-Wechsel</SectionLabel>
        <GateHistoryList history={gateHistory} userLabels={userLabels} />
      </section>

      {/* Spaltenköpfe (Desktop) — der Versatz links entspricht der Bahn. */}
      <div className="hidden gap-x-3 pl-[4.5rem] sm:grid sm:grid-cols-[minmax(0,1fr)_9rem_9rem]">
        <SectionLabel>Prozess &amp; Tore</SectionLabel>
        <SectionLabel>Soll</SectionLabel>
        <SectionLabel>Ist</SectionLabel>
      </div>

      {/* Ein Block je Reifegrad-Gruppe: links das L-Kürzel, rechts die Bahn mit
          ihren Abschnitten und Toren. */}
      <div className="space-y-2">
        {groups.map((g) => (
          <div key={`${g.level}-${g.start}`} className="flex gap-3">
            <div
              className="flex w-[2.5rem] shrink-0 items-start justify-end gap-2 pt-4"
              title={STAGE_GATE_LABELS[g.level] ?? g.level}
            >
              <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">
                {g.level}
              </span>
              <span className="w-px self-stretch bg-border" />
            </div>

            {/* Die Bahn: eine durchgehende Spur, durch die jedes Tor sichtbar
                hindurchgeht — der Knoten liegt über dem Torrahmen. */}
            <ol className="relative flex-1 pl-8">
              <span
                aria-hidden
                className="absolute bottom-0 left-2 top-0 w-2 rounded-full bg-muted"
              />
              {rows.slice(g.start, g.start + g.span).map((row) => {
                const { step, span } = row;
                const gate = step.milestone;
                const isNext = step.milestoneStatus === "current";
                const isDone = step.milestoneStatus === "done";
                const soft = gate.step === null;
                return (
                  <li key={step.key} className="relative">
                    {/* Abschnitt — was getan wird, und wie lange schon. */}
                    <div className="py-3">
                      <div className="flex items-center gap-2">
                        <StatusIcon status={step.status} />
                        <p
                          className={`text-sm font-medium ${step.status === "current" ? "text-primary" : ""}`}
                        >
                          {step.label}
                        </p>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{step.description}</p>
                      <p className="mt-1">
                        <Dauer span={span} />
                      </p>
                    </div>

                    {/* Tor — was erreicht ist, wenn die Schwelle überschritten wird. */}
                    <div className="relative -ml-8">
                      <span
                        aria-hidden
                        className={`absolute left-2 top-1/2 z-10 h-8 w-2 -translate-y-1/2 rounded-full ${
                          isDone ? "bg-emerald-600" : isNext ? "bg-primary" : "bg-muted"
                        }`}
                      />
                      <div
                        className={`grid grid-cols-1 gap-2 rounded-lg border-2 bg-card py-3 pl-11 pr-4 sm:grid-cols-[minmax(0,1fr)_9rem_9rem] sm:items-center ${
                          isNext
                            ? "border-primary bg-primary/5"
                            : isDone
                              ? "border-emerald-600/60"
                              : "border-border"
                        } ${soft ? "border-dashed" : ""}`}
                      >
                        <div className="min-w-0">
                          {soft ? (
                            <button
                              type="button"
                              onClick={() => toggle(step.key)}
                              aria-expanded={expanded.has(step.key)}
                              className={`flex items-center gap-1 text-sm font-semibold hover:text-primary ${isNext ? "text-primary" : ""}`}
                            >
                              <ChevronRight
                                className={`size-3.5 shrink-0 transition-transform ${
                                  expanded.has(step.key) ? "rotate-90" : ""
                                }`}
                              />
                              {gate.label}
                            </button>
                          ) : (
                            <p className={`text-sm font-semibold ${isNext ? "text-primary" : ""}`}>
                              {gate.label}
                            </p>
                          )}
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            <span className="mr-1.5 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                              {soft ? "Meilenstein" : "Gate"}
                            </span>
                            {gate.approver}
                          </p>
                        </div>
                        <SollCell phase={step.key as TimelineEstimatePhase} />
                        <IstCell row={row} />
                        {soft && expanded.has(step.key) && (
                          <div className="sm:col-span-3">
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
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
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
