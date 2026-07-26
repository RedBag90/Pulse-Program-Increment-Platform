"use client";

import { useMemo } from "react";
import { useUrlState } from "@/lib/hooks/use-url-state";
import { Page, PageHeader } from "@/components/layout";
import { PageSection } from "@/components/layout/page-section";
import { Stat, StatStrip } from "@/components/ui/stat";
import { ProgressBar } from "@/components/ui/progress-bar";
import { formatMioEUR, formatPercent } from "@/lib/formatting";
import { AMPEL_LABEL } from "@/domain/portfolio-ampel";
import type { LpmAmpel, LpmValueStreamRow, LpmEpicRow } from "@/domain/lpm-review";
import type { LpmReviewPageData } from "@/server/views/lpm-review-view";
import { tierHex } from "./chart-theme";
import { BenefitWaterfall } from "./benefit-waterfall";
import { BenefitBurnup } from "./benefit-burnup";
import { PortfolioBubbleMatrix } from "./portfolio-bubble-matrix";
import { DivergingScheduleBar } from "./diverging-schedule-bar";

/** Kleiner Ampel-Chip (grün/gelb/rot/neutral) mit Punkt + Label. */
function AmpelPill({ tier }: { tier: LpmAmpel }) {
  const label = tier === "neutral" ? "Keine Daten" : AMPEL_LABEL[tier];
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs">
      <span
        className="size-2 rounded-full"
        style={{ backgroundColor: tierHex(tier) }}
        aria-hidden
      />
      {label}
    </span>
  );
}

const pct = (r: number | null) => (r == null ? "—" : formatPercent(r));

