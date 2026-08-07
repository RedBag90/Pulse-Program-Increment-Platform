"use client";

import { useCallback, useEffect, useRef, useState, startTransition, useActionState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Plus } from "lucide-react";
import { GoalStatusPill } from "@/features/ziele/components/goal-status/goal-status-pill";
import { GoalStatusSelect } from "@/features/ziele/components/goal-status/goal-status-select";
import { GoalActivityFeed } from "@/features/ziele/components/goal-status/goal-activity-feed";
import { checkInGoalAction, updateGoalProgressAction } from "@/features/ziele/actions/ziele";
import { getGoalDetailAction, type GoalDetailPayload } from "@/features/ziele/actions/goal-detail";
import { suggestOpenStatus, type GoalStatus } from "@/domain/goal-status";

// recharts (~150 kb gz) erst laden, wenn das Detail-Panel gerendert wird (Drawer
// offen mit Verlauf) — nicht im Initial-Bundle des immer-gemounteten Drawers.
const GoalProgressChart = dynamic(
  () => import("./goal-progress-chart").then((m) => m.GoalProgressChart),
  { ssr: false, loading: () => <div className="h-48 w-full animate-pulse rounded-lg bg-muted" /> },
);
import { metricUnitSuffix } from "@/domain/goal-metric";
import type { GoalTarget } from "@/server/views/ziele-view";

interface Props {
  target: GoalTarget;
  id: string;
  status: string | null;
  /** Normalised progress 0..1. */
  progress: number;
  /** Human "current value" (e.g. KR current/target). */
  currentValueLabel: string;
  /** Optionaler Hinweis unter „Aktueller Wert" (z. B. Kaskaden-Erklärung). */
  currentValueHint?: string | null | undefined;
  canEdit: boolean;
  /** Fortschrittsquelle (manual | rollup | auto_kpi) — steuert Wert-Pflege. */
  progressMode?: string | null | undefined;
  /** Ist-Wert für die Vorbelegung des Wert-Update-Dialogs. */
  krCurrent?: number | null | undefined;
  metricType?: string | null | undefined;
  precision?: number | null | undefined;
  currencyCode?: string | null | undefined;
}

/**
 * Asana-style goal detail — status pill + "Update status" check-in, the
 * completion/current/latest cards, a progress history chart with an
 * "Update progress" flow for manual KRs, and the activity feed. Loads its
 * history/comments on mount and re-fetches after each mutation.
 */
