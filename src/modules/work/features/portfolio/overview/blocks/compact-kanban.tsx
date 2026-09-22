"use client";

import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { ArrowRight, Flag } from "lucide-react";
import { SectionLabel } from "@/components/ui/section-label";
import { cn } from "@/lib/utils";
import {
  PORTFOLIO_COLUMNS,
  PORTFOLIO_COLUMN_LABELS,
} from "@/modules/work/features/portfolio/lib/epic-lifecycle";
import { HORIZON_LANES } from "@/modules/work/domain/portfolio-guardrails";
import type {
  PortfolioOverview,
  OverviewEpicCard,
  HorizonBudgetFigures,
  ClassFilterState,
} from "@/modules/work/server/views/portfolio-overview";
import {
  isClassShown,
  rollUpBySolution,
  type SolutionRollup,
} from "@/modules/work/domain/epic-class-filter";
import type { EpicClass } from "@/modules/work/domain/pb-submission";
import {
  RollupHint,
  rollupTone,
} from "@/modules/work/features/portfolio/overview/blocks/class-rollup";
import { COLUMN_ACTIVITY } from "@/modules/work/features/portfolio/overview/column-meta";
import { HorizonBadge } from "@/modules/core/org/features/solution/components/horizon-badge";
import { formatCompactEUR } from "@/lib/formatting";

/** „2026-H1" → „H1 2026" für die kompakte Zyklus-Caption. */
function cycleLabel(key: string | null): string {
  if (key == null) return "kein gültiger Rahmen";
  const m = /^(\d{4})-(H[12])$/.exec(key);
  return m ? `${m[2]} ${m[1]}` : key;
}

const CELL_LIMIT = 4;

/**
 * Read-only Portfolio-Kanban als **Matrix**: Zeilen = Investitionshorizonte
 * (H3→H2→H1→H0→Ohne, aus der Primär-Solution), Spalten = Stage Gates.
 * Editieren (Drag&Drop, Stage-Wechsel) lebt auf `/portfolio/epics`.
 *
 * **Die Spalten zeigen, wo gearbeitet wird** (`COLUMN_ACTIVITY`): Hypothese,
 * Business Case und Umsetzung stehen erhoben, Funnel und Investition treten
 * zurück — dort wartet das Epic auf eine fremde Entscheidung. Bis September 2026
 * trug das Board stattdessen die Soft-WIP-Grenzen als `38 / 5 ⚠`, und seine
 * einzige Farbe war damit ein Alarm. Die Grenzen selbst gibt es weiterhin; sie
 * werden von den Pipeline-Balken und den Top-Risiken gelesen, wo sie über einen
 * Engpass sprechen statt an jeder Spalte zu warnen.
 *
 * Bei aktiver Klassen-Facette steht die nicht gewählte Klasse je Zelle als
 * Sammelkarte unter den Karten. Die **Spaltenzähler bleiben davon unberührt**:
 * sie zählen weiter alle Epics der Spalte.
 */
