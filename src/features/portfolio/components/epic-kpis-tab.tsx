"use client";

import { useActionState, useState } from "react";
import {
  createKpiAction,
  deleteKpiAction,
  recordKpiMeasurementAction,
  updateKpiWeightAction,
  updateKpiDetailsAction,
} from "@/features/portfolio/actions/kpi";
import { linkEpicToGoalAction } from "@/features/ziele/actions/ziele";
import { benefitKindOrDefault, BENEFIT_KIND_LABELS } from "@/domain/kpi-benefit-kind";
import {
  recurringIntervalOrDefault,
  RECURRING_INTERVAL_LABELS,
} from "@/domain/kpi-recurring-interval";
import { formatMetricValue } from "@/domain/goal-metric";
import type { EpicGoalLinkRow } from "@/server/views/epic-goal-contributions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useCreateResult } from "@/features/create/use-create-result";
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
  /** Bei recurring: "monthly" | "yearly" — Intervall des wiederkehrenden Werts. */
  recurringInterval: string;
  /** Freitext-Dokumentation der Herleitung. */
  calculationNote: string | null;
  /** Full measurement history (the KPI's timeline), any order. */
  measurements: { date: string; value: number }[];
}

interface Props {
  initiativeId: string;
  kpis: KpiRow[];
  canEdit: boolean;
  /** Verknüpfte Ziele dieses Epics (Einheiten-Kaskade); leer = keine. */
  goalLinks?: EpicGoalLinkRow[];
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
  // Controlled im Detail-Formular, damit das Intervall-Feld nur bei "recurring" erscheint.
  const [detKind, setDetKind] = useState<string>(kind);

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
          {kind === "recurring" && (
            <> · {RECURRING_INTERVAL_LABELS[recurringIntervalOrDefault(kpi.recurringInterval)]}</>
          )}
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
              <select
                name="benefitKind"
                value={detKind}
                onChange={(e) => setDetKind(e.target.value)}
                className={`${inputCls} w-44`}
              >
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
            {detKind === "recurring" && (
              <label className="flex flex-col gap-1 text-xs font-medium">
                Intervall
                <select
                  name="recurringInterval"
                  defaultValue={recurringIntervalOrDefault(kpi.recurringInterval)}
                  className={`${inputCls} w-32`}
                >
                  <option value="yearly">{RECURRING_INTERVAL_LABELS.yearly}</option>
                  <option value="monthly">{RECURRING_INTERVAL_LABELS.monthly}</option>
                </select>
              </label>
            )}
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

