"use client";

import { useActionState, useState, useEffect } from "react";
import { Trash2, X, Plus } from "lucide-react";
import { Link } from "@/i18n/navigation";
import {
  saveGoalAction,
  deleteGoalAction,
  unlinkGoalEpicAction,
} from "@/features/transformation/actions/target-goal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { KpiEditorRow } from "@/features/transformation/components/kpi-editor-row";
import { EpicLinker } from "@/features/transformation/components/epic-linker";
import type { GoalEditorView, EpicOption, UserOption } from "@/server/views/transformation-goals";
import type { RagTier } from "@/domain/transformation-delta";

interface Props {
  /** The goal being edited, or null for the "+ Ziel" empty state. */
  goal: GoalEditorView | null;
  epicOptions: EpicOption[];
  userOptions: UserOption[];
  canManage: boolean;
  /** Called after a brand-new goal is saved so the shell can re-select the saved one. */
  onCreated?: () => void;
  /** Called after a successful delete so the shell can clear the selection. */
  onDeleted?: () => void;
}

const SELECT =
  "h-8 rounded-md border border-input bg-transparent px-2 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const GOAL_STATUS_LABELS: Record<string, string> = {
  active: "Aktiv",
  achieved: "Erreicht",
  archived: "Archiviert",
};

const TIER_CHIP: Record<RagTier, string> = {
  green: "bg-emerald-50 text-emerald-700 border-emerald-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  red: "bg-red-50 text-red-700 border-red-200",
  done: "bg-emerald-100 text-emerald-800 border-emerald-300",
};

const TIER_DOT: Record<RagTier, string> = {
  green: "🟢",
  amber: "🟡",
  red: "🔴",
  done: "✓",
};

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

/**
 * Right-pane editor for a single strategic goal (or "+ Ziel" in create mode).
 * Three stacked sections:
 *
 * - **Header** — title (Input), description (Textarea), status (native select
 *   for now — matches existing app pattern), owner select, due date. One
 *   "Speichern" button commits the whole header via `saveGoalAction`. Delete
 *   prompts a native `confirm()`.
 * - **KPIs** — list of `<KpiEditorRow>` (each row owns its own action state).
 *   "+ KPI" adds a draft row at the bottom; on first save, the draft is
 *   replaced by the persisted row (via the row's `onCreated` callback). Only
 *   rendered for persisted goals (a brand-new goal has no id yet).
 * - **Epics** — linked epic chips with × unlink, plus the searchable
 *   `<EpicLinker>` popover.
 *
 * The per-action `useActionState` model means saving the header or removing a
 * KPI doesn't disable the other section's controls.
 */