export function GoalDetailPanel({
  target,
  id,
  status,
  progress,
  currentValueLabel,
  currentValueHint,
  canEdit,
  progressMode,
  krCurrent,
  metricType,
  precision,
  currencyCode,
}: Props) {
  const router = useRouter();
  const [detail, setDetail] = useState<GoalDetailPayload | null>(null);
  const [checkinState, checkInRun, checkInPending] = useActionState(checkInGoalAction, {});
  const [progressState, progressRun, progressPending] = useActionState(
    updateGoalProgressAction,
    {},
  );

  const [progressOpen, setProgressOpen] = useState(false);
  const [progressValue, setProgressValue] = useState("");
  const [progressDate, setProgressDate] = useState("");

  // Status-Update-Composer: gewählter Status + Datum (setzt den Graf-Punkt) + Sektionen
  // + optional neuer Ist-Wert (nur manuelle Ziele).
  const [composerStatus, setComposerStatus] = useState<GoalStatus | null>(null);
  const [composerDate, setComposerDate] = useState("");
  const [composerValue, setComposerValue] = useState("");
  const [sections, setSections] = useState<{ title: string; body: string }[]>([]);

  // Ist-Wert direkt pflegbar nur bei manueller Fortschrittsquelle.
  const isManualValue = target === "kr" && progressMode === "manual";

  const reloadDetail = useCallback(() => {
    getGoalDetailAction(target, id).then((d) => setDetail(d));
  }, [target, id]);

  useEffect(() => {
    let alive = true;
    getGoalDetailAction(target, id).then((d) => {
      if (alive) setDetail(d);
    });
    return () => {
      alive = false;
    };
  }, [target, id]);

  // Re-fetch history + refresh the server tree after any completed mutation
  // (state identity changes once per dispatched action).
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    reloadDetail();
    router.refresh();
    if (!progressState.error) setProgressOpen(false);
    if (!checkinState.error) setComposerStatus(null);
  }, [checkinState, progressState, reloadDetail, router, progressState.error, checkinState.error]);

  // Statuswahl öffnet den Composer (Datum + Sektionen + ggf. Wert), submitted noch nicht.
  function openComposer(next: GoalStatus) {
    setComposerStatus(next);
    setComposerDate(new Date().toISOString().slice(0, 10));
    setComposerValue(isManualValue && krCurrent != null ? String(krCurrent) : "");
    setSections([{ title: "", body: "" }]);
  }

  function saveCheckin() {
    if (!composerStatus) return;
    const clean = sections
      .map((s) => ({ title: s.title.trim(), body: s.body.trim() }))
      .filter((s) => s.title !== "" || s.body !== "");
    const fd = new FormData();
    fd.set("target", target);
    fd.set("id", id);
    fd.set("status", composerStatus);
    // Server friert den (ggf. neuen) Ist-Wert ein; progress als Fallback für Rollup/Objective.
    fd.set("progress", String(progress));
    if (isManualValue && composerValue.trim() !== "") fd.set("value", composerValue);
    if (composerDate) fd.set("entryDate", composerDate);
    if (clean.length > 0) fd.set("sections", JSON.stringify(clean));
    startTransition(() => checkInRun(fd));
  }

  function openProgress() {
    setProgressValue(krCurrent != null ? String(krCurrent) : "");
    setProgressDate(new Date().toISOString().slice(0, 10));
    setProgressOpen(true);
  }

  function saveProgress() {
    if (progressValue.trim() === "") return;
    const fd = new FormData();
    fd.set("id", id);
    fd.set("value", progressValue);
    if (progressDate) fd.set("entryDate", progressDate);
    startTransition(() => progressRun(fd));
  }

  const pct = Math.round(progress * 100);
  const suggested = suggestOpenStatus(progress);
  // „Latest status" aus dem authoritativen `status` (= objective.status, wie die
  // Pill); die Zeit aus dem jüngsten Status-Check-in. Nicht aus dem Feed ableiten
  // — dort kollidiert das gleichnamige Audit-Event `goal.checkin` (ohne detail).
  const latestStatusAt =
    (detail?.checkins ?? []).filter((c) => c.status != null).at(-1)?.at ?? null;

  // Graf-Serie kommt fertig aus dem Loader: die Linie folgt der Fortschrittsquelle,
  // Punkte sind die eigenen Status-Updates (Farbe = Status).
  const chart = detail?.progressChart;
  const chartData = chart?.series ?? [];
  const metricSpec = { metricType, precision, currencyCode };
  // Value-Modus zeigt Rohwerte in der Ziel-Einheit; Rollup zeigt %.
  const unitSuffix = chart?.mode === "value" ? metricUnitSuffix(metricSpec) : " %";

  return (
    <div className="space-y-5">
      {/* Status row — nur der Select (der Status-Indikator lebt in der „Letzter
          Status"-Card, sonst steht dieselbe Info doppelt). */}
      {canEdit && (
        <div className="flex items-center gap-3">
          <GoalStatusSelect
            value={composerStatus ?? status}
            suggested={suggested}
            onChange={openComposer}
            disabled={checkInPending}
          />
        </div>
      )}

      {/* Status-Update-Composer */}
      {composerStatus && canEdit && (
        <div className="space-y-3 rounded-lg border bg-muted/10 p-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Status-Update · <GoalStatusPill status={composerStatus} />
            </p>
            <button
              type="button"
              onClick={() => setSections((s) => [...s, { title: "", body: "" }])}
              className="text-xs text-primary hover:underline"
            >
              + Sektion
            </button>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Datum des Punkts
              </span>
              <input
                type="date"
                value={composerDate}
                onChange={(e) => setComposerDate(e.target.value)}
                className="mt-1 h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            {isManualValue && (
              <label className="block">
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Aktueller Wert
                </span>
                <input
                  type="number"
                  step="any"
                  value={composerValue}
                  onChange={(e) => setComposerValue(e.target.value)}
                  className="mt-1 h-9 w-32 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
            )}
            <p className="pb-2 text-[11px] text-muted-foreground">
              {isManualValue
                ? "Der eingetragene Ist-Wert wird am gewählten Datum als farbiger Punkt eingefroren."
                : "Der aktuelle Ist-Wert wird am gewählten Datum als farbiger Punkt eingefroren."}
            </p>
          </div>
          <div className="space-y-2">
            {sections.map((s, i) => (
              <div key={i} className="space-y-1 rounded-md border bg-background p-2">
                <div className="flex items-center gap-2">
                  <input
                    value={s.title}
                    onChange={(e) =>
                      setSections((arr) =>
                        arr.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)),
                      )
                    }
                    placeholder="Titel (z. B. Zusammenfassung)"
                    className="h-8 flex-1 rounded border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  {sections.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setSections((arr) => arr.filter((_, j) => j !== i))}
                      className="text-xs text-muted-foreground hover:text-destructive"
                      aria-label="Sektion entfernen"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <textarea
                  value={s.body}
                  onChange={(e) =>
                    setSections((arr) =>
                      arr.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)),
                    )
                  }
                  rows={2}
                  placeholder="Text…"
                  className="w-full rounded border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            ))}
          </div>
          <div className="flex items-center justify-end gap-2">
            {checkinState.error && (
              <span className="mr-auto text-xs text-destructive">{checkinState.error}</span>
            )}
            <button
              type="button"
              onClick={() => setComposerStatus(null)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={saveCheckin}
              disabled={checkInPending}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {checkInPending ? "Speichert…" : "Status posten"}
            </button>
          </div>
        </div>
      )}

      {/* Cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card label="Zielerreichung" value={`${pct} %`} accent />
        <Card
          label="Aktueller Wert"
          value={currentValueLabel || "—"}
          {...(currentValueHint ? { hint: currentValueHint } : {})}
        />
        <div className="rounded-xl border bg-card p-3.5 shadow-sm">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Letzter Status
          </p>
          <div className="mt-1.5">
            <GoalStatusPill status={status} />
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {latestStatusAt ? relTime(latestStatusAt) : "kein Check-in"}
          </p>
        </div>
      </div>

      {/* Progress */}
      {(isManualValue || chartData.length > 0) && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Fortschritt
            </p>
            {isManualValue && canEdit && !progressOpen && (
              <button
                type="button"
                onClick={openProgress}
                className="inline-flex items-center gap-1 rounded-md border bg-background px-2.5 py-1 text-xs font-medium shadow-xs hover:bg-muted/50"
              >
                <Plus className="size-3.5" /> Fortschritt aktualisieren
              </button>
            )}
          </div>

          {progressOpen && (
            <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-muted/10 p-3">
              <label className="block">
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Aktueller Wert{unitSuffix ? ` (${unitSuffix.trim()})` : ""}
                </span>
                <input
                  type="number"
                  step="any"
                  value={progressValue}
                  onChange={(e) => setProgressValue(e.target.value)}
                  className="mt-1 h-9 w-36 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  autoFocus
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Datum
                </span>
                <input
                  type="date"
                  value={progressDate}
                  onChange={(e) => setProgressDate(e.target.value)}
                  className="mt-1 h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={saveProgress}
                  disabled={progressPending || progressValue.trim() === ""}
                  className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {progressPending ? "Speichert…" : "Speichern"}
                </button>
                <button
                  type="button"
                  onClick={() => setProgressOpen(false)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Abbrechen
                </button>
              </div>
              {progressState.error && (
                <p className="w-full text-xs text-destructive">{progressState.error}</p>
              )}
            </div>
          )}

          {chart && chartData.length > 0 && (
            <GoalProgressChart data={chartData} yDomain={chart.yDomain} unitSuffix={unitSuffix} />
          )}
        </div>
      )}

      {/* Ladezustand: Verlauf + Aktivität werden async geholt (getGoalDetailAction). */}
      {!detail && (
        <div className="space-y-3" aria-hidden>
          <div className="h-40 w-full animate-pulse rounded-lg bg-muted" />
          <div className="h-3.5 w-28 animate-pulse rounded bg-muted" />
          <div className="h-3 w-full animate-pulse rounded bg-muted" />
          <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
        </div>
      )}

      {/* Activity + comments */}
      {detail && (
        <GoalActivityFeed
          target={target}
          id={id}
          activity={detail.activity}
          userLabels={detail.userLabels}
          canComment={canEdit}
        />
      )}
    </div>
  );
}

function Card({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border bg-card p-3.5 shadow-sm">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${accent ? "text-primary" : ""}`}>
        {value}
      </p>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const day = Math.floor(diff / 86_400_000);
  if (day <= 0) return "heute";
  if (day === 1) return "gestern";
  return `vor ${day} Tagen`;
}
