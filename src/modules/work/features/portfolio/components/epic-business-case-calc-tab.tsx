"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, ChevronDown, Calculator } from "lucide-react";
import { STICKY_THEAD } from "@/components/ui/table-chrome";
import { Stat, StatStrip } from "@/components/ui/stat";
import { SectionLabel } from "@/components/ui/section-label";
import { EmptyState } from "@/components/ui/empty-state";
import { BreakEvenChart } from "@/components/charts/break-even-chart-lazy";
import { STAGE_GATE_LABELS } from "@/components/detail/initiative-labels";
import type {
  BcCalcDay,
  BcCalcMonth,
  BcCalcSummary,
} from "@/modules/work/domain/epic-bc-calculation";

interface Props {
  /** Tageszeilen — nur fuer den aufgeklappten Monat (`dayMonth`), sonst leer. */
  rows: BcCalcDay[];
  months: BcCalcMonth[];
  summary: BcCalcSummary;
  /** `yyyy-mm` des Monats, dessen Tage geladen wurden. */
  dayMonth?: string | undefined;
}

/**
 * Reifegrad-Chip je **Major-Gate**. `stage_gate` haelt nur L0..L5 — Unterstufen
 * (L3.1, L4.2) leben in `stage_gate_transitions` und koennen hier nicht
 * auftreten; `PHASE_GATE` ist entsprechend als `StageGate` typisiert.
 *
 * Jede Farbe traegt ihren `dark:`-Partner. Ohne ihn blieben die hellen
 * Fuellungen im Dunkelmodus als Flecken stehen — der dichteste Farbverstoss
 * der Seite, bevor dies hier stand.
 */
const GATE_CLASS: Record<string, string> = {
  L0: "bg-muted text-muted-foreground",
  L1: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  L2: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200",
  L3: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  L4: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  L5: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
};

const eur = (n: number): string =>
  Math.round(n).toLocaleString("de-DE", { maximumFractionDigits: 0 });
const eurShort = (n: number): string =>
  Math.abs(n) >= 1_000_000
    ? `${(n / 1_000_000).toLocaleString("de-DE", { maximumFractionDigits: 1 })} Mio`
    : Math.abs(n) >= 1_000
      ? `${Math.round(n / 1_000).toLocaleString("de-DE")} T`
      : `${Math.round(n)}`;
const dayLabel = (iso: string): string => iso.split("-").reverse().join(".");
const monthLabel = (ym: string): string => {
  const [y, m] = ym.split("-");
  return `${m}/${y}`;
};
const gateRange = (a: string, b: string): string => (a === b ? a : `${a}→${b}`);

function GateBadge({ gate }: { gate: string }) {
  const single = !gate.includes("→");
  return (
    <span
      className={`rounded-sm px-1.5 py-0.5 text-meta font-medium ${GATE_CLASS[gate] ?? "bg-muted text-muted-foreground"}`}
      title={single ? (STAGE_GATE_LABELS[gate] ?? gate) : gate}
    >
      {gate}
    </span>
  );
}

/**
 * „BC calculation" — Wirtschaftlichkeit ueber die Zeit.
 *
 * Drei Dinge unterscheiden diese Fassung von der vorigen:
 *
 * 1. **Eine Kurve.** `epicFlows` lief hier schon; sein Ergebnis stand aber nur
 *    als Spalte „Netto" in einer Tabelle. Break-even ist eine Aussage, die eine
 *    Kurve in einem Blick gibt.
 * 2. **Zwei Kostenbegriffe.** „Investition" war eine Zahl fuer zwei Dinge:
 *    sobald ein Budget alloziert ist, folgen die Kosten der Allocation und
 *    nicht mehr den Kostenscheiben — der Overview zeigte dann einen anderen
 *    Betrag fuer dasselbe Epic.
 * 3. **Die Tage kommen auf Abruf.** Vorher reisten alle Tageszeilen mit (fuer
 *    ein laufendes Epic ~1 675 Zeilen, 239 KB), obwohl die Tabelle zugeklappt
 *    oeffnet. Jetzt traegt das Payload Monate; der aufgeklappte Monat holt
 *    seine Tage ueber `?bcMonth=` nach.
 */