export function CompactKanban({ data }: { data: PortfolioOverview }) {
  return (
    <section className="space-y-2" data-tour="portfolio-kanban">
      <div className="flex items-center justify-between">
        <SectionLabel>
          Epic Portfolio-Kanban{data.horizonOnOverview ? " · Horizonte" : ""}
        </SectionLabel>
        <Link
          href="/portfolio/epics"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          Im Editor öffnen <ArrowRight className="size-3" />
        </Link>
      </div>

      <RollupHint classFilter={data.classFilter} detail="die Spaltenzähler bleiben vollständig" />

      <div className="overflow-x-auto">
        <div
          className={cn(
            "grid min-w-[960px] gap-2",
            data.horizonOnOverview
              ? "grid-cols-[180px_repeat(6,minmax(140px,1fr))]"
              : "grid-cols-[repeat(6,minmax(140px,1fr))]",
          )}
        >
          {/* Kopfzeile: die Prozess-Spalten. Karten und Zaehler lesen seit dem
              Neuschnitt beide `epicsByColumn` — vorher kam der Zaehler von der
              Prozess-Achse und die Karte von der Reifegrad-Achse, und ein
              gesichtetes L0-Epic wurde unter „Hypothese" gezaehlt, waehrend es
              unter „Funnel" lag. */}
          {data.horizonOnOverview && (
            <div className="flex items-end">
              <span className="text-label uppercase tracking-[0.1em] text-muted-foreground">
                Budget · {cycleLabel(data.budgetCycleKey)}
              </span>
            </div>
          )}
          {PORTFOLIO_COLUMNS.map((col) => {
            const work = COLUMN_ACTIVITY[col] === "work";
            return (
              <div
                key={col}
                className={cn(
                  "flex items-baseline justify-between gap-1 rounded-md px-2 py-1.5",
                  work ? "border border-border/80 bg-card shadow-sm" : "border border-transparent",
                )}
                style={work ? WORK_TINT : undefined}
              >
                <span
                  className={cn(
                    "flex items-center gap-1.5 text-label font-semibold uppercase tracking-[0.1em]",
                    work ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {work && <span className="size-1.5 rounded-full bg-primary/70" />}
                  {PORTFOLIO_COLUMN_LABELS[col]}
                </span>
                <span className="font-mono text-label tabular-nums text-muted-foreground">
                  {data.epicsByColumn[col].length}
                </span>
              </div>
            );
          })}

          {/* Swimlanes — oder eine einzige Bahn, wenn die Horizont-Achse
              abgeschaltet ist. Dafuer braucht es keine neuen Daten:
              `epicsByColumn` traegt dieselben Karten ohne die Gliederung, und
              die Spaltenkoepfe oben zaehlen ohnehin schon daraus. */}
          {data.horizonOnOverview ? (
            HORIZON_LANES.map((lane) => <LaneRow key={lane} lane={lane} data={data} />)
          ) : (
            <FlatRow data={data} />
          )}
        </div>
      </div>
    </section>
  );
}

function LaneRow({ lane, data }: { lane: string; data: PortfolioOverview }) {
  const row = data.epicsByHorizonGate[lane as keyof typeof data.epicsByHorizonGate];
  const budget = data.horizonBudgets[lane as keyof typeof data.horizonBudgets];
  return (
    <>
      <div className="flex flex-col justify-center gap-1.5 py-1">
        <HorizonBadge horizon={lane === "none" ? null : lane} withHelp />
        {budget && budget.budgetiert > 0 && <HorizonBudget budget={budget} />}
      </div>
      {PORTFOLIO_COLUMNS.map((col) => (
        <KanbanCell
          key={col}
          lane={lane}
          epics={row[col]}
          classFilter={data.classFilter}
          work={COLUMN_ACTIVITY[col] === "work"}
        />
      ))}
    </>
  );
}

/**
 * Das Board ohne Horizont-Gliederung: eine Zeile, dieselben Karten.
 *
 * `epicsByColumn` ist hier die Quelle — nicht die Summe der Bahnen. Beides
 * ergaebe dieselben Epics, aber nur eine davon ist die Achse, die die
 * Spaltenkoepfe zaehlen; zwei Wege zur selben Zahl driften irgendwann.
 */
function FlatRow({ data }: { data: PortfolioOverview }) {
  return (
    <>
      {PORTFOLIO_COLUMNS.map((col) => (
        <KanbanCell
          key={col}
          // Kein Bahn-Grund: „none" waere die Bahn *ohne Horizont* und damit
          // eine Aussage ueber die Epics. Hier gibt es gar keine Bahnen.
          lane=""
          epics={data.epicsByColumn[col]}
          classFilter={data.classFilter}
          work={COLUMN_ACTIVITY[col] === "work"}
        />
      ))}
    </>
  );
}

/** Drei Budget-Werte des laufenden Zyklus unter dem Horizont-Badge. */
function HorizonBudget({ budget }: { budget: HorizonBudgetFigures }) {
  return (
    <div className="leading-tight">
      <p className="text-xs font-semibold tabular-nums" title="Budgetiert (laufender Zyklus)">
        {formatCompactEUR(budget.budgetiert)}
      </p>
      <p
        className="text-label tabular-nums text-muted-foreground"
        title="Davon in Umsetzung (Implementing / L4)"
      >
        ▸ Umsetzung {formatCompactEUR(budget.umsetzung)}
      </p>
      <p
        className="text-label tabular-nums text-muted-foreground"
        title="Davon umgesetzt (Done / L5)"
      >
        ✓ umgesetzt {formatCompactEUR(budget.umgesetzt)}
      </p>
    </div>
  );
}

/**
 * Der Grund einer Bahn — dieselbe Ordnung wie `HORIZON_BADGE_CLASS`.
 *
 * Sie stand bis September 2026 noch auf der alten Palette (Fuchsia, Violett,
 * Blau, Schiefer), waehrend die Badges daneben laengst violett, tuerkis, orange
 * und steingrau waren: eine Bahn trug zwei Farben.
 */
const LANE_TINT: Record<string, string> = {
  h3: "bg-violet-50/50 dark:bg-violet-950/20",
  h2: "bg-teal-50/50 dark:bg-teal-950/20",
  h1: "bg-orange-50/50 dark:bg-orange-950/20",
  h0: "bg-stone-100/60 dark:bg-stone-800/30",
  none: "bg-muted/40",
};

/**
 * **Die Spalten sagen, wo gearbeitet wird — ohne einen zweiten Farbkreis.**
 *
 * Die Bahnen tragen bereits die Horizont-Palette. Ein eigener Farbton fuer die
 * Spalten traete damit in Wettstreit, und das Board haette zwei Farbachsen, die
 * nichts miteinander zu tun haben. Die Unterscheidung laeuft deshalb ueber
 * Helligkeit und Gewicht: Arbeitsspalten stehen erhoben auf `bg-card` mit einem
 * Hauch Primaerton, Warteschlangen bleiben auf dem Seitengrund und treten
 * zurueck.
 *
 * Ueber `transparent` gemischt statt mit fester Deckkraft — so bleibt der Hauch
 * theme-fest, statt im dunklen Thema als heller Fleck stehenzubleiben.
 */
const WORK_TINT = { backgroundColor: "color-mix(in srgb, var(--primary) 6%, transparent)" };

function KanbanCell({
  lane,
  epics,
  classFilter,
  work,
}: {
  lane: string;
  epics: OverviewEpicCard[];
  classFilter: ClassFilterState;
  /** Arbeitsspalte statt Warteschlange — siehe `COLUMN_ACTIVITY`. */
  work: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = epics.filter((e) => isClassShown(e.epicClass, classFilter.selected));
  const rollups = rollUpBySolution(
    epics.filter((e) => !isClassShown(e.epicClass, classFilter.selected)),
  );
  const shown = expanded ? visible : visible.slice(0, CELL_LIMIT);
  return (
    <div
      className={cn(
        "min-h-[52px] rounded-md border p-1.5",
        // Der Grund gehoert der Bahn; die Spalte spricht nur ueber den Rahmen.
        work ? "border-border" : "border-border/40",
        LANE_TINT[lane] ?? "",
      )}
    >
      <ul className="space-y-1 text-xs">
        {shown.map((e) => (
          <KanbanCard key={e.id} epic={e} />
        ))}
        {rollups.map((r) => (
          <SolutionCard key={r.solutionId ?? "none"} rollup={r} cls={classFilter.hiddenClass} />
        ))}
      </ul>
      {visible.length > CELL_LIMIT && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 w-full text-center text-label text-muted-foreground hover:text-foreground"
        >
          {expanded ? "weniger" : `+ ${visible.length - CELL_LIMIT} weitere`}
        </button>
      )}
    </div>
  );
}

/**
 * Die zusammengefasste Klasse einer Zelle — eine Karte je Solution. Sie führt
 * auf die Solution, nicht auf ein Epic; „Ohne Solution" hat kein Ziel und
 * bleibt deshalb Text.
 */
function SolutionCard({ rollup, cls }: { rollup: SolutionRollup; cls: EpicClass | null }) {
  const body = (
    <>
      <span className="truncate font-medium leading-snug">{rollup.name}</span>
      <span className="ml-auto shrink-0 font-mono text-label tabular-nums">{rollup.count}</span>
    </>
  );
  return (
    <li
      className={cn(
        "flex items-center gap-2 rounded-md border border-dashed px-2 py-1",
        rollupTone(cls),
      )}
    >
      {rollup.solutionId ? (
        <Link
          href={`/structure/solution/${rollup.solutionId}`}
          className="flex min-w-0 flex-1 items-center gap-2 hover:underline"
        >
          {body}
        </Link>
      ) : (
        <span className="flex min-w-0 flex-1 items-center gap-2">{body}</span>
      )}
    </li>
  );
}

function KanbanCard({ epic }: { epic: OverviewEpicCard }) {
  return (
    <li
      className={cn(
        "rounded-md border bg-background px-2 py-1",
        epic.needsSteeringAttention &&
          "border-l-2 border-l-amber-400 bg-amber-50/60 dark:bg-amber-950/30",
      )}
    >
      <div className="flex items-center gap-1">
        {epic.needsSteeringAttention && (
          <Flag
            className="size-3 shrink-0 text-amber-600 dark:text-amber-400"
            aria-label="Steering"
          />
        )}
        <Link
          href={`/portfolio/epics/${epic.id}`}
          className="truncate font-medium leading-snug hover:text-primary"
        >
          {epic.title}
        </Link>
      </div>
      {epic.valueStream && (
        <p className="truncate text-label text-muted-foreground">{epic.valueStream.name}</p>
      )}
    </li>
  );
}
