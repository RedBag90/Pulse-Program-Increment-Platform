"use client";

import { useActionState, useState, useEffect } from "react";
import { Trash2 } from "lucide-react";
import {
  saveTargetOutcomeAction,
  deleteTargetOutcomeAction,
} from "@/features/transformation/actions/target-outcome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { KpiEditorData } from "@/server/views/transformation-goals";

interface Props {
  /** Existing KPI to edit, or null for a draft row. */
  kpi: KpiEditorData | null;
  /** Used when creating a new KPI bound to a goal. Ignored when editing. */
  goalId: string | null;
  /** Whether to render the Save / Delete buttons (gates on target.manage). */
  canManage: boolean;
  /** Called after a successful save of a brand-new KPI so the parent can drop the draft row. */
  onCreated?: (() => void) | undefined;
  /** Called after a successful delete so the parent can drop the row. */
  onDeleted?: (() => void) | undefined;
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function toNum(s: string): number | null {
  const t = s.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/**
 * Progress of a KPI relative to its baseline → target band (0..1, clamped).
 * Centralised here so the inline progress bar stays in sync with the cockpit's
 * `goalKpiProgress`.
 */
function kpiProgress(baseline: number | null, target: number, current: number | null): number {
  const start = baseline ?? 0;
  const denom = target - start;
  if (denom === 0) return current != null ? 1 : 0;
  return Math.min(1, Math.max(0, ((current ?? start) - start) / denom));
}

/**
 * One KPI as an editable row — replaces the old "edit current only, delete-and-
 * recreate for everything else" UX. All fields (title, unit, baseline, target,
 * current, dueDate) are in-place editable; one Save button per row commits via
 * `saveTargetOutcomeAction` with the full JSON payload (the action's schema
 * requires `target`, so partial updates aren't possible — we send the whole row).
 *
 * Draft rows (`kpi === null`) collect local field state and submit; on success
 * the parent drops the draft via `onCreated`. Pending and error state are
 * scoped to this row so editing one KPI doesn't block typing in another.
 */
export function KpiEditorRow({ kpi, goalId, canManage, onCreated, onDeleted }: Props) {
  const [title, setTitle] = useState(kpi?.title ?? "");
  const [unit, setUnit] = useState(kpi?.metricUnit ?? "");
  const [baseline, setBaseline] = useState(kpi?.baseline?.toString() ?? "");
  const [target, setTarget] = useState(kpi?.target?.toString() ?? "");
  const [current, setCurrent] = useState(kpi?.current?.toString() ?? "");
  const [dueDate, setDueDate] = useState(kpi?.dueDate ?? "");

  const [saveState, save, saving] = useActionState(saveTargetOutcomeAction, {});
  const [deleteState, del, deleting] = useActionState(deleteTargetOutcomeAction, {});

  // After a brand-new KPI is saved successfully, let the parent collapse the draft row.
  useEffect(() => {
    if (kpi === null && saveState.success && onCreated) onCreated();
  }, [kpi, saveState.success, onCreated]);

  // After a successful delete, let the parent drop the row.
  useEffect(() => {
    if (deleteState.success && onDeleted) onDeleted();
  }, [deleteState.success, onDeleted]);

  function submit() {
    const targetNum = toNum(target);
    if (targetNum === null || title.trim() === "") return;
    const payload = {
      id: kpi?.id ?? null,
      goalId: kpi?.goalId ?? goalId,
      title: title.trim(),
      metricUnit: unit.trim() === "" ? null : unit.trim(),
      baseline: toNum(baseline),
      target: targetNum,
      current: toNum(current),
      dueDate: dueDate === "" ? null : dueDate,
    };
    const fd = new FormData();
    fd.set("payload", JSON.stringify(payload));
    save(fd);
  }

  function remove() {
    if (!kpi) return;
    if (!window.confirm(`KPI „${kpi.title}" löschen?`)) return;
    const fd = new FormData();
    fd.set("id", kpi.id);
    del(fd);
  }

  const targetNum = toNum(target);
  const baselineNum = toNum(baseline);
  const currentNum = toNum(current);
  const progress = targetNum !== null ? kpiProgress(baselineNum, targetNum, currentNum) : 0;
  const canSave = canManage && title.trim() !== "" && targetNum !== null && !saving;
  const disabled = !canManage || saving || deleting;

  return (
    <div className="space-y-3 rounded-md border bg-card p-3">
      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto_auto]">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Titel</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="z. B. NPS"
            disabled={disabled}
            className="h-8"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Einheit</Label>
          <Input
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="%, Tage…"
            disabled={disabled}
            className="h-8 w-20"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Basis</Label>
          <Input
            type="number"
            value={baseline}
            onChange={(e) => setBaseline(e.target.value)}
            placeholder="—"
            disabled={disabled}
            className="h-8 w-20 tabular-nums"
            step="any"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Ziel</Label>
          <Input
            type="number"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="Pflicht"
            disabled={disabled}
            className="h-8 w-20 tabular-nums"
            step="any"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Aktuell</Label>
          <Input
            type="number"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            placeholder="—"
            disabled={disabled}
            className="h-8 w-20 tabular-nums"
            step="any"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[120px]">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: pct(progress) }} />
          </div>
        </div>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {currentNum ?? "—"} / {targetNum ?? "—"} · {pct(progress)}
        </span>
        {canManage && (
          <div className="flex shrink-0 items-center gap-2">
            <Label
              className="text-xs text-muted-foreground"
              htmlFor={`kpi-due-${kpi?.id ?? "new"}`}
            >
              bis
            </Label>
            <Input
              id={`kpi-due-${kpi?.id ?? "new"}`}
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              disabled={disabled}
              className="h-8 w-36"
            />
            <Button type="button" size="sm" variant="outline" disabled={!canSave} onClick={submit}>
              {saving ? "…" : "Speichern"}
            </Button>
            {kpi && (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-8"
                disabled={disabled}
                aria-label="KPI löschen"
                onClick={remove}
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
        )}
      </div>

      {(saveState.error || deleteState.error) && (
        <p role="alert" className="text-xs text-destructive">
          {saveState.error ?? deleteState.error}
        </p>
      )}
    </div>
  );
}
