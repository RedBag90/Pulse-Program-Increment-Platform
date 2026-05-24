"use client";

import { useActionState, useState } from "react";
import { Trash2 } from "lucide-react";
import {
  saveTargetOutcomeAction,
  deleteTargetOutcomeAction,
} from "@/features/transformation/actions/target-outcome";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export interface OutcomeView {
  id: string;
  title: string;
  metricUnit: string | null;
  baseline: number | null;
  target: number;
  current: number | null;
  dueDate: string | null;
}

interface Props {
  outcomes: OutcomeView[];
  canManage: boolean;
}

function toNum(s: string): number | null {
  const t = s.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Per-row "current value" updater — the longitudinal signal management edits. */
function OutcomeRow({
  outcome,
  canManage,
  onUpdateCurrent,
  onDelete,
  busy,
}: {
  outcome: OutcomeView;
  canManage: boolean;
  onUpdateCurrent: (o: OutcomeView, current: number | null) => void;
  onDelete: (id: string) => void;
  busy: boolean;
}) {
  const [current, setCurrent] = useState(outcome.current?.toString() ?? "");
  const unit = outcome.metricUnit ? ` ${outcome.metricUnit}` : "";

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border p-3 text-sm">
      <div className="min-w-0 flex-1">
        <p className="font-medium">{outcome.title}</p>
        <p className="text-xs text-muted-foreground">
          Ziel: {outcome.target}
          {unit}
          {outcome.baseline != null ? ` · Basis: ${outcome.baseline}${unit}` : ""}
          {outcome.dueDate ? ` · bis ${outcome.dueDate}` : ""}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Label htmlFor={`oc-${outcome.id}`} className="text-xs text-muted-foreground">
          Aktuell
        </Label>
        <Input
          id={`oc-${outcome.id}`}
          type="number"
          className="w-24"
          value={current}
          disabled={!canManage || busy}
          onChange={(e) => setCurrent(e.target.value)}
        />
        {canManage && (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => onUpdateCurrent(outcome, toNum(current))}
            >
              Aktualisieren
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-8"
              disabled={busy}
              aria-label="Outcome löschen"
              onClick={() => onDelete(outcome.id)}
            >
              <Trash2 className="size-4" />
            </Button>
          </>
        )}
      </div>
    </li>
  );
}

/** Manage the organisation's target outcomes (OKRs) — the business Soll. */
export function TargetOutcomesManager({ outcomes, canManage }: Props) {
  const [saveState, saveAction, saving] = useActionState(saveTargetOutcomeAction, {});
  const [, deleteAction, deleting] = useActionState(deleteTargetOutcomeAction, {});
  const busy = saving || deleting;

  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");
  const [unit, setUnit] = useState("");
  const [baseline, setBaseline] = useState("");
  const [current, setCurrent] = useState("");
  const [due, setDue] = useState("");

  function dispatchSave(payload: Record<string, unknown>) {
    const fd = new FormData();
    fd.set("payload", JSON.stringify(payload));
    saveAction(fd);
  }

  function addOutcome() {
    dispatchSave({
      id: null,
      title,
      target: Number(target),
      metricUnit: unit || null,
      baseline: toNum(baseline),
      current: toNum(current),
      dueDate: due || null,
    });
    setTitle("");
    setTarget("");
    setUnit("");
    setBaseline("");
    setCurrent("");
    setDue("");
  }

  function updateCurrent(o: OutcomeView, value: number | null) {
    dispatchSave({
      id: o.id,
      title: o.title,
      target: o.target,
      metricUnit: o.metricUnit,
      baseline: o.baseline,
      current: value,
      dueDate: o.dueDate,
    });
  }

  function remove(id: string) {
    const fd = new FormData();
    fd.set("id", id);
    deleteAction(fd);
  }

  const canAdd = canManage && title.trim() !== "" && toNum(target) != null;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-heading text-sm font-medium">KPIs ohne Ziel</h2>
        <p className="text-xs text-muted-foreground">
          Kennzahlen, die (noch) keinem strategischen Ziel zugeordnet sind.
        </p>
      </div>

      {outcomes.length === 0 ? (
        <p className="text-sm text-muted-foreground">Noch keine Outcomes definiert.</p>
      ) : (
        <ul className="space-y-2">
          {outcomes.map((o) => (
            <OutcomeRow
              key={o.id}
              outcome={o}
              canManage={canManage}
              onUpdateCurrent={updateCurrent}
              onDelete={remove}
              busy={busy}
            />
          ))}
        </ul>
      )}

      {canManage && (
        <div className="space-y-3 rounded-md border border-dashed p-3">
          <p className="text-sm font-medium">Neues Outcome</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="oc-title">Titel</Label>
              <Input
                id="oc-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="z. B. Time-to-Market halbieren"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="oc-target">Zielwert</Label>
              <Input
                id="oc-target"
                type="number"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="oc-unit">Einheit (optional)</Label>
              <Input
                id="oc-unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="%, Tage, …"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="oc-baseline">Basiswert (optional)</Label>
              <Input
                id="oc-baseline"
                type="number"
                value={baseline}
                onChange={(e) => setBaseline(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="oc-current">Aktuell (optional)</Label>
              <Input
                id="oc-current"
                type="number"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="oc-due">Zieltermin (optional)</Label>
              <Input id="oc-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
            </div>
          </div>
          <Button type="button" disabled={!canAdd || busy} onClick={addOutcome}>
            {saving ? "Speichert…" : "Outcome hinzufügen"}
          </Button>
        </div>
      )}

      {saveState.error && (
        <p role="alert" className="text-sm text-destructive">
          {saveState.error}
        </p>
      )}
    </section>
  );
}
