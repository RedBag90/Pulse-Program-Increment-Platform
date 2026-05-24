"use client";

import { useActionState } from "react";
import {
  createKpiAction,
  deleteKpiAction,
  recordKpiMeasurementAction,
  updateKpiWeightAction,
} from "@/features/portfolio/actions/kpi";
import { SectionSignoffBanner, type SectionSignoff } from "./section-signoff-banner";

export interface KpiRow {
  id: string;
  name: string;
  unit: string | null;
  baseline: number | null;
  target: number | null;
  latest: number | null;
  /** Share of the recurring benefit (fraction 0..1); null = unset → auto equal split. */
  weight: number | null;
  /** Full measurement history (the KPI's timeline), any order. */
  measurements: { date: string; value: number }[];
}

interface Props {
  initiativeId: string;
  kpis: KpiRow[];
  canEdit: boolean;
  /** Sign-off state for the KPIs section (omit to hide the banner). */
  signoff?: SectionSignoff;
}

const inputCls =
  "rounded border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

function fmt(n: number | null): string {
  return n === null ? "—" : n.toLocaleString("de-DE");
}

function KpiItem({ kpi, initiativeId }: { kpi: KpiRow; initiativeId: string }) {
  const [delState, delAction, delPending] = useActionState(deleteKpiAction, {});
  const [measState, measAction, measPending] = useActionState(recordKpiMeasurementAction, {});
  const [weightState, weightAction, weightPending] = useActionState(updateKpiWeightAction, {});

  return (
    <div className="rounded border p-3">
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <span className="font-medium">{kpi.name}</span>
        {kpi.unit && <span className="text-xs text-muted-foreground">{kpi.unit}</span>}
        <span className="text-sm text-muted-foreground">
          Baseline {fmt(kpi.baseline)} → Ziel {fmt(kpi.target)}
        </span>
        <span className="text-sm">
          Aktuell: <span className="font-medium">{fmt(kpi.latest)}</span>
        </span>
        <form action={delAction} className="ml-auto">
          <input type="hidden" name="id" value={kpi.id} />
          <input type="hidden" name="initiativeId" value={initiativeId} />
          <button
            type="submit"
            disabled={delPending}
            className="text-xs text-destructive hover:underline disabled:opacity-50"
          >
            Entfernen
          </button>
        </form>
      </div>

      <form action={weightAction} className="mt-2 flex flex-wrap items-center gap-2">
        <input type="hidden" name="id" value={kpi.id} />
        <input type="hidden" name="initiativeId" value={initiativeId} />
        <label className="text-xs text-muted-foreground">Nutzen-Anteil</label>
        <input
          type="number"
          step="any"
          min={0}
          name="weightPercent"
          defaultValue={kpi.weight != null ? kpi.weight * 100 : ""}
          placeholder="auto"
          className={`${inputCls} w-20`}
          aria-label="Nutzen-Anteil in Prozent"
        />
        <span className="text-xs text-muted-foreground">%</span>
        <button
          type="submit"
          disabled={weightPending}
          className="rounded bg-secondary px-2 py-1 text-xs font-medium hover:bg-secondary/80 disabled:opacity-50"
        >
          Anteil speichern
        </button>
      </form>

      <form action={measAction} className="mt-2 flex flex-wrap items-center gap-2">
        <input type="hidden" name="id" value={kpi.id} />
        <input type="hidden" name="initiativeId" value={initiativeId} />
        <input type="date" name="date" required className={inputCls} aria-label="Datum" />
        <input
          type="number"
          step="any"
          name="value"
          required
          placeholder="Messwert"
          className={`${inputCls} w-32`}
          aria-label="Messwert"
        />
        <button
          type="submit"
          disabled={measPending}
          className="rounded bg-secondary px-2 py-1 text-xs font-medium hover:bg-secondary/80 disabled:opacity-50"
        >
          Messwert erfassen
        </button>
      </form>

      {(delState.error ?? measState.error ?? weightState.error) && (
        <p role="alert" className="mt-1 text-xs text-destructive">
          {delState.error ?? measState.error ?? weightState.error}
        </p>
      )}

      {(kpi.measurements ?? []).length > 0 && (
        <div className="mt-3 border-t pt-2">
          <p className="mb-1 text-xs font-medium text-muted-foreground">Verlauf</p>
          <ul className="space-y-0.5 text-xs tabular-nums">
            {[...(kpi.measurements ?? [])]
              .sort((a, b) => b.date.localeCompare(a.date))
              .map((m, i) => (
                <li key={`${m.date}-${i}`} className="flex justify-between gap-4">
                  <span className="text-muted-foreground">
                    {new Date(m.date).toLocaleDateString("de-DE")}
                  </span>
                  <span className="font-medium">{m.value.toLocaleString("de-DE")}</span>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function CreateKpiForm({ initiativeId }: { initiativeId: string }) {
  const [state, action, pending] = useActionState(createKpiAction, {});

  return (
    <form
      action={action}
      className="flex flex-wrap items-end gap-2 rounded border border-dashed p-3"
    >
      <input type="hidden" name="initiativeId" value={initiativeId} />
      <label className="flex flex-col gap-1 text-xs font-medium">
        Name
        <input name="name" required className={`${inputCls} w-48`} />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium">
        Einheit
        <input name="unit" className={`${inputCls} w-24`} />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium">
        Baseline
        <input type="number" step="any" name="baseline" className={`${inputCls} w-28`} />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium">
        Ziel
        <input type="number" step="any" name="target" className={`${inputCls} w-28`} />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium">
        Nutzen-Anteil %
        <input
          type="number"
          step="any"
          min={0}
          name="weightPercent"
          placeholder="auto"
          className={`${inputCls} w-24`}
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {pending ? "Speichern…" : "KPI hinzufügen"}
      </button>
      {state.error && (
        <p role="alert" className="w-full text-xs text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}

/** KPIs tab — lists the Epic's KPIs with baseline/target/actual and inline CRUD. */
export function EpicKpisTab({ initiativeId, kpis, canEdit, signoff }: Props) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium">KPIs</h2>
      <p className="text-xs text-muted-foreground">
        Der „Nutzen-Anteil" je KPI bestimmt, welchen Teil des wiederkehrenden Nutzens diese KPI
        realisiert. Ohne Anteil tragen alle KPIs des Epics gleichmäßig bei.
      </p>

      {signoff && <SectionSignoffBanner epicId={initiativeId} section="kpis" {...signoff} />}

      {kpis.length === 0 ? (
        <p className="text-sm text-muted-foreground">Noch keine KPIs erfasst.</p>
      ) : (
        <div className="space-y-2">
          {kpis.map((kpi) => (
            <KpiItem key={kpi.id} kpi={kpi} initiativeId={initiativeId} />
          ))}
        </div>
      )}

      {canEdit && <CreateKpiForm initiativeId={initiativeId} />}
    </div>
  );
}
