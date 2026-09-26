"use client";

import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import { useActionState, useState } from "react";
import { ChevronDown, Gauge, Target } from "lucide-react";
import {
  createKpiAction,
  deleteKpiAction,
  recordKpiMeasurementAction,
  updateKpiWeightAction,
  updateKpiBasicsAction,
  updateKpiDetailsAction,
} from "@/modules/work/features/portfolio/actions/kpi";
import { linkEpicToGoalAction } from "@/modules/core/goals/features/actions/ziele";
import {
  benefitKindOrDefault,
  BENEFIT_KIND_KEYS,
} from "@/modules/core/kpi/domain/kpi-benefit-kind";
import {
  recurringIntervalOrDefault,
  RECURRING_INTERVAL_LABELS,
} from "@/modules/core/kpi/domain/kpi-recurring-interval";
import { formatMetricValue } from "@/modules/core/goals/domain/goal-metric";
import type { KpiOutcome } from "@/modules/core/kpi/domain/kpi-outcome";
import { formatCompactEUR } from "@/lib/formatting";
import type { EpicGoalLinkRow } from "@/modules/core/goals/server/views/epic-goal-contributions";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Sparkline } from "@/components/charts/sparkline";
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
  /** Zielerreichung 0..1 (Core `kpiAttainment`), im Read-Model vorberechnet; null = nicht messbar. */
  attainment: number | null;
  /**
   * Geplanter €-Nutzen bei 100 % Zielerreichung (Core `kpiPlanned`), im
   * Read-Model vorberechnet; null = unbewertet. Wiederkehrend + monatlich
   * ist bereits annualisiert — dieselbe Zahl, die Rechen-Reiter und Overview
   * zeigen.
   */
  plannedTotal: number | null;
}

/**
 * Eine Ziel-Verknüpfung **mit vorberechnetem Ergebnis**. `kpiOutcome` lief
 * vorher hier im Browser, je Link — obwohl das Read-Model für dieselben KPIs
 * ausdrücklich festhält, dass die Fläche rendern und nicht rechnen soll. Die
 * Rechnung liegt jetzt in der Seite, wo Link und `frozenAt` zusammenkommen.
 */
export type EpicGoalLinkWithOutcome = EpicGoalLinkRow & { outcome: KpiOutcome };

interface Props {
  initiativeId: string;
  kpis: KpiRow[];
  canEdit: boolean;
  /**
   * Der L4.2-Stempel als ISO-Tag. Steht er, ist die **Menge** festgeschrieben
   * (ADR-0024 / Wiki „Die Wirkung") — Baseline und Ziel sind dann gesperrt,
   * weil ein verschobenes Ziel die eingefrorene Zielerreichung rückwirkend
   * verändern würde. Der Name bleibt änderbar.
   */
  quantityFrozenAtIso?: string | null;
  /** Verknüpfte Ziele dieses Epics (Einheiten-Kaskade); leer = keine. */
  goalLinks?: EpicGoalLinkWithOutcome[];
  /** Sign-off state for the KPIs section (omit to hide the banner). */
}

/** Native-Select im Look der `Input`-Primitive (kein Select-Primitive im Kit). */
const selectCls =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

const tagOf = (locale?: Locale): string => (locale === "en" ? "en-GB" : "de-DE");

function fmt(n: number | null, locale?: Locale): string {
  return n === null ? "—" : n.toLocaleString(tagOf(locale));
}

function fmtEur(n: number | null, locale?: Locale): string {
  return n === null
    ? "—"
    : n.toLocaleString(tagOf(locale), {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0,
      });
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

/**
 * „Bearbeiten"-Umschalter. Kein Collapsible-Primitive im Kit — die Schaltfläche
 * selbst kommt aber aus der Bibliothek statt als rohes `<button>` mit
 * nachgebauten Hover-Klassen.
 */
function EditToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const t = useTranslations();
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onToggle}
      aria-expanded={open}
      className="shrink-0 gap-1 text-xs text-muted-foreground"
    >
      {open ? t("work.epic.fertigButton") : t("common.edit")}
      <ChevronDown className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
    </Button>
  );
}

