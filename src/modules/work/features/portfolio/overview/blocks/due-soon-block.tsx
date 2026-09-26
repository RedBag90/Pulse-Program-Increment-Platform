import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Clock, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { SectionLabel } from "@/components/ui/section-label";
import type { ClassFilterState, DueSoonItem } from "@/modules/work/server/views/portfolio-overview";
import { isClassShown, rollUpBySolution } from "@/modules/work/domain/epic-class-filter";
import {
  RollupHint,
  rollupTone,
} from "@/modules/work/features/portfolio/overview/blocks/class-rollup";

/** ISO yyyy-mm-dd → "dd.MM." */
function shortDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}.${m}.`;
}

/** Signed days-until → relatives Label aus dem Katalog. */
function relative(daysUntil: number, t: ReturnType<typeof useTranslations>): string {
  if (daysUntil < 0) return t("work.overview.dueOverdueDays", { days: Math.abs(daysUntil) });
  if (daysUntil === 0) return t("work.overview.dueToday");
  if (daysUntil === 1) return t("work.overview.dueTomorrow");
  return t("work.overview.dueInDays", { days: daysUntil });
}

/**
 * Wie viele Eintraege die Karte zeigt, bevor der Rest aufklappt.
 *
 * Sechs, weil zwei dieser Karten nebeneinander stehen und die Zeile dazwischen
 * nicht laenger werden soll als das, was darueber und darunter liegt. Die
 * Gesamtzahl steht im Kartenkopf — sie ist der Grund, warum man aufklappt.
 */
const COLLAPSED_LIMIT = 6;

/**
 * **Die Hoehe des Kastens, wenn es etwas aufzuklappen gibt — fest, nicht
 * gedeckelt.**
 *
 * Ein `max-height` reicht nicht: zugeklappt liegt die Karte **unter** dem
 * Deckel, aufgeklappt waechst sie bis an ihn heran. Genau das war zu sehen —
 * die eine Karte stand hoeher als die andere, sobald man sie oeffnete. Eine
 * feste Hoehe ist zugeklappt und aufgeklappt dieselbe; die Karte kann nicht
 * springen.
 *
 * Die Rechnung steht hier, statt als geratene Pixelzahl dazustehen, und haengt
 * an `COLLAPSED_LIMIT`:
 *
 *   6 Zeilen à 2rem  +  5 Abstaende à 0.5rem  +  1.5rem fuer den Aufklapper
 *
 * `2rem` ist eine Zeile mit Untertitel (zwei Mal `text-xs`, je 1rem
 * Zeilenhoehe); Titel und Untertitel sind beide `truncate`, brechen also nie um.
 * Eine Zeile **ohne** Untertitel ist halb so hoch — dann bleibt unten etwas
 * Luft. Das ist der Preis dafuer, dass die Karte stillsteht, und er ist der
 * kleinere.
 */
const BOX_HEIGHT = `calc(${COLLAPSED_LIMIT} * 2rem + ${COLLAPSED_LIMIT - 1} * 0.5rem + 1.5rem)`;

/**
 * Generic "fällig"-Liste for the Portfolio-Übersicht — a Card of work landing
 * soon (or overdue), sorted soonest/most-overdue first. Overdue rows read red.
 * Used twice: Epics (L4-Abschluss, `hrefBase="/portfolio/epics"`) and Features
 * (`hrefBase="/feature"`, each row also linking its parent Epic). Server-only.
 *
 * Bei aktiver Klassen-Facette steht die nicht gewählte Klasse darunter, je
 * Solution zu einer Zeile gefasst. Dort steht **nur die Anzahl**: eine
 * gemittelte Überfälligkeit über sechs Epics wäre eine Zahl, die für kein
 * einziges gilt.
 *
 * **Gekappt auf `COLLAPSED_LIMIT`, der Rest in einem `<details>`.** Bewusst
 * **kein** `useState`-Knopf: der machte die Datei zur Client-Komponente und
 * zoege das ganze DTO in den Browser — dieselbe Begruendung wie in
 * `risks-block.tsx`, und `<details>` ist ohnehin das Muster, das im Haus schon
 * mehrfach steht.
 *
 * Der Aufklapper steht **im** Scrollkasten. Aufgeklappt waechst die Liste dort
 * hinein statt die Seite zu verlaengern — sonst spraenge das zweispaltige
 * Raster bei jedem Klick, weil die Nachbarkarte mitwandert.
 *
 * **Die Sammelzeilen stehen ausserhalb des Kastens.** Sie werden weder gekappt
 * noch weggescrollt: sie stehen fuer Arbeit, die die Facette ohnehin schon
 * versteckt, und sie ein zweites Mal zu verbergen waere dieselbe Auskunft
 * zweimal verweigert. Sie sind zudem wenige — eine je Solution —, und ihre Zahl
 * aendert sich beim Aufklappen nicht, die Karte springt also nicht.
 */
export function DueSoonBlock({
  label,
  items,
  hrefBase,
  emptyText,
  classFilter,
}: {
  label: string;
  items: DueSoonItem[];
  hrefBase: string;
  emptyText: string;
  classFilter: ClassFilterState;
}) {
  const t = useTranslations();
  const visible = items.filter((i) => isClassShown(i.epicClass, classFilter.selected));
  const rollups = rollUpBySolution(
    items
      .filter((i) => !isClassShown(i.epicClass, classFilter.selected))
      .map((i) => ({ solution: i.solution, overdue: i.overdue })),
  );
  const shown = visible.slice(0, COLLAPSED_LIMIT);
  const rest = visible.slice(COLLAPSED_LIMIT);

  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <SectionLabel>{label}</SectionLabel>
        {visible.length + rollups.length > 0 && (
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {visible.length + rollups.length}
          </span>
        )}
      </div>

      <RollupHint classFilter={classFilter} detail="nur die Anzahl, ohne Fristen" />

      {visible.length === 0 && rollups.length === 0 && (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      )}

      {visible.length > 0 && (
        /* Aufgeklappt waechst die Liste **in** den Kasten, nicht darueber
           hinaus — und der Kasten hat eine feste Hoehe, sobald es etwas
           aufzuklappen gibt. Gibt es nichts, richtet er sich nach dem Inhalt:
           eine Karte mit zwei Zeilen soll nicht kuenstlich hoch stehen. */
        <div
          className="space-y-2 overflow-y-auto"
          {...(rest.length > 0 ? { style: { height: BOX_HEIGHT } } : {})}
        >
          <ul className="space-y-2">
            {shown.map((it) => (
              <DueSoonRow key={it.id} item={it} hrefBase={hrefBase} />
            ))}
          </ul>
          {rest.length > 0 && (
            <details className="text-label text-muted-foreground">
              <summary className="cursor-pointer select-none hover:text-foreground">
                {t("work.overview.moreCount", { count: rest.length })}
              </summary>
              <ul className="mt-2 space-y-2">
                {rest.map((it) => (
                  <DueSoonRow key={it.id} item={it} hrefBase={hrefBase} />
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {rollups.length > 0 && (
        <ul className="space-y-2">
          {rollups.map((r) => (
            <li
              key={r.solutionId ?? "none"}
              className={`flex items-center gap-2 rounded-md border border-dashed px-2.5 py-1.5 ${rollupTone(
                classFilter.hiddenClass,
              )}`}
            >
              <span className="min-w-0 flex-1 truncate text-xs font-medium">{r.name}</span>
              <span className="shrink-0 font-mono text-label tabular-nums">
                {r.overdue > 0
                  ? t.rich("work.overview.rollupOverdueAndSoon", {
                      overdue: r.overdue,
                      soon: r.count - r.overdue,
                      b: (c) => (
                        <span className="font-semibold text-rose-600 dark:text-rose-400">{c}</span>
                      ),
                    })
                  : t("work.overview.rollupNoneOverdueSoon", { soon: r.count - r.overdue })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/**
 * Eine Zeile: Warnzeichen oder Uhr, Titel, Frist, darunter Solution und Epic.
 *
 * Eigenes Bauteil, seit die Liste kappt — dieselben Zeilen stehen in der
 * Hauptliste und im Aufklapper. Muster wie `RiskRow` in `risks-block.tsx`.
 */
function DueSoonRow({ item: it, hrefBase }: { item: DueSoonItem; hrefBase: string }) {
  const t = useTranslations();
  const epic = it.epic;
  return (
    <li className="flex items-start gap-2">
      {it.overdue ? (
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-rose-500" />
      ) : (
        <Clock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <Link
            href={`${hrefBase}/${it.id}`}
            className="truncate text-xs font-medium hover:text-primary hover:underline"
            title={it.title}
          >
            {it.title}
          </Link>
          <span
            className={`shrink-0 text-label tabular-nums ${
              it.overdue ? "font-medium text-destructive" : "text-muted-foreground"
            }`}
          >
            {shortDate(it.dateIso)} · {relative(it.daysUntil, t)}
          </span>
        </div>
        {(it.subtitle || it.epic) && (
          <p className="truncate text-xs text-muted-foreground">
            {it.subtitle}
            {it.subtitle && it.epic ? " · " : ""}
            {epic &&
              t.rich("work.overview.epicLink", {
                title: epic.title,
                link: (c) => (
                  <Link
                    href={`/portfolio/epics/${epic.id}`}
                    className="hover:text-primary hover:underline"
                  >
                    {c}
                  </Link>
                ),
              })}
          </p>
        )}
      </div>
    </li>
  );
}
