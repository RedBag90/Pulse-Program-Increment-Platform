"use client";

import { useActionState, useState } from "react";
import { Trash2 } from "lucide-react";
import {
  saveGoalAction,
  deleteGoalAction,
  linkGoalEpicAction,
  unlinkGoalEpicAction,
} from "@/features/transformation/actions/target-goal";
import {
  saveTargetOutcomeAction,
  deleteTargetOutcomeAction,
} from "@/features/transformation/actions/target-outcome";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export interface KpiView {
  id: string;
  title: string;
  metricUnit: string | null;
  baseline: number | null;
  target: number;
  current: number | null;
}

export interface GoalView {
  id: string;
  title: string;
  description: string | null;
  ownerId: string | null;
  dueDate: string | null;
  status: string;
  kpis: KpiView[];
  epics: { id: string; title: string; status: string }[];
}

export interface EpicOption {
  id: string;
  title: string;
}
export interface UserOption {
  id: string;
  label: string;
}

interface Props {
  goals: GoalView[];
  epicOptions: EpicOption[];
  userOptions: UserOption[];
  canManage: boolean;
}

const SELECT =
  "h-8 rounded-md border border-input bg-transparent px-2 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const GOAL_STATUS_LABELS: Record<string, string> = {
  active: "Aktiv",
  achieved: "Erreicht",
  archived: "Archiviert",
};

export function kpiProgress(k: KpiView): number {
  const start = k.baseline ?? 0;
  const denom = k.target - start;
  if (denom === 0) return k.current != null ? 1 : 0;
  return Math.min(1, Math.max(0, ((k.current ?? start) - start) / denom));
}