export function GoalDetailPane({
  goal,
  epicOptions,
  userOptions,
  canManage,
  onCreated,
  onDeleted,
}: Props) {
  const [title, setTitle] = useState(goal?.title ?? "");
  const [description, setDescription] = useState(goal?.description ?? "");
  const [ownerId, setOwnerId] = useState(goal?.ownerId ?? "");
  const [dueDate, setDueDate] = useState(goal?.dueDate ?? "");
  const [status, setStatus] = useState(goal?.status ?? "active");
  const [draftKpiVisible, setDraftKpiVisible] = useState(false);

  const [saveState, save, saving] = useActionState(saveGoalAction, {});
  const [deleteState, del, deleting] = useActionState(deleteGoalAction, {});
  const [unlinkState, unlink, unlinking] = useActionState(unlinkGoalEpicAction, {});

  // Reset header fields when the selected goal changes (URL navigation).
  useEffect(() => {
    setTitle(goal?.title ?? "");
    setDescription(goal?.description ?? "");
    setOwnerId(goal?.ownerId ?? "");
    setDueDate(goal?.dueDate ?? "");
    setStatus(goal?.status ?? "active");
    setDraftKpiVisible(false);
  }, [goal?.id, goal?.title, goal?.description, goal?.ownerId, goal?.dueDate, goal?.status]);

  // After a brand-new goal is saved, hand off to the shell.
  useEffect(() => {
    if (goal === null && saveState.success && onCreated) onCreated();
  }, [goal, saveState.success, onCreated]);

  useEffect(() => {
    if (deleteState.success && onDeleted) onDeleted();
  }, [deleteState.success, onDeleted]);

  function submitHeader() {
    if (title.trim() === "") return;
    const payload = {
      id: goal?.id ?? null,
      title: title.trim(),
      description: description.trim() === "" ? null : description.trim(),
      ownerId: ownerId === "" ? null : ownerId,
      dueDate: dueDate === "" ? null : dueDate,
      ...(goal ? { status } : {}),
    };
    const fd = new FormData();
    fd.set("payload", JSON.stringify(payload));
    save(fd);
  }

  function deleteGoal() {
    if (!goal) return;
    if (!window.confirm(`Ziel „${goal.title}" löschen? Alle KPIs werden mitgelöscht.`)) return;
    const fd = new FormData();
    fd.set("id", goal.id);
    del(fd);
  }

  function unlinkEpic(epicId: string) {
    if (!goal) return;
    const fd = new FormData();
    fd.set("goalId", goal.id);
    fd.set("epicId", epicId);
    unlink(fd);
  }

  const isNew = goal === null;
  const disabled = !canManage || saving || deleting;

  return (
    <div className="space-y-6">
      {/* Header card */}
      <section className="space-y-3 rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {isNew ? "Neues Ziel" : "Ziel bearbeiten"}
          </p>
          {goal && (
            <span
              className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${TIER_CHIP[goal.tier]}`}
            >
              {TIER_DOT[goal.tier]}{" "}
              {goal.status === "achieved"
                ? "erreicht"
                : goal.kpis.length > 0
                  ? pct(goal.kpiProgress)
                  : "noch keine KPIs"}
            </span>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="gd-title">Titel</Label>
          <Input
            id="gd-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="z. B. Time-to-Market halbieren"
            disabled={disabled}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="gd-desc">Beschreibung</Label>
          <Textarea
            id="gd-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Was steckt hinter dem Ziel?"
            rows={2}
            disabled={disabled}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <div className="space-y-1.5">
            <Label htmlFor="gd-owner">Verantwortlich</Label>
            <select
              id="gd-owner"
              className={`${SELECT} h-9 w-full`}
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
              disabled={disabled}
            >
              <option value="">— niemand —</option>
              {userOptions.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gd-due">Zieltermin</Label>
            <Input
              id="gd-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              disabled={disabled}
              className="h-9"
            />
          </div>
          {!isNew && (
            <div className="space-y-1.5">
              <Label htmlFor="gd-status">Status</Label>
              <select
                id="gd-status"
                className={`${SELECT} h-9`}
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                disabled={disabled}
              >
                {Object.entries(GOAL_STATUS_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {canManage && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <Button type="button" disabled={disabled || title.trim() === ""} onClick={submitHeader}>
              {saving ? "Speichert…" : isNew ? "Ziel anlegen" : "Speichern"}
            </Button>
            {!isNew && goal && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled}
                onClick={deleteGoal}
                className="text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="size-3.5" /> Löschen
              </Button>
            )}
          </div>
        )}

        {(saveState.error || deleteState.error) && (
          <p role="alert" className="text-sm text-destructive">
            {saveState.error ?? deleteState.error}
          </p>
        )}
      </section>

      {/* KPIs */}
      {goal && (
        <section className="space-y-3 rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-sm font-medium">KPIs</h2>
            {canManage && !draftKpiVisible && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setDraftKpiVisible(true)}
              >
                <Plus className="size-3.5" /> KPI hinzufügen
              </Button>
            )}
          </div>
          {goal.kpis.length === 0 && !draftKpiVisible ? (
            <p className="text-sm text-muted-foreground">
              Noch keine KPIs gebunden. Mit „KPI hinzufügen“ den ersten anlegen.
            </p>
          ) : (
            <ul className="space-y-3">
              {goal.kpis.map((k) => (
                <li key={k.id}>
                  <KpiEditorRow kpi={k} goalId={goal.id} canManage={canManage} />
                </li>
              ))}
              {draftKpiVisible && (
                <li>
                  <KpiEditorRow
                    kpi={null}
                    goalId={goal.id}
                    canManage={canManage}
                    onCreated={() => setDraftKpiVisible(false)}
                  />
                </li>
              )}
            </ul>
          )}
        </section>
      )}

      {/* Epics */}
      {goal && (
        <section className="space-y-3 rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-sm font-medium">Realisiert durch Epics</h2>
            {canManage && (
              <EpicLinker goalId={goal.id} epicOptions={epicOptions} linkedEpics={goal.epics} />
            )}
          </div>
          {goal.epics.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Epics verknüpft.</p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {goal.epics.map((e) => (
                <li
                  key={e.id}
                  className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs"
                >
                  <Link href={`/portfolio/epics/${e.id}`} className="hover:underline">
                    {e.title}
                  </Link>
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => unlinkEpic(e.id)}
                      disabled={unlinking}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label={`${e.title} lösen`}
                    >
                      <X className="size-3" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {unlinkState.error && (
            <p role="alert" className="text-xs text-destructive">
              {unlinkState.error}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
