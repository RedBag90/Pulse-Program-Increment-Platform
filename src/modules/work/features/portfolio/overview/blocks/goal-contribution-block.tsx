"use client";

import { useTranslations } from "next-intl";
import { useMemo, useRef, useState, useTransition } from "react";
import { Link } from "@/i18n/navigation";
import { Card } from "@/components/ui/card";
import { CollapsingToggle } from "@/components/ui/collapsing-toggle";
import { SectionLabel } from "@/components/ui/section-label";
import { STICKY_THEAD } from "@/components/ui/table-chrome";
import { TableMoreRow } from "@/components/ui/table-group-row";
import {
  benefitPerformance,
  totalContribution,
  type ContributionMode,
} from "@/modules/core/goals/domain/epic-contribution";
import type { UnitValue } from "@/modules/core/goals/server/views/epic-goal-contributions";
import type {
  ClassFilterState,
  ContributionRow,
} from "@/modules/work/server/views/portfolio-overview";
import {
  isClassShown,
  rollUpBySolution,
  type SolutionRollup,
} from "@/modules/work/domain/epic-class-filter";
import {
  CONTRIBUTION_VIEW_KEY,
  DEFAULT_ASC,
  type ContributionSortKey,
  type ContributionView,
} from "@/modules/work/domain/contribution-view-preference";
import { saveViewPreferenceAction } from "@/modules/core/kernel/features/actions/view-preference";
import {
  CONTRIBUTION_AXES,
  CONTRIBUTION_AXIS_COLUMNS,
  CONTRIBUTION_AXIS_KEYS,
  groupContributions,
  sumUnits,
  type ContributionAxis,
  type ContributionGroup,
} from "@/modules/work/domain/contribution-grouping";
import { HorizonBadge } from "@/modules/core/org/features/solution/components/horizon-badge";
import {
  rollupCellTone,
  rollupTone,
} from "@/modules/work/features/portfolio/overview/blocks/class-rollup";

