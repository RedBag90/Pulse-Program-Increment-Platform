"use client";

import { useActionState } from "react";
import {
  createKpiAction,
  deleteKpiAction,
  recordKpiMeasurementAction,
} from "@/features/portfolio/actions/kpi";
import { SectionSignoffBanner, type SectionSignoff } from "./section-signoff-banner";

export interface KpiRow {
  id: string;
  name: string;
  unit: string | null;
  baseline: number | null;
  target: number | null;
  latest: number | null;
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

      {(delState.error ?? measState.error) && (
        <p role="alert" className="mt-1 text-xs text-destructive">
          {delState.error ?? measState.error}
        </p>
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
