"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { savePortfolioDashboardSettingsAction } from "@/modules/work/features/portfolio/actions/dashboard-settings";
import {
  validateGuardrailTargets,
  HORIZON_KEYS,
  STATIONS,
  type GuardrailTargets,
  type Station,
  CAPACITY_BUCKETS,
  type CapacityBucket,
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
  const t = useTranslations();
  const [state, formAction, pending] = useActionState(savePortfolioDashboardSettingsAction, {});
  const [draft, setDraft] = useState(targets);

  const validation = validateGuardrailTargets(draft);
  const num = (v: number) => (Number.isFinite(v) ? v : 0);

  const setHorizon = (key: Station, v: number) =>
    setDraft((p) => ({ ...p, horizon: { ...p.horizon, [key]: num(v) } }));
  const setCapacity = (key: CapacityBucket, v: number) =>
    setDraft((p) => ({ ...p, capacity: { ...p.capacity, [key]: num(v) } }));
  const setEngagement = (key: "coverage" | "responseDays", v: number) =>
    setDraft((p) => ({ ...p, engagement: { ...p.engagement, [key]: num(v) } }));
  const setThreshold = (v: number) =>
    setDraft((p) => ({ ...p, approval: { portfolioThreshold: num(v) } }));
  const setHorizonOnOverview = (v: boolean) =>
    setDraft((p) => ({ ...p, display: { ...p.display, horizonOnOverview: v } }));

  const horizonSum = STATIONS.reduce((sum, st) => sum + draft.horizon[st], 0);
  const capacitySum = CAPACITY_BUCKETS.reduce((sum, b) => sum + draft.capacity[b], 0);

  return (
    <Card className="space-y-3 p-4">
      <header>
        <h3 className="font-heading text-base font-medium">
          {t("work.epic.portfolioGuardrailTargets")}
        </h3>
        <p className="text-xs text-muted-foreground">
          {t.rich("work.epic.sollWerteJeAchse", {
            b: (c) => <span className="font-medium">{c}</span>,
          })}
        </p>
      </header>
      <form action={formAction} className="space-y-3">
        <div className="grid gap-3 md:grid-cols-3">
          <fieldset className="space-y-2 rounded-md border p-3">
            <legend className="px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t("work.epic.horizon")}
            </legend>
            <NumberRow
              label={t(HORIZON_KEYS.h3)}
              name="guardrail_h3"
              value={draft.horizon.h3}
              onChange={(v) => setHorizon("h3", v)}
            />
            <NumberRow
              label={t(HORIZON_KEYS.h2)}
              name="guardrail_h2"
              value={draft.horizon.h2}
              onChange={(v) => setHorizon("h2", v)}
            />
            {/* H1 zerfaellt in zwei Stationen: ausbauen gegen ernten. Die
                Teilung wird hier gesetzt — der Code-Default (haelftig) ist nur
                ein Startwert, keine Empfehlung. */}
            <NumberRow
              label={t("work.epic.hInvesting")}
              name="guardrail_h1_1"
              value={draft.horizon["h1.1"]}
              onChange={(v) => setHorizon("h1.1", v)}
            />
            <NumberRow
              label={t("work.epic.hExtracting")}
              name="guardrail_h1_2"
              value={draft.horizon["h1.2"]}
              onChange={(v) => setHorizon("h1.2", v)}
            />
            <NumberRow
              label={t(HORIZON_KEYS.h0)}
              name="guardrail_h0"
              value={draft.horizon.h0}
              onChange={(v) => setHorizon("h0", v)}
            />
            <SumHint sum={horizonSum} />
            {/* Der Schalter steht dort, wo die Achse definiert wird: wer sie
                nicht pflegt, entscheidet hier, dass die Uebersicht sie auch
                nicht zeigt. Er betrifft **nur** die Portfolio-Uebersicht —
                die Karte „Investment by Horizon" auf dieser Seite bleibt. */}
            <label className="flex items-start gap-2 border-t pt-2 text-xs">
              {/* Eine abgehakte Checkbox sendet nichts. Das Hidden-Feld davor
                  macht „aus" ueberhaupt erst uebertragbar. */}
              <input type="hidden" name="guardrail_horizon_on_overview" value="0" />
              <input
                type="checkbox"
                name="guardrail_horizon_on_overview"
                value="1"
                checked={draft.display.horizonOnOverview}
                onChange={(e) => setHorizonOnOverview(e.target.checked)}
                className="mt-0.5 size-3.5 shrink-0"
              />
              <span>
                {t("work.epic.aufDerPortfolioUebersicht")}
                <span className="block text-meta text-muted-foreground">
                  {t("work.epic.trichterProdukteImInvestitionshorizont")}
                </span>
              </span>
            </label>
          </fieldset>

          <fieldset className="space-y-2 rounded-md border p-3">
            <legend className="px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t("work.epic.capacity")}
            </legend>
            <NumberRow
              label={t("work.epic.business")}
              name="guardrail_business"
              value={draft.capacity.business}
              onChange={(v) => setCapacity("business", v)}
            />
            <NumberRow
              label={t("work.epic.enabler")}
              name="guardrail_enabler"
              value={draft.capacity.enabler}
              onChange={(v) => setCapacity("enabler", v)}
            />
            <NumberRow
              label={t("work.epic.maintenance")}
              name="guardrail_maintenance"
              value={draft.capacity.maintenance}
              onChange={(v) => setCapacity("maintenance", v)}
            />
            <SumHint sum={capacitySum} />
          </fieldset>

          <fieldset className="space-y-2 rounded-md border p-3">
            <legend className="px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t("work.epic.engagement")}
            </legend>
            <NumberRow
              label={t("work.epic.abdeckung")}
              name="guardrail_coverage"
              value={draft.engagement.coverage}
              onChange={(v) => setEngagement("coverage", v)}
            />
            <NumberRow
              label={t("work.epic.reaktionszeit")}
              name="guardrail_response_days"
              value={draft.engagement.responseDays}
              unit="Tage"
              min={1}
              max={365}
              onChange={(v) => setEngagement("responseDays", v)}
            />
            <p className="pt-1 text-meta text-muted-foreground">
              {t("work.epic.keineSummenregel")}
            </p>
          </fieldset>

          <fieldset className="space-y-2 rounded-md border p-3">
            <legend className="px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t("work.epic.portfolioLimit")}
            </legend>
            <NumberRow
              label={t("work.epic.schwelle")}
              name="guardrail_portfolio_threshold"
              value={draft.approval.portfolioThreshold}
              unit="€"
              max={100_000_000}
              onChange={setThreshold}
            />
            <p className="pt-1 text-meta text-muted-foreground">
              {t("work.epic.abDieserGroesseEntscheidet")}
            </p>
          </fieldset>
        </div>
        {!validation.ok && (
          <p role="alert" className="text-sm text-warning">
            {validation.reasonKey ? t(validation.reasonKey, validation.reasonValues) : null}
          </p>
        )}
        {state.error && (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}
        {state.success && (
          <p role="status" className="text-sm text-success">
            {t("work.epic.targetsGespeichert")}
          </p>
        )}
        <Button type="submit" disabled={pending || !validation.ok} size="sm">
          {pending ? t("common.ui.speichernLaeuft") : t("work.epic.targetsSpeichern")}
        </Button>
      </form>
    </Card>
  );
}

/** Summenanzeige der Mix-Achsen — macht die 100er-Regel im Formular sichtbar. */
function SumHint({ sum }: { sum: number }) {
  const t = useTranslations();
  const ok = Math.abs(sum - 100) <= 0.5;
  return (
    <p
      className={`pt-1 font-mono text-meta tabular-nums ${
        ok ? "text-muted-foreground" : "text-amber-700 dark:text-amber-400"
      }`}
    >
      {ok ? <>Σ {sum} ✓</> : t("work.epic.summeErwartet100", { sum })}
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
