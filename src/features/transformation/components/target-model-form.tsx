"use client";

import { useActionState, useState } from "react";
import { saveTargetModelAction } from "@/features/transformation/actions/target-model";
import {
  OPERATING_MODEL_TEMPLATES,
  OPERATING_MODEL_TEMPLATE_DEFS,
  TEMPLATE_LABELS,
  PRACTICES,
  PRACTICE_LABELS,
  type OperatingModelTemplate,
  type PracticeFlags,
  type StructureTargets,
} from "@/domain/operating-model";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface Props {
  canManage: boolean;
  status: string | null;
  initial: {
    template: OperatingModelTemplate;
    targetDate: string | null;
    structure: StructureTargets;
    practices: PracticeFlags;
  };
}

const SELECT =
  "flex h-9 w-full max-w-xs rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const STRUCTURE_FIELDS: { key: keyof StructureTargets; label: string }[] = [
  { key: "targetValueStreams", label: "Wertströme (Ziel)" },
  { key: "targetArtsTotal", label: "ARTs (Ziel)" },
  { key: "targetTeamsTotal", label: "Teams (Ziel)" },
  { key: "targetPiCadenceWeeks", label: "PI-Kadenz (Wochen)" },
];

/** Management configurator for the target operating model (the "Soll"). */
export function TargetModelForm({ canManage, status, initial }: Props) {
  const [state, formAction, isPending] = useActionState(saveTargetModelAction, {});
  const [template, setTemplate] = useState<OperatingModelTemplate>(initial.template);
  const [practices, setPractices] = useState<PracticeFlags>(initial.practices);
  const [structure, setStructure] = useState<StructureTargets>(initial.structure);
  const [targetDate, setTargetDate] = useState(initial.targetDate ?? "");

  function applyTemplate(t: OperatingModelTemplate) {
    setTemplate(t);
    if (t !== "custom") {
      const def = OPERATING_MODEL_TEMPLATE_DEFS[t];
      setPractices({ ...def.practices });
      setStructure({ ...def.structure });
    }
  }

  function setPractice(p: keyof PracticeFlags, on: boolean) {
    setPractices((prev) => ({ ...prev, [p]: on }));
    setTemplate("custom"); // any manual edit means it's a custom model now
  }

  function setStructureField(k: keyof StructureTargets, raw: string) {
    const value = raw.trim() === "" ? null : Math.max(0, Math.trunc(Number(raw)));
    setStructure((prev) => ({ ...prev, [k]: Number.isNaN(value as number) ? null : value }));
  }

  function submit(activate: boolean) {
    const fd = new FormData();
    fd.set(
      "payload",
      JSON.stringify({ template, targetDate: targetDate || null, structure, practices, activate }),
    );
    formAction(fd);
  }

  const disabled = !canManage || isPending;

  return (
    <div className="space-y-6">
      {status && (
        <p className="text-xs text-muted-foreground">
          Aktueller Stand: <span className="font-medium text-foreground">{status}</span>
        </p>
      )}

      {/* Vorlage */}
      <div className="space-y-1.5">
        <Label htmlFor="tom-template">Vorlage</Label>
        <select
          id="tom-template"
          className={SELECT}
          value={template}
          disabled={disabled}
          onChange={(e) => applyTemplate(e.target.value as OperatingModelTemplate)}
        >
          {OPERATING_MODEL_TEMPLATES.map((t) => (
            <option key={t} value={t}>
              {TEMPLATE_LABELS[t]}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          Startpunkt — danach frei anpassbar. Jede Änderung macht daraus ein „Eigenes Modell".
        </p>
      </div>

      {/* Praktiken */}
      <fieldset className="space-y-2" disabled={disabled}>
        <legend className="text-sm font-medium">Aktivierte Praktiken</legend>
        <p className="text-xs text-muted-foreground">
          Nur Praktiken im Ziel erscheinen später in Navigation und Lückenanalyse.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {PRACTICES.map((p) => (
            <label key={p} className="flex items-start gap-2 rounded-md border p-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={practices[p]}
                disabled={disabled}
                onChange={(e) => setPractice(p, e.target.checked)}
              />
              <span>{PRACTICE_LABELS[p]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Struktur-Ziele */}
      <fieldset className="space-y-3" disabled={disabled}>
        <legend className="text-sm font-medium">Struktur-Ziele</legend>
        <p className="text-xs text-muted-foreground">Leer lassen = nicht Teil des Ziels.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {STRUCTURE_FIELDS.map(({ key, label }) => (
            <div key={key} className="space-y-1.5">
              <Label htmlFor={`tom-${key}`}>{label}</Label>
              <Input
                id={`tom-${key}`}
                type="number"
                min={0}
                className="w-32"
                value={structure[key] ?? ""}
                disabled={disabled}
                onChange={(e) => setStructureField(key, e.target.value)}
              />
            </div>
          ))}
        </div>
      </fieldset>

      {/* Zieltermin */}
      <div className="space-y-1.5">
        <Label htmlFor="tom-date">Zieltermin (optional)</Label>
        <Input
          id="tom-date"
          type="date"
          className="w-44"
          value={targetDate}
          disabled={disabled}
          onChange={(e) => setTargetDate(e.target.value)}
        />
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="text-sm text-emerald-600">
          Gespeichert.
        </p>
      )}

      {canManage ? (
        <div className="flex gap-2">
          <Button type="button" variant="outline" disabled={disabled} onClick={() => submit(false)}>
            {isPending ? "Speichert…" : "Als Entwurf speichern"}
          </Button>
          <Button type="button" disabled={disabled} onClick={() => submit(true)}>
            {isPending ? "Speichert…" : "Aktivieren"}
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Nur das Management kann den Zielzustand bearbeiten.
        </p>
      )}
    </div>
  );
}