/** Kompakte Zahl (Muster aus der früheren Funding-Kachel), ohne Einheit. */
function compact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${Math.round(n / 1_000)}k`;
  return `${Math.round(n)}`;
}

/** Wert mit dem Einheiten-Label des Top-Ziels (€, %, Stück, …). */
function fmt(unit: string | null, n: number): string {
  return unit ? `${compact(n)} ${unit}` : compact(n);
}

/**
 * Wie viele Zeilen die Kachel zeigt, bevor „+ n weitere zeigen" uebernimmt.
 *
 * Sechs, damit die Tabelle so hoch steht wie die uebrigen Kacheln der
 * Uebersicht. Vorher lief sie bis an ihren 384-px-Deckel und man scrollte in der
 * Karte, ohne zu wissen, wie viel noch kommt. Die Gesamtzahl steht im
 * Kartenkopf — sie ist der Grund, warum man aufklappt.
 */
const COLLAPSED_LIMIT = 6;

/** Welcher der beiden Werte gerade die Reihenfolge macht — `null` bei Abweichung. */
type Emphasis = ContributionMode | null;

/**
 * Beitragswerte einer Effektart — je Einheit eine Zeile, **beide Werte**.
 *
 * Bis September 2026 zeigte die Zelle nur einen der beiden (`v[mode]`), und der
 * Umschalter bestimmte damit Anzeige und Sortierung zugleich: wer Plan und Ist
 * vergleichen wollte, musste hin- und herschalten und sich die Zahl merken.
 *
 * **Inhalt und Ort sind fest, nur die Gewichtung wandert.** Beide Werte stehen
 * immer da, immer in derselben Reihenfolge — sonst spränge beim Umschalten eine
 * Zahl. Fett steht der, nach dem sortiert wird; ohne das wäre die Liste nach
 * einer Zahl geordnet, die im Bild zurücktritt.
 *
 * Beide tragen ihr Wort. Trüge nur das Ist eines, führte bei Sortierung nach Ist
 * eine kleine graue Zahl ohne Wort die Zeile an.
 *
 * „—" heißt „kein Beitrag berechnet"; ein Ist von 0 rendert als „0 €", sonst
 * wäre das nicht von „noch nichts realisiert" zu unterscheiden.
 */
function ValueCell({ values, emphasis }: { values: readonly UnitValue[]; emphasis: Emphasis }) {
  if (values.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }
  const cls = (which: ContributionMode) =>
    emphasis === which ? "font-medium" : "text-label text-muted-foreground";
  return (
    <div className="space-y-0.5 tabular-nums">
      {values.map((v, i) => (
        <div key={v.unit ?? `u${i}`}>
          <span className={cls("planned")}>Plan {fmt(v.unit, v.planned)}</span>{" "}
          <span className={cls("realized")}>· Ist {fmt(v.unit, v.realized)}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Übertrifft die Zeile ihren Plan?
 *
 * **Nur ab L4.2.** Der realisierte Nutzen wächst über die Zeit; ein Epic mitten
 * in der Umsetzung hat den Plan noch gar nicht erreichen können. Ohne diese
 * Schranke stünde bei fast jeder Zeile dasselbe Zeichen — und ein Indikator,
 * der immer dasselbe sagt, sagt nichts.
 *
 * In einer Summenzeile gilt dasselbe, nur schärfer: dort kommen Plan und Ist
 * **allein aus den bewertbaren** Epics der Gruppe, und `hint` sagt, wie viele
 * das waren. Ein Prozentwert ohne diese Angabe behauptete etwas über einen
 * ganzen Wertstrom, während er neun seiner einundsechzig Epics beschreibt.
 */
function PerformanceCell({
  planned,
  realized,
  assessable,
  hint,
  emphasised,
}: {
  planned: number;
  realized: number;
  assessable: boolean;
  hint?: string;
  emphasised: boolean;
}) {
  const t = useTranslations();
  const perf = assessable ? benefitPerformance({ planned, realized }) : null;
  if (perf == null) {
    // Der Strich einer Summenzeile bekommt seinen Grund gleich mit: „0 von 6
    // bewertbar" ist eine Auskunft, ein blosser Strich eine Leerstelle.
    return (
      <span className="block text-muted-foreground" title={t("work.overview.erstAbLBewertbar")}>
        —{hint && <span className="block text-label">{hint}</span>}
      </span>
    );
  }
  // Unter einem halben Prozent stünde sonst „−0 %" — ein Zeichen ohne Zahl.
  const abs = Math.abs(perf.delta) * 100;
  const pct = `${perf.delta > 0 ? "+" : "−"}${abs.toFixed(abs < 0.5 ? 1 : 0).replace(".", ",")} %`;
  const look = {
    over: { sign: "↗", cls: "text-emerald-600 dark:text-emerald-400" },
    under: { sign: "↘", cls: "text-rose-600 dark:text-rose-400" },
    on: { sign: "→", cls: "text-muted-foreground" },
  }[perf.state];
  return (
    <span className="block">
      <span
        className={`whitespace-nowrap tabular-nums ${look.cls} ${emphasised ? "font-medium" : ""}`}
      >
        {look.sign} {perf.state === "on" ? "wie geplant" : pct}
      </span>
      {hint && <span className="block text-label text-muted-foreground">{hint}</span>}
    </span>
  );
}

/** Die Abweichung einer Zeile — dieselbe einheitenblinde Summe, die auch sortiert. */
function rowPerformance(row: ContributionRow) {
  return benefitPerformance({
    planned: totalContribution(row, "planned"),
    realized: totalContribution(row, "realized"),
  });
}

/** Wertstrom oben, Solution darunter — sechsmal „Produktion" sagt für sich nichts. */
function StreamCell({ row }: { row: ContributionRow }) {
  if (row.valueStreamName == null && row.solution == null) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <div className="min-w-0">
      <div className="truncate text-muted-foreground">{row.valueStreamName ?? "—"}</div>
      {row.solution && (
        <div className="truncate text-label text-muted-foreground/80">{row.solution.name}</div>
      )}
    </div>
  );
}

/**
 * Die zusammengefasste Klasse — eine Zeile je Solution. Kein Link auf ein Epic,
 * weil sie keines ist; der eingefärbte Grund sagt, dass hier gebündelt wurde.
 *
 * Sie steht in **beiden** Ansichten: sie sagt, was der Klassenfilter ausblendet,
 * und das hängt nicht daran, wie die sichtbaren Zeilen gruppiert sind. Nur ihre
 * Spalten folgen der Tabelle darüber.
 */
function SolutionRow({
  rollup,
  classFilter,
  emphasis,
  grouped,
}: {
  rollup: { group: SolutionRollup; recurring: UnitValue[]; oneTime: UnitValue[] };
  classFilter: ClassFilterState;
  emphasis: Emphasis;
  grouped: boolean;
}) {
  const t = useTranslations();
  const tone = rollupCellTone(classFilter.hiddenClass);
  return (
    <tr className="border-b last:border-0">
      <td className={`px-3 py-2 font-medium ${tone}`}>
        {rollup.group.name}
        <span className="ml-2 font-mono text-label font-normal opacity-80">
          {rollup.group.count} zusammengefasst
        </span>
      </td>
      {grouped ? (
        <td className={`px-3 py-2 text-right tabular-nums ${tone}`}>{rollup.group.count}</td>
      ) : (
        <>
          <td className={`px-3 py-2 ${tone}`} />
          <td className={`px-3 py-2 text-label ${tone}`}>
            {classFilter.hiddenLabelKey && t(classFilter.hiddenLabelKey)}
          </td>
        </>
      )}
      <td className={`px-3 py-2 text-right ${tone}`}>
        <ValueCell values={rollup.recurring} emphasis={emphasis} />
      </td>
      <td className={`px-3 py-2 text-right ${tone}`}>
        <ValueCell values={rollup.oneTime} emphasis={emphasis} />
      </td>
      <td className={`px-3 py-2 text-right ${tone}`} />
    </tr>
  );
}

/**
 * Wonach die Liste geordnet ist — **nicht** dasselbe wie „welcher Wert".
 *
 * `ContributionMode` beantwortet die zweite Frage und bleibt, wie er ist;
 * `totalContribution` nimmt weiterhin nur ihn entgegen. „Abweichung" ist keine
 * dritte Zahl, sondern ein Verhältnis der beiden.
 */
type SortKey = ContributionSortKey;

const SORT_LABEL: Record<SortKey, string> = {
  planned: "Plan",
  realized: "Ist",
  deviation: "Abweichung",
};

/** Die Abweichung einer Summenzeile — aus den Beträgen, nie aus Prozentwerten. */
function groupPerformance(g: ContributionGroup) {
  return g.assessable.count === 0
    ? null
    : benefitPerformance({ planned: g.assessable.planned, realized: g.assessable.realized });
}

/**
 * „Epic-Beitrag zu Kopf-Zielen" — der berechnete Nutzen-Beitrag an die
 * Top-Ziele (KPI × Conversion die Ziel-Kette hoch), getrennt nach
 * wiederkehrendem und einmaligem Effekt.
 *
 * **Zwei Schalter, eine Kachel je Schalter.** Der eine fasst die Zeilen entlang
 * der Struktur zusammen — aus 128 Epic-Zeilen werden drei Wertströme —, der
 * andere sortiert. Beide zeigen zugeklappt nur, was gerade gilt: zwei volle
 * Optionsreihen nebeneinander wären eine Kopfleiste, in der elf Wörter stehen
 * und zwei davon zählen.
 *
 * Der Sortier-Umschalter **sortiert nur**. Beide Werte stehen ohnehin in jeder
 * Zelle; würde er auch die Anzeige drehen, wäre der Vergleich ein Merkspiel.
 */
export function GoalContributionBlock({
  rows,
  classFilter,
  initialView,
}: {
  rows: ContributionRow[];
  classFilter: ClassFilterState;
  /**
   * Die gespeicherte Stellung beider Schalter, vom Loader geparst. Kommt
   * server-seitig an, damit die Tabelle nicht erst in der Voreinstellung
   * erscheint und dann sichtbar umsortiert — genau das waere der Preis eines
   * `localStorage`-Hakens, der erst nach dem Mount laedt.
   */
  initialView: ContributionView;
}) {
  const t = useTranslations();
  const [axis, setAxis] = useState<ContributionAxis>(initialView.axis);
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({
    key: initialView.sortKey,
    asc: initialView.asc,
  });
  const emphasis: Emphasis = sort.key === "deviation" ? null : sort.key;
  const grouped = axis !== "epic";

  /**
   * **Merken, ohne die Seite anzuhalten.** Der lokale Zustand bleibt die
   * Wahrheit der laufenden Sitzung; die Zeile in `view_preferences` wird
   * hinterhergeschrieben und wirkt beim naechsten Oeffnen.
   *
   * Ein Fehlschlag bleibt absichtlich stumm: die Tabelle steht dann so da, wie
   * der Nutzer sie eben eingestellt hat, und nur die Erinnerung daran fehlt. Eine
   * Fehlermeldung ueber der Kachel waere mehr Stoerung als der Verlust wert.
   */
  const [, startTransition] = useTransition();
  const remember = (next: ContributionView) => {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("key", CONTRIBUTION_VIEW_KEY);
      fd.set("value", JSON.stringify(next));
      await saveViewPreferenceAction({}, fd);
    });
  };

  const pickAxis = (next: ContributionAxis) => {
    setAxis(next);
    // Eine neue Achse ist eine neue Liste: „je Epic" hat 128 Zeilen, „Wertstrom"
    // drei. Aufgeklappt zu bleiben hiesse, den Knopf ohne Wirkung stehen zu
    // lassen. Beim Sortieren bleibt der Zustand — dort tauschen dieselben Zeilen
    // nur die Reihenfolge.
    setExpanded(false);
    setFrozenHeight(null);
    remember({ axis: next, sortKey: sort.key, asc: sort.asc });
  };

  // Ein erneutes Antippen der aktiven Option dreht die Richtung; eine andere
  // setzt sie auf deren interessante Seite. `CollapsingToggle` meldet jede Wahl,
  // auch die auf die aktive Option — genau dafür.
  //
  // Der naechste Zustand wird **ausserhalb** von `setSort` gerechnet, nicht im
  // Updater: React ruft Updater im Strict Mode doppelt auf, und das Schreiben
  // liefe dann zweimal.
  const pickSort = (key: SortKey) => {
    const next = sort.key === key ? { key, asc: !sort.asc } : { key, asc: DEFAULT_ASC[key] };
    setSort(next);
    remember({ axis, sortKey: next.key, asc: next.asc });
  };

  const sortOptions = (["planned", "realized", "deviation"] as const).map((key) => ({
    id: key,
    label: sort.key === key ? `${SORT_LABEL[key]} ${sort.asc ? "↑" : "↓"}` : SORT_LABEL[key],
    srLabel: `${SORT_LABEL[key]}, ${sort.asc ? "aufsteigend" : "absteigend"}`,
  }));

  const axisOptions = CONTRIBUTION_AXES.map((id) => ({
    id,
    label: t(CONTRIBUTION_AXIS_KEYS[id] ?? id),
  }));

  const visible = useMemo(
    () => rows.filter((r) => isClassShown(r.epicClass, classFilter.selected)),
    [rows, classFilter.selected],
  );
  // Zusammengefasst wird je Solution und **je Einheit** — dieselbe Regel, nach
  // der ein einzelnes Epic seine Beiträge schon bündelt. Über Einheiten hinweg
  // zu addieren hieße, € und Stück in eine Zahl zu werfen.
  const rollups = useMemo(() => {
    const hidden = rows.filter((r) => !isClassShown(r.epicClass, classFilter.selected));
    const byKey = new Map<string, ContributionRow[]>();
    for (const r of hidden) {
      const key = r.solution?.id ?? "";
      byKey.set(key, [...(byKey.get(key) ?? []), r]);
    }
    return rollUpBySolution(hidden).map((group) => ({
      group,
      recurring: sumUnits((byKey.get(group.solutionId ?? "") ?? []).map((r) => r.recurring)),
      oneTime: sumUnits((byKey.get(group.solutionId ?? "") ?? []).map((r) => r.oneTime)),
    }));
  }, [rows, classFilter.selected]);

  // Dieselbe Formel wie der Server (`totalContribution`), nur hier auch fuer Ist
  // und fuer die Abweichung. **Nicht bewertbare Zeilen stehen hinten**, in beiden
  // Richtungen: sie haben keine Abweichung, und sie ans andere Ende zu werfen
  // waere eine Aussage ueber sie, die es nicht gibt.
  const sorted = useMemo(() => {
    const dir = sort.asc ? 1 : -1;
    if (sort.key !== "deviation") {
      const key = sort.key;
      return [...visible].sort(
        (a, b) => (totalContribution(a, key) - totalContribution(b, key)) * dir,
      );
    }
    const deviationOf = (r: ContributionRow) =>
      r.benefitAssessable ? (rowPerformance(r)?.delta ?? null) : null;
    return [...visible].sort((a, b) => {
      const da = deviationOf(a);
      const db = deviationOf(b);
      if (da == null) return db == null ? 0 : 1;
      if (db == null) return -1;
      return (da - db) * dir;
    });
  }, [visible, sort]);

  const groups = useMemo(() => {
    if (!grouped) return [];
    const dir = sort.asc ? 1 : -1;
    const list = groupContributions(visible, axis);
    if (sort.key !== "deviation") {
      const key = sort.key;
      return list.sort((a, b) => (totalContribution(a, key) - totalContribution(b, key)) * dir);
    }
    return list.sort((a, b) => {
      const da = groupPerformance(a)?.delta ?? null;
      const db = groupPerformance(b)?.delta ?? null;
      if (da == null) return db == null ? 0 : 1;
      if (db == null) return -1;
      return (da - db) * dir;
    });
  }, [visible, axis, grouped, sort]);

  /**
   * **Gekappt auf sechs Zeilen, der Rest auf Knopfdruck.** Der Knopf zeigt
   * **alles** statt in Schritten nachzuladen wie die Issue-Tabelle: bei 128
   * Zeilen waeren das einundzwanzig Klicks.
   *
   * **Beim Aufklappen wird die Hoehe eingefroren, nicht gedeckelt.** Ein
   * `max-height` reicht nicht: zugeklappt liegt die Tabelle **unter** dem
   * Deckel, aufgeklappt waechst sie bis an ihn heran, und die Karte springt.
   *
   * Gemessen statt gerechnet: die Zeilen sind hier verschieden hoch — eine
   * Wertzelle mit zwei Einheiten traegt zwei Zeilen, eine mit einer nur eine.
   * Eine Formel darueber waere geraten. `offsetHeight` im Moment des Klicks ist
   * die Hoehe, die dort **tatsaechlich** steht.
   */
  const boxRef = useRef<HTMLDivElement>(null);
  const [frozenHeight, setFrozenHeight] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const aufklappen = () => {
    // **Nur einfrieren, wenn wirklich gemessen wurde.** Eine 0 als Hoehe waere
    // eine leere Karte — schlimmer als die springende, die wir loswerden
    // wollen. Ohne Messung waechst sie eben, wie vorher.
    const gemessen = boxRef.current?.offsetHeight ?? 0;
    setFrozenHeight(gemessen > 0 ? gemessen : null);
    setExpanded(true);
  };
  const alleZeilen = grouped ? groups.length : sorted.length;
  const limit = expanded ? alleZeilen : COLLAPSED_LIMIT;
  const restCount = Math.max(0, alleZeilen - limit);

  const shownCount = alleZeilen + rollups.length;
  const columnCount = grouped ? 5 : 6;

  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <SectionLabel>{t("work.overview.epicBeitragZuKopf")}</SectionLabel>
        <div className="flex shrink-0 items-center gap-2">
          <CollapsingToggle
            value={axis}
            options={axisOptions}
            onSelect={pickAxis}
            label={t("work.overview.zusammenfassenNach")}
            className="text-meta"
          />
          <CollapsingToggle
            value={sort.key}
            options={sortOptions}
            onSelect={pickSort}
            label={t("work.overview.sortiertNach")}
            className="text-meta"
          />
          {shownCount > 0 && (
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {shownCount}
            </span>
          )}
        </div>
      </div>

      {shownCount === 0 ? (
        <p className="text-sm text-muted-foreground">
          Noch keine Epic-Ziel-Beiträge berechnet.{" "}
          <Link href="/ziele" className="text-primary hover:underline">
            {t("work.overview.zieleVerknuepfen")}
          </Link>
        </p>
      ) : (
        <div
          ref={boxRef}
          className="overflow-y-auto rounded-lg bg-card shadow-card"
          {...(frozenHeight != null ? { style: { height: frozenHeight } } : {})}
        >
          <table className="w-full border-collapse text-xs">
            <thead className={STICKY_THEAD}>
              <tr>
                <th className="px-3 py-2 text-left font-medium">
                  {CONTRIBUTION_AXIS_COLUMNS[axis]}
                </th>
                {grouped ? (
                  // Horizont und Solution sind Eigenschaften **eines** Epics und
                  // haben in einer Summenzeile nichts zu suchen; an ihrer Stelle
                  // steht, aus wie vielen Epics die Summe kommt.
                  <th className="px-3 py-2 text-right font-medium">{t("work.overview.epics")}</th>
                ) : (
                  <>
                    <th className="px-3 py-2 text-left font-medium">
                      {t("work.overview.horizont")}
                    </th>
                    <th className="px-3 py-2 text-left font-medium">
                      {t("work.overview.wertstrom")}
                      <span className="block font-normal normal-case">
                        {t("work.overview.solution")}
                      </span>
                    </th>
                  </>
                )}
                <th className="px-3 py-2 text-right font-medium">
                  {t("work.overview.wiederkehrend")}
                  <span className="block font-normal normal-case">
                    {t("work.overview.proJahr")}
                  </span>
                </th>
                <th className="px-3 py-2 text-right font-medium">{t("work.overview.einmalig")}</th>
                <th className="px-3 py-2 text-right font-medium">
                  {t("work.overview.istVsPlan")}
                  <span className="block font-normal normal-case">ab L4.2</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {grouped
                ? groups.slice(0, limit).map((g) => (
                    <tr key={g.key || "ohne"} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="px-3 py-2 font-medium">{g.label}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{g.epicCount}</td>
                      <td className="px-3 py-2 text-right">
                        <ValueCell values={g.recurring} emphasis={emphasis} />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <ValueCell values={g.oneTime} emphasis={emphasis} />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <PerformanceCell
                          planned={g.assessable.planned}
                          realized={g.assessable.realized}
                          assessable={g.assessable.count > 0}
                          hint={`${g.assessable.count} von ${g.epicCount} bewertbar`}
                          emphasised={sort.key === "deviation"}
                        />
                      </td>
                    </tr>
                  ))
                : sorted.slice(0, limit).map((r) => (
                    <tr key={r.epicId} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="px-3 py-2">
                        <Link
                          href={`/portfolio/epics/${r.epicId}`}
                          className="font-medium hover:text-primary hover:underline"
                        >
                          {r.title}
                        </Link>
                      </td>
                      <td className="px-3 py-2">
                        <HorizonBadge horizon={r.horizon} short />
                      </td>
                      <td className="max-w-[14rem] px-3 py-2">
                        <StreamCell row={r} />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <ValueCell values={r.recurring} emphasis={emphasis} />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <ValueCell values={r.oneTime} emphasis={emphasis} />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <PerformanceCell
                          planned={totalContribution(r, "planned")}
                          realized={totalContribution(r, "realized")}
                          assessable={r.benefitAssessable}
                          emphasised={sort.key === "deviation"}
                        />
                      </td>
                    </tr>
                  ))}
              {restCount > 0 && (
                <TableMoreRow remaining={restCount} colSpan={columnCount} onMore={aufklappen} />
              )}
            </tbody>

            {/* Die Zusammenfassung bekommt einen **eigenen Abschnitt**. Vorher
                hingen ihre Zeilen im selben Rumpf hinter den Epics — man musste
                scrollen und merkte den Wechsel kaum. Die Erklaerzeile, die
                frueher ueber der Tabelle stand, sitzt jetzt hier, wo sie gilt. */}
            {rollups.length > 0 && (
              <tbody>
                <tr className="border-y bg-muted/40">
                  <th
                    colSpan={columnCount}
                    className="px-3 py-1.5 text-left text-label font-semibold uppercase tracking-[0.1em] text-muted-foreground"
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className={`inline-block size-2 shrink-0 rounded-[2px] border ${rollupTone(classFilter.hiddenClass)}`}
                      />
                      {classFilter.hiddenLabelKey && t(classFilter.hiddenLabelKey)}{" "}
                      {t("work.overview.rollupPerUnit")}
                    </span>
                  </th>
                </tr>
                {rollups.map((r) => (
                  <SolutionRow
                    key={r.group.solutionId ?? "none"}
                    rollup={r}
                    classFilter={classFilter}
                    emphasis={emphasis}
                    grouped={grouped}
                  />
                ))}
              </tbody>
            )}
          </table>
        </div>
      )}
    </Card>
  );
}
