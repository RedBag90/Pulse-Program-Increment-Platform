"use client";

import { useMemo, useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import type { BcCalcDay, BcCalcSummary } from "@/modules/work/domain/epic-bc-calculation";

interface Props {
  rows: BcCalcDay[];
  summary: BcCalcSummary;
}

const GATE_CLASS: Record<string, string> = {
  L0: "bg-muted text-muted-foreground",
  L1: "bg-sky-100 text-sky-800",
  L2: "bg-indigo-100 text-indigo-800",
  L3: "bg-amber-100 text-amber-800",
  L4: "bg-blue-100 text-blue-800",
  L5: "bg-emerald-100 text-emerald-800",
};

const eur = (n: number): string =>
  Math.round(n).toLocaleString("de-DE", { maximumFractionDigits: 0 });
const dayLabel = (iso: string): string => iso.split("-").reverse().join("."); // yyyy-mm-dd → dd.mm.yyyy
const monthLabel = (ym: string): string => {
  const [y, m] = ym.split("-");
  return `${m}/${y}`;
};

interface Agg {
  cost: number;
  benefit: number;
  gateFirst: string;
  gateLast: string;
  cumBenefit: number;
  cumCost: number;
  net: number;
  forecast: boolean;
}
function aggregate(rows: BcCalcDay[]): Agg {
  const last = rows[rows.length - 1]!;
  return {
    cost: rows.reduce((a, r) => a + r.costPerDay, 0),
    benefit: rows.reduce((a, r) => a + r.benefitPerDay, 0),
    gateFirst: rows[0]!.gate,
    gateLast: last.gate,
    cumBenefit: last.cumBenefit,
    cumCost: last.cumCost,
    net: last.net,
    forecast: rows.every((r) => r.isForecast),
  };
}
const gateRange = (a: string, b: string): string => (a === b ? a : `${a}→${b}`);

function GateBadge({ gate }: { gate: string }) {
  return (
    <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${GATE_CLASS[gate] ?? ""}`}>
      {gate}
    </span>
  );
}

/**
 * „Business case calculation" — die tagesgenaue Timeline-/Mehrwert-Kalkulation als
 * kollabierbare Baumtabelle (Jahr ▸ Monat ▸ Tag). Default: Monate sichtbar, Tage
 * zugeklappt. Aggregierte Zeilen summieren Kosten/Benefit der Periode; die
 * Monats-Summe entspricht dem nativen Monatswert der App.
 */
export function EpicBusinessCaseCalcTab({ rows, summary }: Props) {
  // Gruppierung Jahr → Monat → Tage.
  const tree = useMemo(() => {
    const byYear = new Map<string, Map<string, BcCalcDay[]>>();
    for (const r of rows) {
      const y = r.day.slice(0, 4);
      const ym = r.day.slice(0, 7);
      const months = byYear.get(y) ?? new Map<string, BcCalcDay[]>();
      const days = months.get(ym) ?? [];
      days.push(r);
      months.set(ym, days);
      byYear.set(y, months);
    }
    return byYear;
  }, [rows]);

  // Default: alle Jahre aufgeklappt (Monate sichtbar), Monate zugeklappt (Tage aus).
  const [openYears, setOpenYears] = useState<Set<string>>(() => new Set(tree.keys()));
  const [openMonths, setOpenMonths] = useState<Set<string>>(() => new Set());
  const toggle = (set: Set<string>, key: string): Set<string> => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  };

  const netClass = (n: number) => (n >= 0 ? "text-emerald-600" : "text-muted-foreground");

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-heading text-lg font-medium">Business case calculation</h2>
          {summary.hasAllocation ? (
            <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
              Budget freigegeben
            </span>
          ) : (
            <span className="rounded-full border border-dashed border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
              Kosten veranschlagt
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Tagesgenaue Kalkulation von Reifegrad, Benefit Velocity und Kostenverteilung. Aggregiert
          zu Monaten und Jahren — aufklappbar bis auf den Tag.
        </p>
      </div>

      {/* Summary */}
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          ["Cost-Start", monthLabel(summary.costStart.slice(0, 7))],
          ["Go-Live", monthLabel(summary.goLive.slice(0, 7))],
          ["Break-even", summary.breakEvenDay ? dayLabel(summary.breakEvenDay) : "—"],
          ["Investition", `${eur(summary.totalCost)} €`],
          ["Benefit @Ziel", `${eur(summary.recurringAnnualAtTarget)} €/J`],
          ["ROI (Jahr)", summary.roiPct != null ? `${Math.round(summary.roiPct)} %` : "—"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border bg-card p-2.5">
            <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
            <dd className="text-sm font-medium tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="max-h-[70vh] overflow-auto rounded-lg border">
        <table className="w-full border-collapse text-xs tabular-nums">
          <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur">
            <tr className="text-left text-muted-foreground">
              <th className="px-3 py-2 font-medium">Zeitraum</th>
              <th className="px-3 py-2 font-medium">Reifegrad</th>
              <th className="px-3 py-2 text-right font-medium">Kosten €</th>
              <th className="px-3 py-2 text-right font-medium">Benefit €</th>
              <th className="px-3 py-2 text-right font-medium">Σ Benefit</th>
              <th className="px-3 py-2 text-right font-medium">Σ Kosten</th>
              <th className="px-3 py-2 text-right font-medium">Netto</th>
            </tr>
          </thead>
          <tbody>
            {[...tree.entries()].map(([year, months]) => {
              const yAgg = aggregate([...months.values()].flat());
              const yOpen = openYears.has(year);
              return (
                <YearGroup
                  key={year}
                  year={year}
                  yAgg={yAgg}
                  open={yOpen}
                  onToggle={() => setOpenYears((s) => toggle(s, year))}
                  netClass={netClass}
                >
                  {yOpen &&
                    [...months.entries()].map(([ym, days]) => {
                      const mAgg = aggregate(days);
                      const mOpen = openMonths.has(ym);
                      return (
                        <MonthGroup
                          key={ym}
                          ym={ym}
                          mAgg={mAgg}
                          open={mOpen}
                          onToggle={() => setOpenMonths((s) => toggle(s, ym))}
                          netClass={netClass}
                        >
                          {mOpen &&
                            days.map((r) => (
                              <tr
                                key={r.day}
                                className={`border-t ${r.isForecast ? "text-muted-foreground italic" : ""} ${
                                  summary.breakEvenDay === r.day ? "bg-emerald-50" : ""
                                }`}
                              >
                                <td className="py-1 pl-12 pr-3">{dayLabel(r.day)}</td>
                                <td className="px-3 py-1">
                                  <GateBadge gate={r.gate} />
                                </td>
                                <td className="px-3 py-1 text-right">{eur(r.costPerDay)}</td>
                                <td className="px-3 py-1 text-right">{eur(r.benefitPerDay)}</td>
                                <td className="px-3 py-1 text-right">{eur(r.cumBenefit)}</td>
                                <td className="px-3 py-1 text-right">{eur(r.cumCost)}</td>
                                <td className={`px-3 py-1 text-right ${netClass(r.net)}`}>
                                  {eur(r.net)}
                                </td>
                              </tr>
                            ))}
                        </MonthGroup>
                      );
                    })}
                </YearGroup>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-muted-foreground">
        ⓘ Das App-Modell rechnet intern monatlich — die Tageswerte sind der tagesgenaue Analog
        (Monats-Summe = Monatswert der App). „Ist" bis heute, danach Forecast (kursiv); die
        Benefit-Velocity füllt in der Zukunft auf die Zielrate auf.
      </p>
    </section>
  );
}

function YearGroup({
  year,
  yAgg,
  open,
  onToggle,
  netClass,
  children,
}: {
  year: string;
  yAgg: Agg;
  open: boolean;
  onToggle: () => void;
  netClass: (n: number) => string;
  children: React.ReactNode;
}) {
  return (
    <>
      <tr className="border-t bg-muted/40 font-medium">
        <td className="px-3 py-1.5">
          <button type="button" onClick={onToggle} className="flex items-center gap-1.5">
            {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
            {year}
            {yAgg.forecast && <span className="text-[10px] text-muted-foreground">(Forecast)</span>}
          </button>
        </td>
        <td className="px-3 py-1.5">
          <GateBadge gate={gateRange(yAgg.gateFirst, yAgg.gateLast)} />
        </td>
        <td className="px-3 py-1.5 text-right">{eur(yAgg.cost)}</td>
        <td className="px-3 py-1.5 text-right">{eur(yAgg.benefit)}</td>
        <td className="px-3 py-1.5 text-right">{eur(yAgg.cumBenefit)}</td>
        <td className="px-3 py-1.5 text-right">{eur(yAgg.cumCost)}</td>
        <td className={`px-3 py-1.5 text-right ${netClass(yAgg.net)}`}>{eur(yAgg.net)}</td>
      </tr>
      {children}
    </>
  );
}

function MonthGroup({
  ym,
  mAgg,
  open,
  onToggle,
  netClass,
  children,
}: {
  ym: string;
  mAgg: Agg;
  open: boolean;
  onToggle: () => void;
  netClass: (n: number) => string;
  children: React.ReactNode;
}) {
  return (
    <>
      <tr className={`border-t ${mAgg.forecast ? "text-muted-foreground" : ""}`}>
        <td className="py-1 pl-7 pr-3">
          <button type="button" onClick={onToggle} className="flex items-center gap-1.5">
            {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
            {monthLabel(ym)}
          </button>
        </td>
        <td className="px-3 py-1">
          <GateBadge gate={gateRange(mAgg.gateFirst, mAgg.gateLast)} />
        </td>
        <td className="px-3 py-1 text-right">{eur(mAgg.cost)}</td>
        <td className="px-3 py-1 text-right">{eur(mAgg.benefit)}</td>
        <td className="px-3 py-1 text-right">{eur(mAgg.cumBenefit)}</td>
        <td className="px-3 py-1 text-right">{eur(mAgg.cumCost)}</td>
        <td className={`px-3 py-1 text-right ${netClass(mAgg.net)}`}>{eur(mAgg.net)}</td>
      </tr>
      {children}
    </>
  );
}
