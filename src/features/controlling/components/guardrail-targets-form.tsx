"use client";

import { useActionState, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { savePortfolioDashboardSettingsAction } from "@/features/portfolio/actions/dashboard-settings";
import { validateGuardrailTargets, type GuardrailTargets } from "@/domain/portfolio-guardrails";

interface Props {
  targets: GuardrailTargets;
  /** Hidden-Inputs — der Save-Action haengt der Cost-Neutral-Wert mit dran,
   *  damit das Dashboard-Cost-Setting beim Targets-Save nicht versehentlich
   *  gecleart wird. */
  costNeutralTarget: number | null;
  costPerJobSizePoint: number | null;
}

/**
 * Targets-Editor fuer die SAFe Portfolio-Guardrails (Roadmap-G4). Wohnt
 * unter „Setup & Controlling" — Konfiguration, nicht Sichtebene. Validiert
 * Sum=100 je Achse client-seitig, bevor der Speichern-Button freigegeben
 * wird. Auf Erfolg persistiert `savePortfolioDashboardSettingsAction` in
 * `Tenant.guardrailTargets`.
 */
export function GuardrailTargetsForm({ targets, costNeutralTarget, costPerJobSizePoint }: Props) {
  const [state, formAction, pending] = useActionState(savePortfolioDashboardSettingsAction, {});
  const [draft, setDraft] = useState(targets);

  const validation = validateGuardrailTargets(draft);

  function update(path: "h1" | "h2" | "h3" | "business" | "enabler", value: number) {
    const v = Number.isFinite(value) ? value : 0;
    setDraft((prev) =>
      path === "business" || path === "enabler"
        ? { ...prev, capacity: { ...prev.capacity, [path]: v } }
        : { ...prev, horizon: { ...prev.horizon, [path]: v } },
    );
  }

  return (
    <Card className="space-y-3 p-4">
      <header>
        <h3 className="font-heading text-base font-medium">Portfolio-Guardrail-Targets</h3>
        <p className="text-xs text-muted-foreground">
          Soll-Mix je Achse — Anteile in %, summieren je Achse auf 100. Treibt Ist-vs-Soll-Markers
          und Ampel der Guardrail-Cards im Portfolio-Dashboard.
        </p>
      </header>
      <form action={formAction} className="space-y-3">
        <input type="hidden" name="costNeutralTarget" value={costNeutralTarget ?? ""} />
        <input type="hidden" name="costPerJobSizePoint" value={costPerJobSizePoint ?? ""} />
        <div className="grid gap-3 md:grid-cols-2">
          <fieldset className="space-y-2 rounded-md border p-3">
            <legend className="px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Horizon
            </legend>
            <NumberRow
              label="H1 · Sustain"
              name="guardrail_h1"
              value={draft.horizon.h1}
              onChange={(v) => update("h1", v)}
            />
            <NumberRow
              label="H2 · Grow"
              name="guardrail_h2"
              value={draft.horizon.h2}
              onChange={(v) => update("h2", v)}
            />
            <NumberRow
              label="H3 · Innovate"
              name="guardrail_h3"
              value={draft.horizon.h3}
              onChange={(v) => update("h3", v)}
            />
          </fieldset>
          <fieldset className="space-y-2 rounded-md border p-3">
            <legend className="px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Capacity
            </legend>
            <NumberRow
              label="Business"
              name="guardrail_business"
              value={draft.capacity.business}
              onChange={(v) => update("business", v)}
            />
            <NumberRow
              label="Enabler"
              name="guardrail_enabler"
              value={draft.capacity.enabler}
              onChange={(v) => update("enabler", v)}
            />
          </fieldset>
        </div>
        {!validation.ok && (
          <p role="alert" className="text-sm text-amber-700">
            {validation.reason}
          </p>
        )}
        {state.error && (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}
        {state.success && (
          <p role="status" className="text-sm text-emerald-700">
            Targets gespeichert.
          </p>
        )}
        <Button type="submit" disabled={pending || !validation.ok} size="sm">
          {pending ? "Speichern…" : "Targets speichern"}
        </Button>
      </form>
    </Card>
  );
}

function NumberRow({
  label,
  name,
  value,
  onChange,
}: {
  label: string;
  name: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor={name} className="flex-1 text-sm">
        {label}
      </Label>
      <Input
        id={name}
        name={name}
        type="number"
        min={0}
        max={100}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-8 w-20 text-right"
      />
      <span className="w-4 text-xs text-muted-foreground">%</span>
    </div>
  );
}
