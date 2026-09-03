"use client";

import { useActionState, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { savePortfolioDashboardSettingsAction } from "@/modules/work/features/portfolio/actions/dashboard-settings";
import {
  validateGuardrailTargets,
  HORIZON_LABEL,
  type GuardrailTargets,
  type Horizon,
} from "@/modules/work/domain/portfolio-guardrails";

interface Props {
  targets: GuardrailTargets;
}

/**
 * Targets-Editor fuer die SAFe Portfolio-Guardrails (Roadmap-G4). Lebt bei
 * seinem Besitzer (Work: Domain, Validierung, Action und `Tenant.guardrailTargets`
 * sind alle hier), wird aber auf der Controlling-Uebersicht gerendert —
 * Konfiguration, nicht Sichtebene. Der `src/app`-Composition-Root komponiert das,
 * Budgeting hostet die Komponente nicht mehr selbst (ADR-0013).
 *
 * Drei Gruppen, zwei Regeln: die Mix-Achsen (Horizon, Capacity) muessen je auf
 * 100 summieren, Engagement nicht — dort gelten nur Wertebereiche. Validiert
 * client-seitig, bevor der Speichern-Button freigegeben wird. Auf Erfolg
 * persistiert `savePortfolioDashboardSettingsAction` nur die
 * `Tenant.guardrailTargets` (Partial-Update — die Cost-Settings bleiben
 * unangetastet, daher keine Hidden-Input-Kruecke).
 */
export function GuardrailTargetsForm({ targets }: Props) {
  const [state, formAction, pending] = useActionState(savePortfolioDashboardSettingsAction, {});
  const [draft, setDraft] = useState(targets);

  const validation = validateGuardrailTargets(draft);
  const num = (v: number) => (Number.isFinite(v) ? v : 0);

  const setHorizon = (key: Horizon, v: number) =>
    setDraft((p) => ({ ...p, horizon: { ...p.horizon, [key]: num(v) } }));
  const setCapacity = (key: "business" | "enabler", v: number) =>
    setDraft((p) => ({ ...p, capacity: { ...p.capacity, [key]: num(v) } }));
  const setEngagement = (key: "coverage" | "responseDays", v: number) =>
    setDraft((p) => ({ ...p, engagement: { ...p.engagement, [key]: num(v) } }));
  const setThreshold = (v: number) =>
    setDraft((p) => ({ ...p, approval: { portfolioThreshold: num(v) } }));

  const horizonSum = draft.horizon.h0 + draft.horizon.h1 + draft.horizon.h2 + draft.horizon.h3;
  const capacitySum = draft.capacity.business + draft.capacity.enabler;

  return (
    <Card className="space-y-3 p-4">
      <header>
        <h3 className="font-heading text-base font-medium">Portfolio-Guardrail-Targets</h3>
        <p className="text-xs text-muted-foreground">
          Soll-Werte je Achse. Treiben Soll-Marker und Ampel auf der{" "}
          <span className="font-medium">Portfolio-Guardrails</span>-Fläche.
        </p>
      </header>
      <form action={formAction} className="space-y-3">
        <div className="grid gap-3 md:grid-cols-3">
          <fieldset className="space-y-2 rounded-md border p-3">
            <legend className="px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Horizon
            </legend>
            <NumberRow
              label={HORIZON_LABEL.h3}
              name="guardrail_h3"
              value={draft.horizon.h3}
              onChange={(v) => setHorizon("h3", v)}
            />
            <NumberRow
              label={HORIZON_LABEL.h2}
              name="guardrail_h2"
              value={draft.horizon.h2}
              onChange={(v) => setHorizon("h2", v)}
            />
            <NumberRow
              label={HORIZON_LABEL.h1}
              name="guardrail_h1"
              value={draft.horizon.h1}
              onChange={(v) => setHorizon("h1", v)}
            />
            <NumberRow
              label={HORIZON_LABEL.h0}
              name="guardrail_h0"
              value={draft.horizon.h0}
              onChange={(v) => setHorizon("h0", v)}
            />
            <SumHint sum={horizonSum} />
          </fieldset>

          <fieldset className="space-y-2 rounded-md border p-3">
            <legend className="px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Capacity
            </legend>
            <NumberRow
              label="Business"
              name="guardrail_business"
              value={draft.capacity.business}
              onChange={(v) => setCapacity("business", v)}
            />
            <NumberRow
              label="Enabler"
              name="guardrail_enabler"
              value={draft.capacity.enabler}
              onChange={(v) => setCapacity("enabler", v)}
            />
            <SumHint sum={capacitySum} />
          </fieldset>

          <fieldset className="space-y-2 rounded-md border p-3">
            <legend className="px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Engagement
            </legend>
            <NumberRow
              label="Abdeckung"
              name="guardrail_coverage"
              value={draft.engagement.coverage}
              onChange={(v) => setEngagement("coverage", v)}
            />
            <NumberRow
              label="Reaktionszeit"
              name="guardrail_response_days"
              value={draft.engagement.responseDays}
              unit="Tage"
              min={1}
              max={365}
              onChange={(v) => setEngagement("responseDays", v)}
            />
            <p className="pt-1 text-[11px] text-muted-foreground">keine Summenregel</p>
          </fieldset>

          <fieldset className="space-y-2 rounded-md border p-3">
            <legend className="px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Portfolio-Limit
            </legend>
            <NumberRow
              label="Schwelle"
              name="guardrail_portfolio_threshold"
              value={draft.approval.portfolioThreshold}
              unit="€"
              max={100_000_000}
              onChange={setThreshold}
            />
            <p className="pt-1 text-[11px] text-muted-foreground">
              Ab dieser Größe entscheidet das Portfolio. Darunter finanziert der ART.
            </p>
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

/** Summenanzeige der Mix-Achsen — macht die 100er-Regel im Formular sichtbar. */
function SumHint({ sum }: { sum: number }) {
  const ok = Math.abs(sum - 100) <= 0.5;
  return (
    <p
      className={`pt-1 font-mono text-[11px] tabular-nums ${
        ok ? "text-muted-foreground" : "text-amber-700 dark:text-amber-400"
      }`}
    >
      Σ {sum} {ok ? "✓" : "— erwartet 100"}
    </p>
  );
}

function NumberRow({
  label,
  name,
  value,
  onChange,
  unit = "%",
  min = 0,
  max = 100,
}: {
  label: string;
  name: string;
  value: number;
  onChange: (v: number) => void;
  /** Einheit rechts vom Feld — die Reaktionszeit zaehlt Tage, nicht Prozent. */
  unit?: string;
  min?: number;
  max?: number;
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
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-8 w-20 text-right"
      />
      <span className="w-8 shrink-0 text-xs text-muted-foreground">{unit}</span>
    </div>
  );
}
