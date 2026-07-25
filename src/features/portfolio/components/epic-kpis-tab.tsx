"use client";

import { useActionState } from "react";
import {
  createKpiAction,
  deleteKpiAction,
  recordKpiMeasurementAction,
  updateKpiWeightAction,
  updateKpiDetailsAction,
} from "@/features/portfolio/actions/kpi";
import { benefitKindOrDefault, BENEFIT_KIND_LABELS } from "@/domain/kpi-benefit-kind";
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
  /** €-Wert je Einheit (Owner-Vorschlag / Finance). */
  valuePerUnit: number | null;
  /** "one_time" | "recurring" — misst Einmal- oder wiederkehrenden Nutzen. */
  benefitKind: string;
  /** Freitext-Dokumentation der Herleitung. */
  calculationNote: string | null;
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

function fmtEur(n: number | null): string {
  return n === null
    ? "—"
    : n.toLocaleString("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}

/** |Ziel − Baseline| × €/Einheit — der kalkulatorische Gesamt-€-Wert der KPI. */
function derivedTotal(kpi: Pick<KpiRow, "baseline" | "target" | "valuePerUnit">): number | null {
  if (kpi.valuePerUnit == null || kpi.baseline == null || kpi.target == null) return null;
  return Math.abs(kpi.target - kpi.baseline) * kpi.valuePerUnit;
}

function KpiItem({
  kpi,
  initiativeId,
  canEdit,
}: {
  kpi: KpiRow;
  initiativeId: string;
  canEdit: boolean;
}) {
  const [delState, delAction, delPending] = useActionState(deleteKpiAction, {});
  const [measState, measAction, measPending] = useActionState(recordKpiMeasurementAction, {});
  const [weightState, weightAction, weightPending] = useActionState(updateKpiWeightAction, {});
  const [detState, detAction, detPending] = useActionState(updateKpiDetailsAction, {});

  const kind = benefitKindOrDefault(kpi.benefitKind);
  const total = derivedTotal(kpi);

  return (
    <div className="rounded border p-3">
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <span className="font-medium">{kpi.name}</span>
        {kpi.unit && <span className="text-xs text-muted-foreground">{kpi.unit}</span>}
        <span
          className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
            kind === "one_time"
              ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200"
              : "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200"
          }`}
        >
          {BENEFIT_KIND_LABELS[kind]}
        </span>
        <span className="text-sm text-muted-foreground">
          Baseline {fmt(kpi.baseline)} → Ziel {fmt(kpi.target)}
        </span>
        <span className="text-sm">
          Aktuell: <span className="font-medium">{fmt(kpi.latest)}</span>
        </span>
        {kpi.valuePerUnit != null && (
          <span className="text-sm text-muted-foreground">
            {fmtEur(kpi.valuePerUnit)}/Einheit
            {total != null && <> · Gesamt {fmtEur(total)}</>}
          </span>
        )}
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

      {canEdit && (
        <form action={detAction} className="mt-2 space-y-2 border-t pt-2">
          <input type="hidden" name="id" value={kpi.id} />
          <input type="hidden" name="initiativeId" value={initiativeId} />
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-xs font-medium">
              Benefit-Art
              <select name="benefitKind" defaultValue={kind} className={`${inputCls} w-44`}>
                <option value="recurring">{BENEFIT_KIND_LABELS.recurring}</option>
                <option value="one_time">{BENEFIT_KIND_LABELS.one_time}</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium">
              €/Einheit
              <input
                type="number"
                step="any"
                name="valuePerUnit"
                defaultValue={kpi.valuePerUnit ?? ""}
                placeholder="—"
                className={`${inputCls} w-28`}
              />
            </label>
            <button
              type="submit"
              disabled={detPending}
              className="rounded bg-secondary px-2 py-1 text-xs font-medium hover:bg-secondary/80 disabled:opacity-50"
            >
              Details speichern
            </button>
          </div>
          <label className="flex flex-col gap-1 text-xs font-medium">
            Kalkulations-Notiz
            <textarea
              name="calculationNote"
              rows={2}
              defaultValue={kpi.calculationNote ?? ""}
              placeholder="Wie wird dieser Wert hergeleitet?"
              className={`${inputCls} w-full resize-y`}
            />
          </label>
        </form>
      )}

      {(delState.error ?? measState.error ?? weightState.error ?? detState.error) && (
        <p role="alert" className="mt-1 text-xs text-destructive">
          {delState.error ?? measState.error ?? weightState.error ?? detState.error}
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
      <label className="flex flex-col gap-1 text-xs font-medium">
        Benefit-Art
        <select name="benefitKind" defaultValue="recurring" className={`${inputCls} w-44`}>
          <option value="recurring">{BENEFIT_KIND_LABELS.recurring}</option>
          <option value="one_time">{BENEFIT_KIND_LABELS.one_time}</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium">
        €/Einheit (Vorschlag)
        <input
          type="number"
          step="any"
          name="valuePerUnit"
          placeholder="—"
          className={`${inputCls} w-28`}
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
            <KpiItem key={kpi.id} kpi={kpi} initiativeId={initiativeId} canEdit={canEdit} />
          ))}
        </div>
      )}

      {canEdit && <CreateKpiForm initiativeId={initiativeId} />}
    </div>
  );
}