function KpiItem({
  kpi,
  initiativeId,
  canEdit,
  quantityFrozen,
}: {
  kpi: KpiRow;
  initiativeId: string;
  canEdit: boolean;
  quantityFrozen: boolean;
}) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const [basicsState, basicsAction, basicsPending] = useActionState(updateKpiBasicsAction, {});
  const [delState, delAction, delPending] = useActionState(deleteKpiAction, {});
  const [measState, measAction, measPending] = useActionState(recordKpiMeasurementAction, {});
  const [weightState, weightAction, weightPending] = useActionState(updateKpiWeightAction, {});
  const [detState, detAction, detPending] = useActionState(updateKpiDetailsAction, {});

  const kind = benefitKindOrDefault(kpi.benefitKind);
  const total = kpi.plannedTotal;
  const ratio = kpi.attainment;
  const [editing, setEditing] = useState(false);

  const err = delState?.error ?? measState?.error ?? weightState?.error ?? detState?.error;
  const history = [...(kpi.measurements ?? [])].sort((a, b) => b.date.localeCompare(a.date));
  const series = [...(kpi.measurements ?? [])]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((m) => m.value);

  return (
    <div className="rounded-lg bg-card p-4 shadow-card">
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
            {t(BENEFIT_KIND_KEYS[kind])}
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
          {t("work.epic.von")}{" "}
          <span className="font-medium text-foreground">{fmt(kpi.target)}</span>
          {kpi.unit ? ` ${kpi.unit}` : ""}
        </p>
        {total != null && (
          <p className="ml-auto text-sm text-muted-foreground">
            {t.rich(
              kind === "recurring"
                ? "work.epic.ungefaehrNutzenProJahr"
                : "work.epic.ungefaehrNutzenEinmalig",
              {
                amount: formatCompactEUR(total, locale),
                b: (c) => <span className="font-medium text-foreground">{c}</span>,
              },
            )}
          </p>
        )}
      </div>

      <div className="mt-2 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <TileBar ratio={ratio} />
          <p className="mt-1 text-label text-muted-foreground">
            {t(
              ratio != null
                ? kpi.valuePerUnit != null
                  ? "work.epic.kpiBaselineZielErreichtWertJeEinheit"
                  : "work.epic.kpiBaselineZielErreicht"
                : kpi.valuePerUnit != null
                  ? "work.epic.kpiBaselineZielWertJeEinheit"
                  : "work.epic.kpiBaselineZiel",
              {
                baseline: fmt(kpi.baseline, locale),
                target: fmt(kpi.target, locale),
                percent: ratio != null ? Math.round(ratio * 100) : 0,
                perUnit: fmtEur(kpi.valuePerUnit, locale),
              },
            )}
          </p>
        </div>
        <Sparkline points={series} />
      </div>

      {/* Bearbeiten (Default eingeklappt) */}
      {canEdit && editing && (
        <div className="mt-3 space-y-3 border-t pt-3">
          {/**
           * **Stammdaten** — bis September 2026 gab es sie nur beim Anlegen.
           * Wer sich im Namen vertippt hatte, musste die KPI löschen und neu
           * anlegen, und verlor dabei die ganze Messreihe.
           */}
          <form action={basicsAction} className="grid gap-2 sm:grid-cols-2">
            <input type="hidden" name="id" value={kpi.id} />
            <input type="hidden" name="initiativeId" value={initiativeId} />
            <label className="flex flex-col gap-1 text-xs font-medium">
              {t("work.epic.name")}
              <Input name="name" defaultValue={kpi.name} required />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium">
              {t("work.epic.einheit")}
              <Input name="unit" defaultValue={kpi.unit ?? ""} />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium">
              {t("work.epic.baseline")}
              <Input
                type="number"
                step="any"
                name="baseline"
                defaultValue={kpi.baseline ?? ""}
                disabled={quantityFrozen}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium">
              {t("work.epic.ziel")}
              <Input
                type="number"
                step="any"
                name="target"
                defaultValue={kpi.target ?? ""}
                disabled={quantityFrozen}
              />
            </label>
            {quantityFrozen && (
              <p className="text-label text-muted-foreground sm:col-span-2">
                {t("work.epic.mengeEingefroren")}
              </p>
            )}
            {basicsState.error && (
              <p className="text-xs text-destructive sm:col-span-2">{basicsState.error}</p>
            )}
            <div className="sm:col-span-2">
              <Button type="submit" variant="secondary" size="sm" disabled={basicsPending}>
                {t("work.epic.speichern")}
              </Button>
            </div>
          </form>

          {/* Messwert erfassen */}
          <form action={measAction} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="id" value={kpi.id} />
            <input type="hidden" name="initiativeId" value={initiativeId} />
            <label className="flex flex-col gap-1 text-xs font-medium">
              {t("work.epic.messwertErfassen")}
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  name="date"
                  required
                  aria-label={t("work.epic.datum")}
                  className="w-40"
                />
                <Input
                  type="number"
                  step="any"
                  name="value"
                  required
                  placeholder={t("work.epic.wert")}
                  aria-label={t("work.epic.messwert")}
                  className="w-32"
                />
                <Button type="submit" variant="secondary" size="sm" disabled={measPending}>
                  {t("work.epic.erfassen")}
                </Button>
              </div>
            </label>
          </form>

          {/* Nutzen-Anteil — Bewertung (€/Benefit-Art/Intervall) liegt am Ziel-Link. */}
          <form action={weightAction} className="flex items-end gap-2">
            <input type="hidden" name="id" value={kpi.id} />
            <input type="hidden" name="initiativeId" value={initiativeId} />
            <label className="flex flex-col gap-1 text-xs font-medium">
              {t("work.epic.nutzenAnteil")}
              <Input
                type="number"
                step="any"
                min={0}
                name="weightPercent"
                defaultValue={kpi.weight != null ? kpi.weight * 100 : ""}
                placeholder={t("work.epic.auto")}
                aria-label={t("work.epic.nutzenAnteilInProzent")}
                className="w-24"
              />
            </label>
            <Button type="submit" variant="secondary" size="sm" disabled={weightPending}>
              {t("work.epic.speichern")}
            </Button>
          </form>

          {/* Kalkulations-Notiz — eigener Save. */}
          <form action={detAction} className="flex flex-col gap-1">
            <input type="hidden" name="id" value={kpi.id} />
            <input type="hidden" name="initiativeId" value={initiativeId} />
            <label className="flex flex-col gap-1 text-xs font-medium">
              {t("work.epic.kalkulationsNotiz")}
              <Textarea
                name="calculationNote"
                rows={2}
                defaultValue={kpi.calculationNote ?? ""}
                placeholder={t("work.epic.wieWirdDieserWert")}
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
              {t("work.epic.notizSpeichern")}
            </Button>
          </form>

          {/* Verlauf */}
          {history.length > 0 && (
            <div>
              <SectionLabel className="mb-1">{t("work.epic.verlauf")}</SectionLabel>
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
              {t("work.epic.kpiEntfernen")}
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
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createKpiAction, {});
  useCreateResult(state, () => setOpen(false));

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        {t("work.epic.kpiHinzufuegen")}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("work.epic.kpiHinzufuegen")}</DialogTitle>
          </DialogHeader>
          <form action={action} className="space-y-3">
            <input type="hidden" name="initiativeId" value={initiativeId} />
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs font-medium">
                {t("work.epic.name")}
                <Input name="name" required />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium">
                {t("work.epic.einheit")}
                <Input name="unit" />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium">
                {t("work.epic.baseline")}
                <Input type="number" step="any" name="baseline" />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium">
                {t("work.epic.ziel")}
                <Input type="number" step="any" name="target" />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium">
                {t("work.epic.nutzenAnteil")}
                <Input
                  type="number"
                  step="any"
                  min={0}
                  name="weightPercent"
                  placeholder={t("work.epic.auto")}
                />
              </label>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("work.epic.dieNutzenbewertungEinheitBenefit")}
            </p>
            {state?.error && (
              <p role="alert" className="text-xs text-destructive">
                {state.error}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {t("work.epic.abbrechen")}
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? t("common.ui.speichernLaeuft") : t("work.epic.kpiHinzufuegen")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Plan gegen Ist **dieser Verknüpfung**, in Ziel-Einheiten.
 *
 * `kpiOutcome` rechnet einheiten-agnostisch: was dort „€ je Einheit" heisst, ist
 * hier der Umrechnungsfaktor, und das Ergebnis steht in Ziel-Einheiten statt in
 * Euro. Deshalb dieselbe Zerlegung wie in der Kachel „Realisierter Mehrwert" —
 * **Menge** (Zielerreichung der treibenden KPI, friert mit L4.2) und **Wert**
 * (der Faktor, den Finance bis L5 nachziehen darf) getrennt ausgewiesen. Ohne
 * diese Anzeige bleibt eine Faktor-Korrektur an dieser Stelle folgenlos sichtbar.
 */
function LinkOutcome({
  link,
  goalSpec,
}: {
  link: EpicGoalLinkWithOutcome;
  goalSpec: {
    metricType: string;
    precision: number;
    currencyCode: string | null;
    metricUnit: string | null;
  };
}) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const o = link.outcome;

  if (o.planned === 0 && o.realized === 0) return null;
  const unit = link.goalUnit ? ` ${link.goalUnit}` : "";
  const perYear =
    benefitKindOrDefault(link.impactKind) === "recurring" ? t("work.epic.proJahrSuffix") : "";
  const measured = link.kpiMeasurements.length > 0;
  const hasPlan = link.planSnapshot != null;

  return (
    <div className="mt-3 border-t pt-2">
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-label text-muted-foreground">
        <dt>{t("work.epic.planBeiFreigabe")}</dt>
        <dd className="text-right tabular-nums">
          {formatMetricValue(o.planned, goalSpec, locale)}
          {unit}
          {perYear}
        </dd>
        <dt className="inline-flex items-center gap-1">
          {t("work.epic.ist")}
          {o.frozen && (
            <span title={t("work.epic.dieUmsetzungIstAbgenommen")}>
              {t("work.epic.festgeschriebenInKlammern")}
            </span>
          )}
        </dt>
        <dd className="text-right tabular-nums">
          {measured ? (
            <>
              <span className="font-medium text-foreground">
                {formatMetricValue(o.realized, goalSpec, locale)}
                {unit}
                {perYear}
              </span>{" "}
              · {Math.round(o.attainment * 100)} %
            </>
          ) : (
            t("work.epic.nochNichtGemessen")
          )}
        </dd>
        {hasPlan && measured && (
          <>
            <dt>{t("work.epic.mengeZielerreichung")}</dt>
            <dd className="text-right tabular-nums">
              <LinkDelta value={o.quantityDelta} goalSpec={goalSpec} suffix={unit + perYear} />
            </dd>
            <dt>{t("work.epic.wertUmrechnungsfaktor")}</dt>
            <dd className="text-right tabular-nums">
              <LinkDelta value={o.valueDelta} goalSpec={goalSpec} suffix={unit + perYear} />
            </dd>
          </>
        )}
      </dl>
      {!hasPlan && (
        <p className="mt-1 text-label text-warning">{t("work.epic.keinPlanBezugFestgehalten")}</p>
      )}
    </div>
  );
}

/** Ein Abweichungs-Betrag mit Vorzeichen — grün über Plan, bernstein darunter. */
function LinkDelta({
  value,
  goalSpec,
  suffix,
}: {
  value: number;
  goalSpec: {
    metricType: string;
    precision: number;
    currencyCode: string | null;
    metricUnit: string | null;
  };
  suffix: string;
}) {
  if (Math.abs(value) < 0.5) return <span>—</span>;
  const over = value > 0;
  return (
    <span
      className={
        over ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"
      }
    >
      {over ? "+" : "−"}
      {formatMetricValue(Math.abs(value), goalSpec)}
      {suffix}
    </span>
  );
}

/** Eine Kachel je verknüpftem Ziel: Lese-Ansicht + aufklappbares Umrechnungs-Formular. */
function LinkedGoalRow({
  link,
  initiativeId,
  kpis,
  canEdit,
}: {
  link: EpicGoalLinkWithOutcome;
  initiativeId: string;
  kpis: KpiRow[];
  canEdit: boolean;
}) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const [state, action, pending] = useActionState(linkEpicToGoalAction, {});
  const chosen = kpis.find((k) => k.id === link.kpiId) ?? null;
  const [kind, setKind] = useState<string>(link.impactKind || "recurring");
  // Kontrolliert, damit die Beschriftung des Faktor-Feldes der Auswahl folgen
  // kann — mit `defaultValue` wüsste sie nichts von ihr.
  const [kpiId, setKpiId] = useState(link.kpiId ?? "");
  const [editing, setEditing] = useState(false);
  const goalSpec = {
    metricType: link.goalMetricType,
    precision: link.goalPrecision,
    currencyCode: link.goalCurrencyCode,
    metricUnit: link.goalUnit,
  };
  const hasGoalMetric =
    link.goalBaseline != null || link.goalTarget != null || link.goalCurrent != null;
  const isSet = chosen != null && link.conversionFactor != null;
  const kpiUnit = link.kpiUnit || chosen?.unit || t("work.epic.kpiEinheit");

  return (
    <div className="rounded-lg bg-card p-4 shadow-card">
      {/* Kopf: Ziel-Titel + Bearbeiten */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">{link.goalTitle}</p>
          {link.goalUnit && (
            <p className="text-label font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              {t("work.epic.zielEinheitMitWert", { unit: link.goalUnit })}
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
              {link.conversionFactor!.toLocaleString(tagOf(locale))}
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                {t("work.epic.zielEinheitJeKpiEinheit", {
                  goalUnit: link.goalUnit || "",
                  kpiUnit,
                })}
              </span>
            </p>
            <Badge variant="outline">
              {t(BENEFIT_KIND_KEYS[benefitKindOrDefault(link.impactKind)])}
            </Badge>
          </>
        ) : (
          <p className="text-sm text-amber-700 dark:text-amber-300">
            {t("work.epic.nochKeineTreibendeKpi")}
          </p>
        )}
      </div>

      <p className="mt-1 text-label text-muted-foreground">
        {hasGoalMetric
          ? t.rich(
              link.goalMetricName ? "work.epic.zielKpiMitNameWerte" : "work.epic.zielKpiWerte",
              {
                name: link.goalMetricName ?? "",
                baseline: formatMetricValue(link.goalBaseline, goalSpec, locale),
                target: formatMetricValue(link.goalTarget, goalSpec, locale),
                current: formatMetricValue(link.goalCurrent, goalSpec, locale),
                unit: link.goalUnit ? ` ${link.goalUnit}` : "",
                b: (c) => <span className="font-medium text-foreground">{c}</span>,
              },
            )
          : link.goalMetricName
            ? t("work.epic.zielKpiMitNameNichtGepflegt", { name: link.goalMetricName })
            : t("work.epic.zielKpiNichtGepflegt")}
      </p>

      {isSet && <LinkOutcome link={link} goalSpec={goalSpec} />}

      {canEdit && kpis.length === 0 && (
        <p className="mt-2 text-xs text-muted-foreground">{t("work.epic.legeZuerstEineKpi")}</p>
      )}

      {/* Umrechnungs-Formular (Default eingeklappt) */}
      {canEdit && kpis.length > 0 && editing && (
        <form action={action} className="mt-3 flex flex-wrap items-end gap-2 border-t pt-3">
          <input type="hidden" name="epicId" value={initiativeId} />
          <input type="hidden" name="goalId" value={link.objectiveId} />
          <label className="flex flex-col gap-1 text-xs font-medium">
            {t("work.common.kpi")}
            <select
              name="kpiId"
              value={kpiId}
              onChange={(e) => setKpiId(e.target.value)}
              className={`${selectCls} w-48`}
            >
              <option value="">{t("work.epic.waehlen")}</option>
              {kpis.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}
                  {k.unit ? ` (${k.unit})` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium">
            {/**
             * **Was der Faktor umrechnet, steht jetzt im Feld.**
             *
             * Hier stand „{Ziel-Einheit} je 1 KPI-Einheit" — die eine Hälfte
             * konkret, die andere generisch, obwohl die KPI-Einheit zwei
             * Zeilen darüber im Auswahlfeld sichtbar ist. Dafür muss die
             * Auswahl kontrolliert sein: mit `defaultValue` weiss die
             * Beschriftung nichts von ihr.
             *
             * Derselbe Satzbau wie beim Beitrag eines Unterziels zum
             * Elternziel — die beiden Faktoren werden ohnehin ständig
             * verwechselt (Wiki „Die Wirkung": *zwei Faktoren, die man
             * verwechselt*), da sollen sie wenigstens gleich aussehen.
             */}
            {t("work.epic.jeEinheit", {
              ziel: link.goalUnit || t("work.epic.zielEinheit"),
              kpi: kpis.find((k) => k.id === kpiId)?.unit || t("work.epic.kpiEinheit"),
            })}
            <Input
              type="number"
              step="any"
              name="conversionFactor"
              defaultValue={link.conversionFactor ?? ""}
              placeholder={t("work.common.example10000")}
              className="w-32"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium">
            {t("work.epic.wirkung")}
            <select
              name="impactKind"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              className={`${selectCls} w-44`}
            >
              <option value="recurring">{t(BENEFIT_KIND_KEYS.recurring)}</option>
              <option value="one_time">{t(BENEFIT_KIND_KEYS.one_time)}</option>
            </select>
          </label>
          {kind === "recurring" && (
            <label className="flex flex-col gap-1 text-xs font-medium">
              {t("work.epic.intervall")}
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
            {t("work.epic.speichern")}
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
  goalLinks: EpicGoalLinkWithOutcome[];
  kpis: KpiRow[];
  canEdit: boolean;
}) {
  const t = useTranslations();
  return (
    <section className="space-y-3">
      <SectionLabel>{t("work.epic.verknuepfteZiele")}</SectionLabel>
      <p className="text-xs text-muted-foreground">{t("work.epic.proZielLegstDu")}</p>
      {goalLinks.length === 0 ? (
        <EmptyState
          icon={<Target className="size-6" />}
          title={t("work.epic.nochKeinZielVerknuepft")}
          body={
            "Verknüpfe dieses Vorhaben mit einem Portfolio-Ziel, damit sein Nutzen dort erscheint. Die Verknüpfung selbst entsteht im Ziele-Modul unter „Related work“."
          }
        />
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
export function EpicKpisTab({
  initiativeId,
  kpis,
  canEdit,
  goalLinks,
  quantityFrozenAtIso,
}: Props) {
  const t = useTranslations();
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <SectionLabel>{t("work.epic.kpis")}</SectionLabel>
          {canEdit && <CreateKpiForm initiativeId={initiativeId} />}
        </div>
        <p className="text-xs text-muted-foreground">{t("work.epic.derNutzenAnteilJe")}</p>

        {kpis.length === 0 ? (
          <EmptyState
            icon={<Gauge className="size-6" />}
            title={t("work.epic.nochKeineKpiErfasst")}
            body={t("work.epic.kpisTragenDenNutzen")}
          />
        ) : (
          <div className="space-y-3">
            {kpis.map((kpi) => (
              <KpiItem
                key={kpi.id}
                kpi={kpi}
                initiativeId={initiativeId}
                canEdit={canEdit}
                quantityFrozen={quantityFrozenAtIso != null}
              />
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
