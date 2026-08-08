"use client";

import { useActionState, useState } from "react";
import { ChevronDown, Gauge, Target } from "lucide-react";
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
import { formatCompactEUR } from "@/lib/formatting";
import type { EpicGoalLinkRow } from "@/server/views/epic-goal-contributions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SectionLabel } from "@/components/ui/section-label";
import { Separator } from "@/components/ui/separator";
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

/** Native-Select im Look der `Input`-Primitive (kein Select-Primitive im Kit). */
const selectCls =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

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

/** Zielerreichung 0..1 (Aktuell relativ zu Baseline→Ziel); null wenn nicht messbar. */
function kpiRatio(kpi: Pick<KpiRow, "baseline" | "target" | "latest">): number | null {
  const { baseline, target, latest } = kpi;
  if (baseline == null || target == null) return null;
  const denom = target - baseline;
  if (denom === 0) return latest != null ? 1 : 0;
  if (latest == null) return null;
  return Math.min(1, Math.max(0, (latest - baseline) / denom));
}

/** Schlanker Fortschrittsbalken im „Realisierter Mehrwert"-Stil. */
function TileBar({ ratio }: { ratio: number | null }) {
  const pct = ratio == null ? 0 : Math.round(ratio * 100);
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-primary/70 transition-[width]"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/** Mini-Trendlinie über die Messwert-Historie (chronologisch, letzter Punkt markiert). */
function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const step = 100 / (points.length - 1);
  const y = (v: number) => (22 - ((v - min) / range) * 18 + 1).toFixed(1);
  const coords = points.map((v, i) => `${(i * step).toFixed(1)},${y(v)}`).join(" ");
  return (
    <svg
      viewBox="0 0 100 24"
      preserveAspectRatio="none"
      className="h-6 w-20 shrink-0 overflow-visible text-primary"
      aria-hidden="true"
    >
      <polyline
        points={coords}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={100} cy={y(points[points.length - 1]!)} r={1.8} className="fill-primary" />
    </svg>
  );
}