export function EpicBusinessCaseCalcTab({ rows, months, summary, dayMonth }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const openYears = useMemo(() => {
    const raw = params.get("bcYear");
    // Ohne Auswahl steht das Jahr des Break-even offen — die Zeile, wegen der
    // man diesen Reiter aufmacht.
    if (raw !== null) return new Set(raw ? raw.split(",") : []);
    const fallback = summary.breakEvenDay?.slice(0, 4) ?? months[0]?.month.slice(0, 4);
    return new Set(fallback ? [fallback] : []);
  }, [params, summary.breakEvenDay, months]);

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(params.toString());
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [params, pathname, router],
  );

  const byYear = useMemo(() => {
    const map = new Map<string, BcCalcMonth[]>();
    for (const m of months) {
      const y = m.month.slice(0, 4);
      const list = map.get(y) ?? [];
      list.push(m);
      map.set(y, list);
    }
    return map;
  }, [months]);

  const chartPoints = useMemo(
    () =>
      months.map((m) => ({
        month: m.month,
        cumCost: m.cumCost,
        cumBenefit: m.cumBenefit,
        isForecast: m.isForecast,
      })),
    [months],
  );

  const netClass = (n: number) =>
    n >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground";

  const nothingToShow =
    months.length === 0 ||
    (summary.estimatedCost === 0 &&
      summary.totalCost === 0 &&
      summary.recurringAnnualAtTarget === 0 &&
      summary.oneTimeAtTarget === 0);

  if (nothingToShow) {
    return (
      <EmptyState
        icon={<Calculator className="size-6" />}
        title="Noch nichts zu rechnen"
        body="Diese Auswertung braucht zwei Eingaben: Kostenscheiben im Business Case und mindestens eine KPI mit €-Wert je Einheit. Beides fehlt noch."
      />
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionLabel>Wirtschaftlichkeit über die Zeit</SectionLabel>
        {summary.hasAllocation ? (
          <span className="rounded-full border border-success/40 bg-success-surface px-2 py-0.5 text-meta font-medium text-success">
            Budget freigegeben — die Kurve rechnet mit der Allocation
          </span>
        ) : (
          <span className="rounded-full border border-dashed border-warning/40 bg-warning-surface px-2 py-0.5 text-meta font-medium text-warning">
            Kosten veranschlagt — die Kurve rechnet mit den Kostenscheiben
          </span>
        )}
      </div>

      {/* „Investition" war eine Zahl fuer zwei Begriffe — Veranschlagt und
          Zugeteilt stehen jetzt nebeneinander, mit denselben Worten wie im
          Overview. Und der Einmal-Nutzen wurde bisher berechnet, aber nie
          gerendert. */}
      <div className="space-y-2">
        <StatStrip className="flex-wrap">
          <Stat label="Veranschlagt" value={`${eurShort(summary.estimatedCost)} €`} />
          <Stat label="Zugeteilt" value={`${eurShort(summary.totalCost)} €`} />
          <Stat label="Nutzen p. a." value={`${eurShort(summary.recurringAnnualAtTarget)} €`} />
          <Stat
            label="Break-even"
            value={summary.breakEvenDay ? dayLabel(summary.breakEvenDay) : "—"}
          />
        </StatStrip>
        <StatStrip className="flex-wrap">
          <Stat label="Cost-Start" value={monthLabel(summary.costStart.slice(0, 7))} />
          <Stat label="Go-Live" value={monthLabel(summary.goLive.slice(0, 7))} />
          <Stat label="Einmalig" value={`${eurShort(summary.oneTimeAtTarget)} €`} />
          <Stat
            label="Nutzen ÷ Kosten"
            value={
              summary.benefitCostRatioPct != null
                ? `${Math.round(summary.benefitCostRatioPct)} %`
                : "—"
            }
          />
        </StatStrip>
      </div>

      <div className="rounded-lg bg-card p-4 shadow-card">
        <SectionLabel>Kosten, Nutzen und Break-even — kumuliert</SectionLabel>
        <BreakEvenChart
          points={chartPoints}
          breakEvenMonth={summary.breakEvenDay?.slice(0, 7) ?? null}
        />
      </div>

      <div className="max-h-[70vh] overflow-auto rounded-lg bg-card shadow-card">
        <table className="w-full min-w-[640px] border-collapse text-xs tabular-nums">
          <thead className={STICKY_THEAD}>
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
            {[...byYear.entries()].map(([year, ms]) => {
              const yOpen = openYears.has(year);
              const first = ms[0]!;
              const last = ms[ms.length - 1]!;
              return (
                <YearGroup
                  key={year}
                  year={year}
                  cost={ms.reduce((s, m) => s + m.cost, 0)}
                  benefit={ms.reduce((s, m) => s + m.benefit, 0)}
                  cumBenefit={last.cumBenefit}
                  cumCost={last.cumCost}
                  net={last.net}
                  gate={gateRange(first.gateFrom, last.gateTo)}
                  forecast={ms.every((m) => m.isForecast)}
                  open={yOpen}
                  onToggle={() =>
                    setParam(
                      "bcYear",
                      [...(yOpen ? [...openYears].filter((y) => y !== year) : [...openYears, year])]
                        .sort()
                        .join(","),
                    )
                  }
                  netClass={netClass}
                >
                  {yOpen &&
                    ms.map((m) => {
                      const mOpen = dayMonth === m.month;
                      return (
                        <MonthGroup
                          key={m.month}
                          month={m}
                          open={mOpen}
                          onToggle={() => setParam("bcMonth", mOpen ? null : m.month)}
                          netClass={netClass}
                        >
                          {mOpen &&
                            rows.map((r) => (
                              <tr
                                key={r.day}
                                className={`border-t ${r.isForecast ? "italic text-muted-foreground" : ""} ${
                                  summary.breakEvenDay === r.day
                                    ? "bg-emerald-50 dark:bg-emerald-950/40"
                                    : ""
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

      <p className="text-meta text-muted-foreground">
        ⓘ Das App-Modell rechnet intern monatlich — die Tageswerte sind der tagesgenaue Analog
        (Monats-Summe = Monatswert der App). „Ist" bis heute, danach Forecast (kursiv); die
        Benefit-Velocity füllt in der Zukunft auf die Zielrate auf. Ein Monat lädt seine Tage beim
        Aufklappen nach.
      </p>
    </section>
  );
}

function YearGroup({
  year,
  cost,
  benefit,
  cumBenefit,
  cumCost,
  net,
  gate,
  forecast,
  open,
  onToggle,
  netClass,
  children,
}: {
  year: string;
  cost: number;
  benefit: number;
  cumBenefit: number;
  cumCost: number;
  net: number;
  gate: string;
  forecast: boolean;
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
            {forecast && <span className="text-label text-muted-foreground">(Forecast)</span>}
          </button>
        </td>
        <td className="px-3 py-1.5">
          <GateBadge gate={gate} />
        </td>
        <td className="px-3 py-1.5 text-right">{eur(cost)}</td>
        <td className="px-3 py-1.5 text-right">{eur(benefit)}</td>
        <td className="px-3 py-1.5 text-right">{eur(cumBenefit)}</td>
        <td className="px-3 py-1.5 text-right">{eur(cumCost)}</td>
        <td className={`px-3 py-1.5 text-right ${netClass(net)}`}>{eur(net)}</td>
      </tr>
      {children}
    </>
  );
}

function MonthGroup({
  month,
  open,
  onToggle,
  netClass,
  children,
}: {
  month: BcCalcMonth;
  open: boolean;
  onToggle: () => void;
  netClass: (n: number) => string;
  children: React.ReactNode;
}) {
  return (
    <>
      <tr className={`border-t ${month.isForecast ? "text-muted-foreground" : ""}`}>
        <td className="py-1 pl-7 pr-3">
          <button type="button" onClick={onToggle} className="flex items-center gap-1.5">
            {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
            {monthLabel(month.month)}
          </button>
        </td>
        <td className="px-3 py-1">
          <GateBadge gate={gateRange(month.gateFrom, month.gateTo)} />
        </td>
        <td className="px-3 py-1 text-right">{eur(month.cost)}</td>
        <td className="px-3 py-1 text-right">{eur(month.benefit)}</td>
        <td className="px-3 py-1 text-right">{eur(month.cumBenefit)}</td>
        <td className="px-3 py-1 text-right">{eur(month.cumCost)}</td>
        <td className={`px-3 py-1 text-right ${netClass(month.net)}`}>{eur(month.net)}</td>
      </tr>
      {children}
    </>
  );
}
