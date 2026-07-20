"use client";

import { useCallback, useEffect, useRef, useState, startTransition, useActionState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { GoalStatusPill } from "@/features/ziele/components/goal-status/goal-status-pill";
import { GoalStatusSelect } from "@/features/ziele/components/goal-status/goal-status-select";
import { GoalActivityFeed } from "@/features/ziele/components/goal-status/goal-activity-feed";
import { checkInGoalAction, updateGoalProgressAction } from "@/features/ziele/actions/ziele";
import { getGoalDetailAction, type GoalDetailPayload } from "@/features/ziele/actions/goal-detail";
import { suggestOpenStatus, goalStatusLabel, type GoalStatus } from "@/domain/goal-status";
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
  canEdit: boolean;
  /** KR formula — "manual" enables the Update-progress flow. */
  formula?: string | null | undefined;
  /** Raw KR metric context for the chart axis + the progress dialog. */
  krBaseline?: number | null | undefined;
  krTarget?: number | null | undefined;
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
  canEdit,
  formula,
  krBaseline,
  krTarget,
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

  const isManualKr = target === "kr" && formula === "manual";

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
  }, [checkinState, progressState, reloadDetail, router, progressState.error]);

  function checkIn(next: GoalStatus) {
    const fd = new FormData();
    fd.set("target", target);
    fd.set("id", id);
    fd.set("status", next);
    // Server freezes the value-at-time for manual KRs; this is used for
    // objectives / auto-KRs only.
    fd.set("progress", String(progress));
    startTransition(() => checkInRun(fd));
  }

  function openProgress() {
    setProgressValue(krCurrent != null ? String(krCurrent) : "");
    setProgressDate("");
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
  const latest = detail?.activity.find((a) => a.action === "goal.checkin");

  const chartData = (detail?.checkins ?? [])
    .filter((c) => (isManualKr ? c.value != null : c.progress != null))
    .map((c) => ({
      at: new Date(c.at).toLocaleDateString("de-DE", { day: "2-digit", month: "short" }),
      value: isManualKr ? (c.value ?? 0) : Math.round((c.progress ?? 0) * 100),
    }));
  const chartVals = chartData.map((d) => d.value);
  const yDomain: [number, number] = isManualKr
    ? [
        Math.min(...(krBaseline != null ? [krBaseline] : []), ...chartVals),
        Math.max(...(krTarget != null ? [krTarget] : []), ...chartVals),
      ]
    : [0, 100];
  const metricSpec = { metricType, precision, currencyCode };
  // Für manuelle KRs zeigt die Achse Rohwerte in der KR-Einheit; sonst %.
  const unitSuffix = isManualKr ? metricUnitSuffix(metricSpec) : " %";

  return (
    <div className="space-y-5">
      {/* Status row */}
      <div className="flex items-center gap-3">
        <GoalStatusPill status={status} />
        {canEdit && (
          <GoalStatusSelect
            value={status}
            suggested={suggested}
            onChange={checkIn}
            disabled={checkInPending}
          />
        )}
      </div>

      {/* Cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card label="Goal completion" value={`${pct} %`} />
        <Card label="Current value" value={currentValueLabel || "—"} />
        <Card
          label="Latest status"
          value={latest ? goalStatusLabel(latest.detail) : "—"}
          hint={latest ? relTime(latest.at) : "kein Check-in"}
        />
      </div>

      {/* Progress */}
      {(isManualKr || chartData.length > 0) && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Progress
            </p>
            {isManualKr && canEdit && !progressOpen && (
              <button
                type="button"
                onClick={openProgress}
                className="inline-flex items-center gap-1 rounded-md border bg-background px-2.5 py-1 text-xs font-medium shadow-xs hover:bg-muted/50"
              >
                <Plus className="size-3.5" /> Update progress
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
                  Datum (optional)
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

          {chartData.length > 0 && (
            <div className="h-40 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="at" tick={{ fontSize: 11 }} />
                  <YAxis domain={yDomain} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => `${v}${unitSuffix}`} />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="var(--primary)"
                    strokeWidth={2}
                    dot
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
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

function Card({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
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