function ownerName(ownerId: string | null, users: UserOption[]): string | null {
  if (!ownerId) return null;
  return users.find((u) => u.id === ownerId)?.label ?? ownerId;
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

/** One goal: header + KPIs (key results) + linked Epics. */
function GoalCard({
  goal,
  epicOptions,
  userOptions,
  canManage,
  busy,
  onStatus,
  onDelete,
  onSaveKpi,
  onDeleteKpi,
  onLinkEpic,
  onUnlinkEpic,
}: {
  goal: GoalView;
  epicOptions: EpicOption[];
  userOptions: UserOption[];
  canManage: boolean;
  busy: boolean;
  onStatus: (id: string, status: string) => void;
  onDelete: (id: string) => void;
  onSaveKpi: (
    goalId: string,
    kpi: {
      id?: string;
      title: string;
      target: number;
      unit: string | null;
      current: number | null;
    },
  ) => void;
  onDeleteKpi: (id: string) => void;
  onLinkEpic: (goalId: string, epicId: string) => void;
  onUnlinkEpic: (goalId: string, epicId: string) => void;
}) {
  const [kpiTitle, setKpiTitle] = useState("");
  const [kpiTarget, setKpiTarget] = useState("");
  const [kpiUnit, setKpiUnit] = useState("");
  const [epicToLink, setEpicToLink] = useState("");

  const owner = ownerName(goal.ownerId, userOptions);
  const linkedIds = new Set(goal.epics.map((e) => e.id));
  const linkable = epicOptions.filter((e) => !linkedIds.has(e.id));

  return (
    <section className="space-y-4 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-heading text-base font-medium">{goal.title}</h3>
          {goal.description && (
            <p className="mt-0.5 text-sm text-muted-foreground">{goal.description}</p>
          )}
          <p className="mt-0.5 text-xs text-muted-foreground">
            {owner ? `Verantwortlich: ${owner}` : "Kein:e Verantwortliche:r"}
            {goal.dueDate ? ` · bis ${goal.dueDate}` : ""}
          </p>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <select
              className={SELECT}
              value={goal.status}
              disabled={busy}
              onChange={(e) => onStatus(goal.id, e.target.value)}
              aria-label="Status"
            >
              {Object.entries(GOAL_STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-8"
              disabled={busy}
              aria-label="Ziel löschen"
              onClick={() => onDelete(goal.id)}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        )}
      </div>

      {/* KPIs */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">KPIs</p>
        {goal.kpis.length === 0 ? (
          <p className="text-xs text-muted-foreground">Noch keine KPIs.</p>
        ) : (
          <ul className="space-y-2">
            {goal.kpis.map((k) => {
              const unit = k.metricUnit ? ` ${k.metricUnit}` : "";
              return (
                <li key={k.id} className="space-y-1">
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-medium">{k.title}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {k.current ?? "—"} / {k.target}
                      {unit} · {pct(kpiProgress(k))}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: pct(kpiProgress(k)) }}
                      />
                    </div>
                    {canManage && (
                      <>
                        <Input
                          type="number"
                          className="h-7 w-20"
                          defaultValue={k.current ?? ""}
                          disabled={busy}
                          aria-label={`Ist-Wert ${k.title}`}
                          onBlur={(e) =>
                            onSaveKpi(goal.id, {
                              id: k.id,
                              title: k.title,
                              target: k.target,
                              unit: k.metricUnit,
                              current: toNum(e.target.value),
                            })
                          }
                        />
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="size-7"
                          disabled={busy}
                          aria-label="KPI löschen"
                          onClick={() => onDeleteKpi(k.id)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {canManage && (
          <div className="flex flex-wrap items-end gap-2">
            <Input
              className="h-8 flex-1"
              placeholder="KPI-Titel"
              value={kpiTitle}
              onChange={(e) => setKpiTitle(e.target.value)}
            />
            <Input
              className="h-8 w-24"
              type="number"
              placeholder="Ziel"
              value={kpiTarget}
              onChange={(e) => setKpiTarget(e.target.value)}
            />
            <Input
              className="h-8 w-24"
              placeholder="Einheit"
              value={kpiUnit}
              onChange={(e) => setKpiUnit(e.target.value)}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy || kpiTitle.trim() === "" || toNum(kpiTarget) == null}
              onClick={() => {
                onSaveKpi(goal.id, {
                  title: kpiTitle,
                  target: toNum(kpiTarget) as number,
                  unit: kpiUnit || null,
                  current: null,
                });
                setKpiTitle("");
                setKpiTarget("");
                setKpiUnit("");
              }}
            >
              KPI +
            </Button>
          </div>
        )}
      </div>

      {/* Epics */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Realisiert durch Epics</p>
        {goal.epics.length === 0 ? (
          <p className="text-xs text-muted-foreground">Noch keine Epics verknüpft.</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {goal.epics.map((e) => (
              <li
                key={e.id}
                className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs"
              >
                {e.title}
                {canManage && (
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-destructive"
                    disabled={busy}
                    aria-label={`${e.title} lösen`}
                    onClick={() => onUnlinkEpic(goal.id, e.id)}
                  >
                    ×
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {canManage && linkable.length > 0 && (
          <div className="flex items-center gap-2">
            <select
              className={`${SELECT} flex-1`}
              value={epicToLink}
              disabled={busy}
              onChange={(e) => setEpicToLink(e.target.value)}
            >
              <option value="">— Epic wählen —</option>
              {linkable.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title}
                </option>
              ))}
            </select>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy || !epicToLink}
              onClick={() => {
                onLinkEpic(goal.id, epicToLink);
                setEpicToLink("");
              }}
            >
              Verknüpfen
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

/** Senior-management view: define strategic goals, their KPIs, and the Epics that realise them. */
export function GoalsManager({ goals, epicOptions, userOptions, canManage }: Props) {
  const [, goalSave, savingGoal] = useActionState(saveGoalAction, {});
  const [, goalDelete, deletingGoal] = useActionState(deleteGoalAction, {});
  const [, kpiSave, savingKpi] = useActionState(saveTargetOutcomeAction, {});
  const [, kpiDelete, deletingKpi] = useActionState(deleteTargetOutcomeAction, {});
  const [, epicLink, linking] = useActionState(linkGoalEpicAction, {});
  const [, epicUnlink, unlinking] = useActionState(unlinkGoalEpicAction, {});
  const busy = savingGoal || deletingGoal || savingKpi || deletingKpi || linking || unlinking;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [due, setDue] = useState("");

  function addGoal() {
    const fd = new FormData();
    fd.set(
      "payload",
      JSON.stringify({
        title,
        description: description || null,
        ownerId: ownerId || null,
        dueDate: due || null,
      }),
    );
    goalSave(fd);
    setTitle("");
    setDescription("");
    setOwnerId("");
    setDue("");
  }

  function setStatus(id: string, status: string) {
    const goal = goals.find((g) => g.id === id);
    if (!goal) return;
    const fd = new FormData();
    fd.set(
      "payload",
      JSON.stringify({
        id,
        title: goal.title,
        description: goal.description,
        ownerId: goal.ownerId,
        dueDate: goal.dueDate,
        status,
      }),
    );
    goalSave(fd);
  }

  function removeGoal(id: string) {
    const fd = new FormData();
    fd.set("id", id);
    goalDelete(fd);
  }

  function saveKpi(
    goalId: string,
    kpi: {
      id?: string;
      title: string;
      target: number;
      unit: string | null;
      current: number | null;
    },
  ) {
    const fd = new FormData();
    fd.set(
      "payload",
      JSON.stringify({
        id: kpi.id ?? null,
        goalId,
        title: kpi.title,
        target: kpi.target,
        metricUnit: kpi.unit,
        current: kpi.current,
      }),
    );
    kpiSave(fd);
  }

  function removeKpi(id: string) {
    const fd = new FormData();
    fd.set("id", id);
    kpiDelete(fd);
  }

  function linkEpic(goalId: string, epicId: string) {
    const fd = new FormData();
    fd.set("goalId", goalId);
    fd.set("epicId", epicId);
    epicLink(fd);
  }

  function unlinkEpic(goalId: string, epicId: string) {
    const fd = new FormData();
    fd.set("goalId", goalId);
    fd.set("epicId", epicId);
    epicUnlink(fd);
  }

  return (
    <div className="space-y-6">
      {goals.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Noch keine Ziele definiert. Senior Management gibt hier die Richtung der Transformation
          vor.
        </p>
      ) : (
        goals.map((g) => (
          <GoalCard
            key={g.id}
            goal={g}
            epicOptions={epicOptions}
            userOptions={userOptions}
            canManage={canManage}
            busy={busy}
            onStatus={setStatus}
            onDelete={removeGoal}
            onSaveKpi={saveKpi}
            onDeleteKpi={removeKpi}
            onLinkEpic={linkEpic}
            onUnlinkEpic={unlinkEpic}
          />
        ))
      )}

      {canManage && (
        <div className="space-y-3 rounded-md border border-dashed p-4">
          <p className="text-sm font-medium">Neues Ziel</p>
          <div className="space-y-1.5">
            <Label htmlFor="goal-title">Titel</Label>
            <Input
              id="goal-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="z. B. Time-to-Market halbieren"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="goal-desc">Beschreibung (optional)</Label>
            <Input
              id="goal-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="goal-owner">Verantwortlich (optional)</Label>
              <select
                id="goal-owner"
                className={`${SELECT} h-9`}
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value)}
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
              <Label htmlFor="goal-due">Zieltermin (optional)</Label>
              <Input
                id="goal-due"
                type="date"
                className="w-40"
                value={due}
                onChange={(e) => setDue(e.target.value)}
              />
            </div>
            <Button type="button" disabled={busy || title.trim() === ""} onClick={addGoal}>
              {savingGoal ? "Speichert…" : "Ziel anlegen"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