      {(delState?.error ?? measState?.error ?? weightState?.error ?? detState?.error) && (
        <p role="alert" className="mt-1 text-xs text-destructive">
          {delState?.error ?? measState?.error ?? weightState?.error ?? detState?.error}
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

/** KPI-Erfassung als Pop-up (entlastet die volle Detailseite). */
function CreateKpiForm({ initiativeId }: { initiativeId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createKpiAction, {});
  const [createKind, setCreateKind] = useState<string>("recurring");
  useCreateResult(state, () => setOpen(false));

  return (
    <>
      <Button onClick={() => setOpen(true)}>KPI hinzufügen</Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>KPI hinzufügen</DialogTitle>
          </DialogHeader>
          <form action={action} className="space-y-3">
            <input type="hidden" name="initiativeId" value={initiativeId} />
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs font-medium">
                Name
                <input name="name" required className={`${inputCls} w-full`} />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium">
                Einheit
                <input name="unit" className={`${inputCls} w-full`} />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium">
                Baseline
                <input type="number" step="any" name="baseline" className={`${inputCls} w-full`} />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium">
                Ziel
                <input type="number" step="any" name="target" className={`${inputCls} w-full`} />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium">
                Nutzen-Anteil %
                <input
                  type="number"
                  step="any"
                  min={0}
                  name="weightPercent"
                  placeholder="auto"
                  className={`${inputCls} w-full`}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium">
                Benefit-Art
                <select
                  name="benefitKind"
                  value={createKind}
                  onChange={(e) => setCreateKind(e.target.value)}
                  className={`${inputCls} w-full`}
                >
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
                  className={`${inputCls} w-full`}
                />
              </label>
              {createKind === "recurring" && (
                <label className="flex flex-col gap-1 text-xs font-medium">
                  Intervall
                  <select
                    name="recurringInterval"
                    defaultValue="yearly"
                    className={`${inputCls} w-full`}
                  >
                    <option value="yearly">{RECURRING_INTERVAL_LABELS.yearly}</option>
                    <option value="monthly">{RECURRING_INTERVAL_LABELS.monthly}</option>
                  </select>
                </label>
              )}
            </div>
            {state?.error && (
              <p role="alert" className="text-xs text-destructive">
                {state.error}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Abbrechen
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Speichern…" : "KPI hinzufügen"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Eine Zeile je verknüpftem Ziel: wähle die treibende KPI + Umrechnungsfaktor. */
function LinkedGoalRow({
  link,
  initiativeId,
  kpis,
  canEdit,
}: {
  link: EpicGoalLinkRow;
  initiativeId: string;
  kpis: KpiRow[];
  canEdit: boolean;
}) {
  const [state, action, pending] = useActionState(linkEpicToGoalAction, {});
  const chosen = kpis.find((k) => k.id === link.kpiId) ?? null;
  const [kind, setKind] = useState<string>(link.impactKind || "recurring");
  const goalSpec = {
    metricType: link.goalMetricType,
    precision: link.goalPrecision,
    currencyCode: link.goalCurrencyCode,
  };
  const hasGoalMetric =
    link.goalBaseline != null || link.goalTarget != null || link.goalCurrent != null;

  return (
    <div className="rounded border p-3">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="font-medium">{link.goalTitle}</span>
        {link.goalUnit && (
          <span className="text-xs text-muted-foreground">Ziel-Einheit: {link.goalUnit}</span>
        )}
        {chosen && link.conversionFactor != null ? (
          <span className="text-sm text-muted-foreground">
            1 {link.kpiUnit || chosen.unit || "KPI-Einheit"} →{" "}
            <span className="font-medium">
              {link.conversionFactor.toLocaleString("de-DE")} {link.goalUnit || ""}
            </span>{" "}
            · {BENEFIT_KIND_LABELS[benefitKindOrDefault(link.impactKind)]}
          </span>
        ) : (
          <span className="text-xs text-amber-700 dark:text-amber-300">
            Noch keine treibende KPI / kein Faktor gesetzt
          </span>
        )}
      </div>

      {/* Ziel-KPI (Metrik des Ziels) + Messwert. */}
      <p className="mt-1 text-xs text-muted-foreground">
        Ziel-KPI: {link.goalMetricName ? `${link.goalMetricName} · ` : ""}
        {hasGoalMetric ? (
          <>
            {formatMetricValue(link.goalBaseline, goalSpec)} →{" "}
            {formatMetricValue(link.goalTarget, goalSpec)}
            {" · aktuell "}
            <span className="font-medium text-foreground">
              {formatMetricValue(link.goalCurrent, goalSpec)}
            </span>
            {link.goalUnit ? ` ${link.goalUnit}` : ""}
          </>
        ) : (
          "— noch nicht gepflegt (im Ziele-Modul)"
        )}
      </p>

      {canEdit && kpis.length === 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          Lege zuerst eine KPI an, um die Umrechnung zu diesem Ziel zu definieren.
        </p>
      )}

      {canEdit && kpis.length > 0 && (
        <form action={action} className="mt-2 flex flex-wrap items-end gap-2">
          <input type="hidden" name="epicId" value={initiativeId} />
          <input type="hidden" name="goalId" value={link.objectiveId} />
          <label className="flex flex-col gap-1 text-xs font-medium">
            KPI
            <select name="kpiId" defaultValue={link.kpiId ?? ""} className={`${inputCls} w-48`}>
              <option value="">— wählen —</option>
              {kpis.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}
                  {k.unit ? ` (${k.unit})` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium">
            {link.goalUnit ? `${link.goalUnit} je 1 KPI-Einheit` : "Ziel-Einheit je 1 KPI-Einheit"}
            <input
              type="number"
              step="any"
              name="conversionFactor"
              defaultValue={link.conversionFactor ?? ""}
              placeholder="z. B. 10000"
              className={`${inputCls} w-32`}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium">
            Wirkung
            <select
              name="impactKind"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              className={`${inputCls} w-44`}
            >
              <option value="recurring">{BENEFIT_KIND_LABELS.recurring}</option>
              <option value="one_time">{BENEFIT_KIND_LABELS.one_time}</option>
            </select>
          </label>
          {kind === "recurring" && (
            <label className="flex flex-col gap-1 text-xs font-medium">
              Intervall
              <select
                name="recurringInterval"
                defaultValue={recurringIntervalOrDefault(link.recurringInterval)}
                className={`${inputCls} w-32`}
              >
                <option value="yearly">{RECURRING_INTERVAL_LABELS.yearly}</option>
                <option value="monthly">{RECURRING_INTERVAL_LABELS.monthly}</option>
              </select>
            </label>
          )}
          <button
            type="submit"
            disabled={pending}
            className="rounded bg-secondary px-2 py-1 text-xs font-medium hover:bg-secondary/80 disabled:opacity-50"
          >
            Speichern
          </button>
        </form>
      )}
      {state?.error && (
        <p role="alert" className="mt-1 text-xs text-destructive">
          {state.error}
        </p>
      )}
    </div>
  );
}

/** „Verknüpfte Ziele" — je Ziel die treibende KPI + Einheiten-Umrechnung definieren. */
function LinkedGoalsSection({
  initiativeId,
  goalLinks,
  kpis,
  canEdit,
}: {
  initiativeId: string;
  goalLinks: EpicGoalLinkRow[];
  kpis: KpiRow[];
  canEdit: boolean;
}) {
  return (
    <div className="space-y-2 border-t pt-4">
      <h3 className="text-sm font-medium">Verknüpfte Ziele</h3>
      <p className="text-xs text-muted-foreground">
        Verknüpfe Epics im jeweiligen Ziel („Related work"). Pro Ziel legst du hier fest, welche KPI
        es treibt und wie viel Ziel-Einheit eine KPI-Einheit bewegt (z. B. 10000 €/Wagon).
      </p>
      {goalLinks.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Noch mit keinem Ziel verknüpft. Verknüpfung erfolgt im Ziele-Modul („Related work").
        </p>
      ) : (
        <div className="space-y-2">
          {goalLinks.map((link) => (
            <LinkedGoalRow
              key={link.objectiveId}
              link={link}
              initiativeId={initiativeId}
              kpis={kpis}
              canEdit={canEdit}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** KPIs tab — lists the Epic's KPIs with baseline/target/actual and inline CRUD. */
export function EpicKpisTab({ initiativeId, kpis, canEdit, goalLinks, signoff }: Props) {
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

      {goalLinks && (
        <LinkedGoalsSection
          initiativeId={initiativeId}
          goalLinks={goalLinks}
          kpis={kpis}
          canEdit={canEdit}
        />
      )}
    </div>
  );
}
