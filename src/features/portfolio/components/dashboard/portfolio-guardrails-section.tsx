"use client";

import { useActionState, useState, type ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { savePortfolioDashboardSettingsAction } from "@/features/portfolio/actions/dashboard-settings";
import {
  HORIZONS,
  HORIZON_LABEL,
  validateGuardrailTargets,
  type GuardrailTargets,
} from "@/domain/portfolio-guardrails";
import type {
  PortfolioGuardrailsModel,
  CapacityBucket,
  MixRow,
} from "@/server/views/portfolio-guardrails-view";

interface Props {
  model: PortfolioGuardrailsModel;
  targets: GuardrailTargets;
  canEdit: boolean;
  costNeutralTarget: number | null;
  costPerJobSizePoint: number | null;
}

const STATUS_LABEL: Record<PortfolioGuardrailsModel["horizon"]["status"], string> = {
  green: "Im Soll",
  amber: "Beobachten",
  red: "Drift",
  unknown: "Keine Daten",
};
const STATUS_CLASS: Record<PortfolioGuardrailsModel["horizon"]["status"], string> = {
  green: "bg-emerald-100 text-emerald-700",
  amber: "bg-amber-100 text-amber-700",
  red: "bg-red-100 text-red-700",
  unknown: "bg-muted text-muted-foreground",
};
const BUCKET_LABEL: Record<CapacityBucket, string> = {
  business: "Business (Solution + Epic)",
  enabler: "Enabler",
};
const HORIZON_COLOR: Record<string, string> = {
  h1: "bg-blue-500",
  h2: "bg-violet-500",
  h3: "bg-fuchsia-500",
};
const BUCKET_COLOR: Record<CapacityBucket, string> = {
  business: "bg-emerald-500",
  enabler: "bg-amber-500",
};

const pct = (v: number) => `${(v * 100).toFixed(0)} %`;
const ppDelta = (v: number) => `${v > 0 ? "+" : ""}${(v * 100).toFixed(0)} pp`;

/**
 * Zwei Guardrail-Cards (Investment by Horizon, Capacity Allocation) plus
 * Targets-Editor unter dem Cost-Chart. Werte kommen aus dem Page-Model;
 * der Editor sendet sie zurueck an `savePortfolioDashboardSettingsAction`.
 */
export function PortfolioGuardrailsSection({
  model,
  targets,
  canEdit,
  costNeutralTarget,
  costPerJobSizePoint,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <HorizonCard model={model.horizon} coverageThin={model.horizonCoverageThin} />
        <CapacityCard model={model.capacity} coverageThin={model.capacityCoverageThin} />
      </div>

      {canEdit && (
        <TargetsForm
          targets={targets}
          costNeutralTarget={costNeutralTarget}
          costPerJobSizePoint={costPerJobSizePoint}
        />
      )}
    </div>
  );
}

function HorizonCard({
  model,
  coverageThin,
}: {
  model: PortfolioGuardrailsModel["horizon"];
  coverageThin: boolean;
}) {
  return (
    <CardShell
      title="Investment by Horizon"
      subtitle="McKinsey 3-Horizons — H1 Sustain · H2 Grow · H3 Innovate"
      status={model.status}
    >
      <StackedBar
        rows={HORIZONS.map((h) => ({
          key: h,
          label: HORIZON_LABEL[h],
          color: HORIZON_COLOR[h] ?? "bg-muted",
          row: model.rows[h],
        }))}
      />
      <Footer
        unclassifiedCount={model.unclassifiedCount}
        totalCount={model.totalCount}
        coverageThin={coverageThin}
        coverageLabel="ohne Horizon"
      />
    </CardShell>
  );
}

function CapacityCard({
  model,
  coverageThin,
}: {
  model: PortfolioGuardrailsModel["capacity"];
  coverageThin: boolean;
}) {
  return (
    <CardShell
      title="Capacity Allocation"
      subtitle="Wertstiftende Arbeit vs. Architectural Runway / Enabler"
      status={model.status}
    >
      <StackedBar
        rows={(["business", "enabler"] as const).map((b) => ({
          key: b,
          label: BUCKET_LABEL[b],
          color: BUCKET_COLOR[b],
          row: model.rows[b],
        }))}
      />
      <Footer
        unclassifiedCount={model.unclassifiedCount}
        totalCount={model.totalCount}
        coverageThin={coverageThin}
        coverageLabel="ohne Typ"
      />
    </CardShell>
  );
}

function CardShell({
  title,
  subtitle,
  status,
  children,
}: {
  title: string;
  subtitle: string;
  status: PortfolioGuardrailsModel["horizon"]["status"];
  children: ReactNode;
}) {
  return (
    <Card className="space-y-3 p-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-heading text-base font-medium">{title}</h3>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${STATUS_CLASS[status]}`}>
          {STATUS_LABEL[status]}
        </span>
      </header>
      {children}
    </Card>
  );
}

interface StackedBarRow {
  key: string;
  label: string;
  color: string;
  row: MixRow;
}

function StackedBar({ rows }: { rows: StackedBarRow[] }) {
  const hasCountData = rows.some((r) => r.row.count > 0);
  const hasAmountData = rows.some((r) => r.row.amount > 0);
  return (
    <div className="space-y-3">
      <div>
        <p className="mb-1 flex items-center justify-between text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          <span>Ist (Anzahl)</span>
          <span className="normal-case text-muted-foreground/80">
            Σ {rows.reduce((acc, r) => acc + r.row.count, 0)} Epics
          </span>
        </p>
        <StackedBarTrack rows={rows} pick="count" hasData={hasCountData} />
        <Legend rows={rows} pick="count" />
      </div>
      <div>
        <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Ist (€ Implementierungskosten)
        </p>
        <StackedBarTrack rows={rows} pick="amount" hasData={hasAmountData} />
        <Legend rows={rows} pick="amount" />
      </div>
    </div>
  );
}

function StackedBarTrack({
  rows,
  pick,
  hasData,
}: {
  rows: StackedBarRow[];
  pick: "count" | "amount";
  hasData: boolean;
}) {
  if (!hasData) {
    return (
      <div className="flex h-3 items-center rounded-full bg-muted px-2 text-[10px] text-muted-foreground">
        Noch keine Daten klassifiziert.
      </div>
    );
  }
  return (
    <div className="relative h-3 overflow-hidden rounded-full bg-muted">
      <div className="flex h-full w-full">
        {rows.map((r) => {
          const share = pick === "count" ? r.row.countShare : r.row.amountShare;
          if (share <= 0) return null;
          return (
            <div
              key={r.key}
              className={r.color}
              style={{ width: `${share * 100}%` }}
              title={`${r.label}: ${pct(share)}`}
            />
          );
        })}
      </div>
      {/* Target marker — cumulative target boundaries */}
      <div className="pointer-events-none absolute inset-0">
        {cumulativeTargets(rows).map((t) => (
          <span
            key={`${t.key}-target`}
            className="absolute top-0 h-full w-px bg-foreground/70"
            style={{ left: `${t.atPct}%` }}
            title={`Target ${t.label}: kumuliert ${t.atPct.toFixed(0)}%`}
          />
        ))}
      </div>
    </div>
  );
}

function Legend({ rows, pick }: { rows: StackedBarRow[]; pick: "count" | "amount" }) {
  return (
    <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
      {rows.map((r) => {
        const share = pick === "count" ? r.row.countShare : r.row.amountShare;
        const delta = pick === "count" ? r.row.deltaCount : r.row.deltaAmount;
        const deltaClass =
          Math.abs(delta) <= 0.05
            ? "text-emerald-700"
            : Math.abs(delta) <= 0.15
              ? "text-amber-700"
              : "text-red-700";
        return (
          <li key={r.key} className="inline-flex items-center gap-1">
            <span className={`size-2 shrink-0 rounded-sm ${r.color}`} aria-hidden />
            <span className="text-muted-foreground">{r.label}:</span>
            <span className="tabular-nums">{pct(share)}</span>
            <span className="text-muted-foreground/80">
              · Soll {pct(r.row.target)} · <span className={deltaClass}>{ppDelta(delta)}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function cumulativeTargets(rows: StackedBarRow[]): { key: string; label: string; atPct: number }[] {
  const out: { key: string; label: string; atPct: number }[] = [];
  let cum = 0;
  for (let i = 0; i < rows.length - 1; i++) {
    const r = rows[i]!;
    cum += r.row.target;
    out.push({ key: r.key, label: r.label, atPct: cum * 100 });
  }
  return out;
}

function Footer({
  unclassifiedCount,
  totalCount,
  coverageThin,
  coverageLabel,
}: {
  unclassifiedCount: number;
  totalCount: number;
  coverageThin: boolean;
  coverageLabel: string;
}) {
  if (totalCount === 0) {
    return <p className="text-xs text-muted-foreground">Noch keine Epics im Portfolio.</p>;
  }
  if (unclassifiedCount === 0) return null;
  return (
    <p
      className={`text-xs ${coverageThin ? "text-amber-700" : "text-muted-foreground"}`}
      role={coverageThin ? "status" : undefined}
    >
      {unclassifiedCount} von {totalCount} Epics {coverageLabel}
      {coverageThin ? " — Mix ist nur Indiz." : "."}
    </p>
  );
}

function TargetsForm({
  targets,
  costNeutralTarget,
  costPerJobSizePoint,
}: {
  targets: GuardrailTargets;
  costNeutralTarget: number | null;
  costPerJobSizePoint: number | null;
}) {
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
        <h3 className="font-heading text-base font-medium">Targets</h3>
        <p className="text-xs text-muted-foreground">
          Anteile in % — je Achse auf 100 summierend. Cost-Neutral-Target steuert die
          Cost-Selbstfinanzierung im Burndown-Chart.
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