/** Kleiner „Bearbeiten"-Umschalter (kein Collapsible-Primitive im Kit). */
function EditToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      {open ? "Fertig" : "Bearbeiten"}
      <ChevronDown className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
    </button>
  );
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
  const ratio = kpiRatio(kpi);
  const [editing, setEditing] = useState(false);

  const err = delState?.error ?? measState?.error ?? weightState?.error ?? detState?.error;
  const history = [...(kpi.measurements ?? [])].sort((a, b) => b.date.localeCompare(a.date));
  const series = [...(kpi.measurements ?? [])]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((m) => m.value);

  return (
    <div className="rounded-lg border bg-card p-4">
      {/* Kopf: Name + Benefit-Badge + Bearbeiten */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-medium">{kpi.name}</span>
          {kpi.unit && <span className="text-xs text-muted-foreground">{kpi.unit}</span>}
          <Badge
            className={
              kind === "one_time"
                ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200"
                : "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200"
            }
          >
            {BENEFIT_KIND_LABELS[kind]}
            {kind === "recurring" &&
              ` · ${RECURRING_INTERVAL_LABELS[recurringIntervalOrDefault(kpi.recurringInterval)]}`}
          </Badge>
        </div>
        {canEdit && <EditToggle open={editing} onToggle={() => setEditing((v) => !v)} />}
      </div>

      {/* Lese-Körper: große Ist-Zahl + „von Ziel" + €-Gesamt */}
      <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="text-2xl font-semibold tabular-nums">{fmt(kpi.latest)}</p>
        <p className="text-sm text-muted-foreground">
          von <span className="font-medium text-foreground">{fmt(kpi.target)}</span>
          {kpi.unit ? ` ${kpi.unit}` : ""}
        </p>
        {total != null && (
          <p className="ml-auto text-sm text-muted-foreground">
            ≈ <span className="font-medium text-foreground">{formatCompactEUR(total)}</span> Nutzen
          </p>
        )}
      </div>

      <div className="mt-2 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <TileBar ratio={ratio} />
          <p className="mt-1 text-[10px] text-muted-foreground">
            Baseline {fmt(kpi.baseline)} → Ziel {fmt(kpi.target)}
            {ratio != null && ` · ${Math.round(ratio * 100)} % erreicht`}
            {kpi.valuePerUnit != null && ` · ${fmtEur(kpi.valuePerUnit)}/Einheit`}
          </p>
        </div>
        <Sparkline points={series} />
      </div>

      {/* Bearbeiten (Default eingeklappt) */}
      {canEdit && editing && (
        <div className="mt-3 space-y-3 border-t pt-3">
          {/* Messwert erfassen */}
          <form action={measAction} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="id" value={kpi.id} />
            <input type="hidden" name="initiativeId" value={initiativeId} />
            <label className="flex flex-col gap-1 text-xs font-medium">
              Messwert erfassen
              <div className="flex items-center gap-2">
                <Input type="date" name="date" required aria-label="Datum" className="w-40" />
                <Input
                  type="number"
                  step="any"
                  name="value"
                  required
                  placeholder="Wert"
                  aria-label="Messwert"
                  className="w-32"
                />
                <Button type="submit" variant="secondary" size="sm" disabled={measPending}>
                  Erfassen
                </Button>
              </div>
            </label>
          </form>

          {/* Nutzen-Anteil — Bewertung (€/Benefit-Art/Intervall) liegt am Ziel-Link. */}
          <form action={weightAction} className="flex items-end gap-2">
            <input type="hidden" name="id" value={kpi.id} />
            <input type="hidden" name="initiativeId" value={initiativeId} />
            <label className="flex flex-col gap-1 text-xs font-medium">
              Nutzen-Anteil %
              <Input
                type="number"
                step="any"
                min={0}
                name="weightPercent"
                defaultValue={kpi.weight != null ? kpi.weight * 100 : ""}
                placeholder="auto"
                aria-label="Nutzen-Anteil in Prozent"
                className="w-24"
              />
            </label>
            <Button type="submit" variant="secondary" size="sm" disabled={weightPending}>
              Speichern
            </Button>
          </form>

          {/* Kalkulations-Notiz — eigener Save. */}
          <form action={detAction} className="flex flex-col gap-1">
            <input type="hidden" name="id" value={kpi.id} />
            <input type="hidden" name="initiativeId" value={initiativeId} />
            <label className="flex flex-col gap-1 text-xs font-medium">
              Kalkulations-Notiz
              <Textarea
                name="calculationNote"
                rows={2}
                defaultValue={kpi.calculationNote ?? ""}
                placeholder="Wie wird dieser Wert hergeleitet?"
                className="resize-y"
              />
            </label>
            <Button
              type="submit"
              variant="secondary"
              size="sm"
              disabled={detPending}
              className="self-start"
            >
              Notiz speichern
            </Button>
          </form>

          {/* Verlauf */}
          {history.length > 0 && (
            <div>
              <SectionLabel className="mb-1">Verlauf</SectionLabel>
              <ul className="space-y-0.5 text-xs tabular-nums">
                {history.map((m, i) => (
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

          {/* Entfernen */}
          <form action={delAction} className="border-t pt-2">
            <input type="hidden" name="id" value={kpi.id} />
            <input type="hidden" name="initiativeId" value={initiativeId} />
            <button
              type="submit"
              disabled={delPending}
              className="text-xs text-destructive hover:underline disabled:opacity-50"
            >
              KPI entfernen
            </button>
          </form>
        </div>
      )}

      {err && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {err}
        </p>
      )}
    </div>
  );
}

/** KPI-Erfassung als Pop-up (entlastet die volle Detailseite). */
function CreateKpiForm({ initiativeId }: { initiativeId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createKpiAction, {});
  useCreateResult(state, () => setOpen(false));

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        KPI hinzufügen
      </Button>

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
                <Input name="name" required />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium">
                Einheit
                <Input name="unit" />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium">
                Baseline
                <Input type="number" step="any" name="baseline" />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium">
                Ziel
                <Input type="number" step="any" name="target" />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium">
                Nutzen-Anteil %
                <Input type="number" step="any" min={0} name="weightPercent" placeholder="auto" />
              </label>
            </div>
            <p className="text-xs text-muted-foreground">
              Die Nutzenbewertung (€/Einheit, Benefit-Art, Intervall) wird beim Verknüpfen mit einem
              Ziel gepflegt.
            </p>
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

/** Eine Kachel je verknüpftem Ziel: Lese-Ansicht + aufklappbares Umrechnungs-Formular. */
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
  const [editing, setEditing] = useState(false);
  const goalSpec = {
    metricType: link.goalMetricType,
    precision: link.goalPrecision,
    currencyCode: link.goalCurrencyCode,
  };
  const hasGoalMetric =
    link.goalBaseline != null || link.goalTarget != null || link.goalCurrent != null;
  const isSet = chosen != null && link.conversionFactor != null;
  const kpiUnit = link.kpiUnit || chosen?.unit || "KPI-Einheit";

  return (
    <div className="rounded-lg border bg-card p-4">
      {/* Kopf: Ziel-Titel + Bearbeiten */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">{link.goalTitle}</p>
          {link.goalUnit && (
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Ziel-Einheit: {link.goalUnit}
            </p>
          )}
        </div>
        {canEdit && kpis.length > 0 && (
          <EditToggle open={editing} onToggle={() => setEditing((v) => !v)} />
        )}
      </div>

      {/* Lese-Körper: Umrechnung + Ziel-KPI-Messwert */}
      <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {isSet ? (
          <>
            <p className="text-xl font-semibold tabular-nums">
              {link.conversionFactor!.toLocaleString("de-DE")}
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                {link.goalUnit || ""} je 1 {kpiUnit}
              </span>
            </p>
            <Badge variant="outline">
              {BENEFIT_KIND_LABELS[benefitKindOrDefault(link.impactKind)]}
            </Badge>
          </>
        ) : (
          <p className="text-sm text-amber-700 dark:text-amber-300">
            Noch keine treibende KPI / kein Faktor gesetzt
          </p>
        )}
      </div>

      <p className="mt-1 text-[10px] text-muted-foreground">
        Ziel-KPI: {link.goalMetricName ? `${link.goalMetricName} · ` : ""}
        {hasGoalMetric ? (
          <>
            {formatMetricValue(link.goalBaseline, goalSpec)} →{" "}
            {formatMetricValue(link.goalTarget, goalSpec)} · aktuell{" "}
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

      {/* Umrechnungs-Formular (Default eingeklappt) */}
      {canEdit && kpis.length > 0 && editing && (
        <form action={action} className="mt-3 flex flex-wrap items-end gap-2 border-t pt-3">
          <input type="hidden" name="epicId" value={initiativeId} />
          <input type="hidden" name="goalId" value={link.objectiveId} />
          <label className="flex flex-col gap-1 text-xs font-medium">
            KPI
            <select name="kpiId" defaultValue={link.kpiId ?? ""} className={`${selectCls} w-48`}>
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
            <Input
              type="number"
              step="any"
              name="conversionFactor"
              defaultValue={link.conversionFactor ?? ""}
              placeholder="z. B. 10000"
              className="w-32"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium">
            Wirkung
            <select
              name="impactKind"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              className={`${selectCls} w-44`}
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
                className={`${selectCls} w-32`}
              >
                <option value="yearly">{RECURRING_INTERVAL_LABELS.yearly}</option>
                <option value="monthly">{RECURRING_INTERVAL_LABELS.monthly}</option>
              </select>
            </label>
          )}
          <Button type="submit" variant="secondary" size="sm" disabled={pending}>
            Speichern
          </Button>
        </form>
      )}
      {state?.error && (
        <p role="alert" className="mt-2 text-xs text-destructive">
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
    <section className="space-y-3">
      <SectionLabel>Verknüpfte Ziele</SectionLabel>
      <p className="text-xs text-muted-foreground">
        Pro Ziel legst du fest, welche KPI es treibt und wie viel Ziel-Einheit eine KPI-Einheit
        bewegt (z. B. 10000 €/Wagon). Verknüpfung erfolgt im Ziele-Modul („Related work").
      </p>
      {goalLinks.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed bg-card/50 px-4 py-8 text-center">
          <Target className="size-6 text-muted-foreground/60" />
          <p className="text-sm text-muted-foreground">Noch mit keinem Ziel verknüpft.</p>
        </div>
      ) : (
        <div className="space-y-3">
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
    </section>
  );
}

/** KPIs tab — read-first tiles per KPI with edit-on-demand + linked-goal cascade. */
export function EpicKpisTab({ initiativeId, kpis, canEdit, goalLinks, signoff }: Props) {
  return (
    <div className="space-y-6">
      {signoff && <SectionSignoffBanner epicId={initiativeId} section="kpis" {...signoff} />}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <SectionLabel>KPIs</SectionLabel>
          {canEdit && <CreateKpiForm initiativeId={initiativeId} />}
        </div>
        <p className="text-xs text-muted-foreground">
          Der „Nutzen-Anteil" je KPI bestimmt, welchen Teil des wiederkehrenden Nutzens diese KPI
          realisiert. Ohne Anteil tragen alle KPIs gleichmäßig bei.
        </p>

        {kpis.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed bg-card/50 px-4 py-8 text-center">
            <Gauge className="size-6 text-muted-foreground/60" />
            <p className="text-sm text-muted-foreground">Noch keine KPIs erfasst.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {kpis.map((kpi) => (
              <KpiItem key={kpi.id} kpi={kpi} initiativeId={initiativeId} canEdit={canEdit} />
            ))}
          </div>
        )}
      </section>

      {goalLinks && (
        <>
          <Separator />
          <LinkedGoalsSection
            initiativeId={initiativeId}
            goalLinks={goalLinks}
            kpis={kpis}
            canEdit={canEdit}
          />
        </>
      )}
    </div>
  );
}
