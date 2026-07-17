"use client";

import { useEffect, useState, startTransition, useActionState } from "react";
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
import { checkInGoalAction } from "@/features/ziele/actions/ziele";
import { getGoalDetailAction, type GoalDetailPayload } from "@/features/ziele/actions/goal-detail";
import { suggestOpenStatus, goalStatusLabel, type GoalStatus } from "@/domain/goal-status";
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
}

/**
 * Asana-style goal detail — status pill + "Update status" check-in, the
 * completion/current/latest cards, a progress history chart and the activity
 * feed. Loads its history/comments on mount via `getGoalDetailAction`.
 */
export function GoalDetailPanel({
  target,
  id,
  status,
  progress,
  currentValueLabel,
  canEdit,
}: Props) {
  const [detail, setDetail] = useState<GoalDetailPayload | null>(null);
  const [, checkInRun, checkInPending] = useActionState(checkInGoalAction, {});

  useEffect(() => {
    let alive = true;
    getGoalDetailAction(target, id).then((d) => {
      if (alive) setDetail(d);
    });
    return () => {
      alive = false;
    };
  }, [target, id]);

  function checkIn(next: GoalStatus) {
    const fd = new FormData();
    fd.set("target", target);
    fd.set("id", id);
    fd.set("status", next);
    fd.set("progress", String(progress));
    startTransition(() => checkInRun(fd));
  }

  const pct = Math.round(progress * 100);
  const suggested = suggestOpenStatus(progress);
  const latest = detail?.activity.find((a) => a.action === "goal.checkin");

  const chartData = (detail?.checkins ?? [])
    .filter((c) => c.progress != null)
    .map((c) => ({
      at: new Date(c.at).toLocaleDateString("de-DE", { day: "2-digit", month: "short" }),
      value: Math.round((c.progress ?? 0) * 100),
    }));

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

      {/* Progress chart */}
      {chartData.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Progress
          </p>
          <div className="h-40 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="at" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => `${v} %`} />
                <Line type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          </div>
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