export function LpmReviewShell({ data }: { data: LpmReviewPageData }) {
  const { model, periodLabel, asOfIso, pis, activePiId } = data;
  const { portfolio, valueStreams, epics, waterfall, burnup } = model;
  const { params, push } = useUrlState();

  const vsFilter = params.get("vs");
  const filteredEpics = useMemo(
    () => (vsFilter ? epics.filter((e) => e.valueStreamId === vsFilter) : epics),
    [epics, vsFilter],
  );
  const activeVsName = vsFilter
    ? (valueStreams.find((v) => v.id === vsFilter)?.name ?? "Value Stream")
    : null;

  // Benefit-Delta-Badge: Ton nach Schwere.
  const deltaTier: LpmAmpel =
    portfolio.benefitDeltaRatio <= -0.1
      ? "rose"
      : portfolio.benefitDeltaRatio < 0
        ? "amber"
        : "green";

  // Epic-Matrix nie ungefiltert bei > 15 Epics (Lesbarkeit, Spec).
  const showEpicMatrix = vsFilter != null || filteredEpics.length <= 15;

  return (
    <Page>
      <PageHeader
        eyebrow={<span>Datenstand: {asOfIso}</span>}
        title={`Portfolio Review — ${periodLabel}`}
        subtitle={
          <span className="inline-flex items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
              style={{ backgroundColor: `${tierHex(deltaTier)}22`, color: tierHex(deltaTier) }}
            >
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: tierHex(deltaTier) }}
                aria-hidden
              />
              Benefit-Forecast: {formatPercent(portfolio.benefitDeltaRatio)} vs. Plan
            </span>
          </span>
        }
        actions={
          <div className="flex items-center gap-2 print:hidden">
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              Stichtag
              <select
                className="rounded-md border bg-background px-2 py-1 text-xs"
                value={activePiId ?? ""}
                onChange={(e) => push({ pi: e.target.value || null })}
              >
                <option value="">Aktuell</option>
                {pis.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              Value Stream
              <select
                className="rounded-md border bg-background px-2 py-1 text-xs"
                value={vsFilter ?? ""}
                onChange={(e) => push({ vs: e.target.value || null })}
              >
                <option value="">Alle</option>
                {valueStreams
                  .filter((v) => v.id)
                  .map((v) => (
                    <option key={v.id} value={v.id!}>
                      {v.name}
                    </option>
                  ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted"
            >
              ⭳ Als PDF
            </button>
          </div>
        }
      />

      {/* ── Abschnitt 1: Portfolio gesamt ── */}
      <PageSection title="Portfolio gesamt">
        <StatStrip>
          <Stat label="Benefit geplant" value={formatMioEUR(portfolio.benefitPlan)} />
          <Stat
            label="Benefit Forecast"
            value={formatMioEUR(portfolio.benefitForecast)}
            delta={{
              tone: portfolio.benefitDelta < 0 ? "down" : "flat",
              text: `${formatPercent(portfolio.benefitDeltaRatio)} · ${formatMioEUR(portfolio.benefitDelta)}`,
            }}
          />
          <Stat
            label="Ø Plantreue / Performance"
            value={`${pct(portfolio.plantreue)} / ${pct(portfolio.performance)}`}
            delta={{
              tone:
                portfolio.ampel === "green" ? "up" : portfolio.ampel === "rose" ? "down" : "flat",
              text: portfolio.ampel === "neutral" ? "Keine Daten" : AMPEL_LABEL[portfolio.ampel],
            }}
          />
          <Stat
            label="Epics im Plan"
            value={`${portfolio.epicsOnPlan} / ${portfolio.epicTotal}`}
            delta={{
              tone: "flat",
              text: `⚠ ${portfolio.epicsAtRisk} gefährdet · ● ${portfolio.epicsCritical} kritisch`,
            }}
          />
        </StatStrip>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ChartCard title="Benefit-Wasserfall" question="Wo geht Benefit verloren?">
            <BenefitWaterfall steps={waterfall} />
          </ChartCard>
          <ChartCard title="Benefit-Burn-up" question="Öffnet oder schließt sich die Schere?">
            <BenefitBurnup points={burnup} />
          </ChartCard>
        </div>
      </PageSection>

      {/* ── Abschnitt 2: Value Streams ── */}
      <PageSection title="Value Streams">
        <ValueStreamTable
          rows={valueStreams}
          activeVs={vsFilter}
          onPick={(id) => push({ vs: id })}
        />
        <ChartCard
          title="Portfolio-Matrix (Value Streams)"
          question="Wo sitzt das wirtschaftliche Risiko?"
        >
          <PortfolioBubbleMatrix
            points={valueStreams.map((v) => ({
              name: v.name,
              plantreue: v.plantreue,
              performance: v.performance,
              benefitPlan: v.benefitPlan,
              ampel: v.ampel,
            }))}
          />
        </ChartCard>
      </PageSection>

      {/* ── Abschnitt 3: Epics ── */}
      <PageSection
        title="Epics"
        actions={
          activeVsName ? (
            <button
              type="button"
              onClick={() => push({ vs: null })}
              className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs print:border-0"
            >
              gefiltert: {activeVsName} <span aria-hidden>✕</span>
            </button>
          ) : null
        }
      >
        <EpicTable rows={filteredEpics} />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ChartCard title="Terminabweichung" question="Bei welchem Epic zuerst handeln?">
            <DivergingScheduleBar
              items={filteredEpics.map((e) => ({
                name: e.title,
                delta: e.terminabweichungPis,
                benefitPlan: e.benefitPlan,
              }))}
            />
          </ChartCard>
          <ChartCard
            title="Portfolio-Matrix (Epics)"
            question={showEpicMatrix ? "Wo steht jedes Epic?" : undefined}
          >
            {showEpicMatrix ? (
              <PortfolioBubbleMatrix
                points={filteredEpics.map((e) => ({
                  name: e.title,
                  plantreue: e.plantreue,
                  performance: e.performance,
                  benefitPlan: e.benefitPlan,
                  ampel: e.ampel,
                }))}
              />
            ) : (
              <div className="grid h-[260px] place-items-center px-6 text-center text-xs text-muted-foreground">
                Zu viele Epics für eine lesbare Matrix — bitte oben einen Value Stream wählen.
              </div>
            )}
          </ChartCard>
        </div>
      </PageSection>
    </Page>
  );
}

function ChartCard({
  title,
  question,
  children,
}: {
  title: string;
  question?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-3">
        <h3 className="text-sm font-medium">{title}</h3>
        {question && <p className="text-xs text-muted-foreground">{question}</p>}
      </div>
      {children}
    </div>
  );
}

function ValueStreamTable({
  rows,
  activeVs,
  onPick,
}: {
  rows: LpmValueStreamRow[];
  activeVs: string | null;
  onPick: (id: string | null) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
          <tr className="border-b">
            <th className="px-3 py-2 text-left font-medium">Value Stream</th>
            <th className="px-3 py-2 text-right font-medium">Benefit Plan / Fc</th>
            <th className="px-3 py-2 text-right font-medium">Plantreue</th>
            <th className="px-3 py-2 text-right font-medium">Performance</th>
            <th className="px-3 py-2 text-left font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((v) => {
            const active = v.id != null && v.id === activeVs;
            return (
              <tr
                key={v.id ?? "__none__"}
                onClick={() => v.id && onPick(active ? null : v.id)}
                className={`border-b last:border-0 ${v.id ? "cursor-pointer hover:bg-muted/40" : ""} ${active ? "bg-muted/50" : ""}`}
              >
                <td className="px-3 py-2 font-medium">{v.name}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatMioEUR(v.benefitPlan)} / {formatMioEUR(v.benefitForecast)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{pct(v.plantreue)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{pct(v.performance)}</td>
                <td className="px-3 py-2">
                  <AmpelPill tier={v.ampel} />
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="px-3 py-6 text-center text-xs text-muted-foreground">
                Keine Value Streams.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function EpicTable({ rows }: { rows: LpmEpicRow[] }) {
  const sorted = [...rows].sort((a, b) => b.terminabweichungPis - a.terminabweichungPis);
  const deltaLabel = (d: number) => (d > 0 ? `+${d} PI` : d < 0 ? `${d} PI` : "0");
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
          <tr className="border-b">
            <th className="px-3 py-2 text-left font-medium">Epic</th>
            <th className="px-3 py-2 text-right font-medium">Benefit</th>
            <th className="px-3 py-2 text-left font-medium">Fortschritt (Ist/Soll)</th>
            <th className="px-3 py-2 text-right font-medium">Δ Termin</th>
            <th className="px-3 py-2 text-left font-medium">Entscheidung</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((e) => (
            <tr key={e.id} className="border-b last:border-0">
              <td className="px-3 py-2 font-medium">{e.title}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatMioEUR(e.benefitPlan)}</td>
              <td className="px-3 py-2">
                <div className="flex items-center gap-2">
                  <ProgressBar
                    actual={e.progressActual}
                    target={e.progressTarget}
                    tier={e.ampel}
                    className="w-28"
                  />
                  <span className="w-16 shrink-0 text-xs tabular-nums text-muted-foreground">
                    {pct(e.progressActual)} / {pct(e.progressTarget)}
                  </span>
                </div>
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                <span style={{ color: e.terminabweichungPis > 0 ? tierHex("rose") : undefined }}>
                  {deltaLabel(e.terminabweichungPis)}
                </span>
              </td>
              <td className="px-3 py-2">{e.entscheidung}</td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={5} className="px-3 py-6 text-center text-xs text-muted-foreground">
                Keine Epics.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
