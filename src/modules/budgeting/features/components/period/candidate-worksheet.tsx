"use client";

import { Fragment, useState, type ReactNode } from "react";
import {
  groupCandidates,
  worksheetSections,
  type GroupableCandidate,
  type WorksheetSection,
} from "@/modules/budgeting/domain/candidate-grouping";
import { formatEUR } from "@/lib/formatting";

/**
 * Das Arbeitsblatt der Kandidaten: **ein Abschnitt je Wertstrom**, Run vorn als
 * Pflichtblock. Trägt alle fünf Flächen, auf denen Kandidaten stehen — PB-Liste,
 * Verteil-Seite, Vorschlags-Matrix, Ergebnis und Druckbogen.
 *
 * Bewusst **ein** Raster statt einer Tabelle je Abschnitt: die Abschnitte sind
 * Kopfzeilen in derselben Tabelle. Getrennte Tabellen müssten ihre
 * Spaltenbreiten von Hand gleichhalten — geht das einmal verloren, stehen die
 * Beträge nicht mehr untereinander, und genau das war der Fehler der
 * verschachtelten Kästen davor. Optisch bleibt es das Arbeitsblatt,
 * strukturell ist die Ausrichtung garantiert.
 *
 * Sortiert wird auf allen Ebenen nach dem **Anfrage**-Betrag, nicht nach dem
 * Arbeitswert: beim Tippen darf keine Zeile ihre Position wechseln.
 */

export interface CandidateColumn<T> {
  key: string;
  label: string;
  /** Zahlwert — speist Abschnitts-Summen und Fußzeile. */
  value: (item: T) => number;
  /** Eigene Darstellung der Datenzeile, z. B. ein Eingabefeld. */
  cell?: (item: T) => ReactNode;
  width: string;
}

export function CandidateWorksheet<T extends GroupableCandidate>({
  items,
  columns,
  sortBy,
  title,
  action,
  progress,
  empty,
  alwaysOpen = false,
  collapsedByDefault,
}: {
  items: readonly T[];
  columns: CandidateColumn<T>[];
  /** Betrag, nach dem gegliedert und sortiert wird — in aller Regel die Anfrage. */
  sortBy: (item: T) => number;
  title: (item: T) => ReactNode;
  /** Zusätzliche Spalte ganz rechts ohne Summe, z. B. „entfernen". */
  action?: (item: T) => ReactNode;
  /** Fortschrittsbalken je Abschnitt: welche Spalte gegen welche. */
  progress?: { of: string; against: string };
  empty: string;
  /** Druck: keine Klapp-Steuerung, alles offen. */
  alwaysOpen?: boolean;
  /** Abschnitte, die eingeklappt starten (z. B. Run auf der PB-Liste). */
  collapsedByDefault?: (section: WorksheetSection<T>) => boolean;
}) {
  const sections = worksheetSections(groupCandidates(items, sortBy));
  const [closed, setClosed] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      sections.filter((s) => collapsedByDefault?.(s) ?? false).map((s) => [s.key, true]),
    ),
  );

  if (sections.length === 0) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }

  const sum = (rows: readonly T[], col: CandidateColumn<T>): number =>
    rows.reduce((s, i) => s + col.value(i), 0);

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full table-fixed text-sm">
        <colgroup>
          <col />
          {columns.map((c) => (
            <col key={c.key} style={{ width: c.width }} />
          ))}
          {action && <col style={{ width: "96px" }} />}
        </colgroup>

        <thead className="sticky top-0 z-10">
          <tr className="border-b bg-muted/60 text-xs text-muted-foreground">
            <th className="px-3 py-2 text-left font-medium">Kandidat</th>
            {columns.map((c) => (
              <th key={c.key} className="px-3 py-2 text-right font-medium">
                {c.label}
              </th>
            ))}
            {action && <th />}
          </tr>
        </thead>

        {sections.map((section) => {
          const rows = section.items;
          const open = alwaysOpen || !closed[section.key];
          const done = progress ? sum(rows, byKey(columns, progress.of)) : 0;
          const target = progress ? sum(rows, byKey(columns, progress.against)) : 0;
          const pct = target > 0 ? Math.min(100, Math.round((done / target) * 100)) : 0;
          const untouched = progress != null && done === 0;

          return (
            <tbody key={section.key} className={untouched ? "opacity-60" : ""}>
              <tr
                className={`border-y ${section.kind === "run" ? "bg-amber-50 dark:bg-amber-950/30" : "bg-muted/40"}`}
              >
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => setClosed((c) => ({ ...c, [section.key]: open }))}
                    disabled={alwaysOpen}
                    className="flex items-center gap-2 text-left disabled:cursor-default"
                  >
                    <span className="w-3 shrink-0 text-muted-foreground print:hidden">
                      {open ? "▾" : "▸"}
                    </span>
                    <span
                      className={`text-xs font-semibold uppercase tracking-wide ${
                        section.kind === "run" ? "text-amber-800 dark:text-amber-200" : ""
                      }`}
                    >
                      {section.label}
                    </span>
                    <span className="text-[11px] font-normal normal-case text-muted-foreground">
                      {rows.length} {section.kind === "run" ? "Positionen" : "Epics"}
                    </span>
                    {progress && (
                      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-background print:hidden">
                        <span
                          className="block h-full rounded-full bg-foreground/70"
                          style={{ width: `${pct}%` }}
                        />
                      </span>
                    )}
                  </button>
                </td>
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className="px-3 py-2 text-right text-xs font-semibold tabular-nums"
                  >
                    {formatEUR(sum(rows, c))}
                  </td>
                ))}
                {action && <td />}
              </tr>

              {open &&
                section.solutions.map((sol) => (
                  <Fragment key={sol.name}>
                    {sol.heading && (
                      <tr className="border-b border-dashed">
                        <td className="py-1 pl-9 pr-3 text-[11px] text-muted-foreground">
                          {sol.name}
                        </td>
                        {columns.map((c) => (
                          <td
                            key={c.key}
                            className="px-3 py-1 text-right text-[11px] tabular-nums text-muted-foreground"
                          >
                            {formatEUR(sum(sol.items, c))}
                          </td>
                        ))}
                        {action && <td />}
                      </tr>
                    )}
                    {sol.items.map((item, i) => (
                      <tr key={i} className="border-b last:border-b-0">
                        <td className={`${sol.heading ? "pl-12" : "pl-9"} py-1.5 pr-3`}>
                          {title(item)}
                        </td>
                        {columns.map((c) => (
                          <td key={c.key} className="px-3 py-1.5 text-right tabular-nums">
                            {c.cell ? c.cell(item) : formatEUR(c.value(item))}
                          </td>
                        ))}
                        {action && <td className="px-3 py-1.5 text-right">{action(item)}</td>}
                      </tr>
                    ))}
                  </Fragment>
                ))}
            </tbody>
          );
        })}

        <tfoot>
          <tr className="border-t-2 bg-muted/40 font-semibold">
            <td className="px-3 py-2">Σ</td>
            {columns.map((c) => (
              <td key={c.key} className="px-3 py-2 text-right tabular-nums">
                {formatEUR(sum(items, c))}
              </td>
            ))}
            {action && <td />}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/** Die Spalte hinter einem Schlüssel — der Fortschritt nennt sie beim Namen. */
function byKey<T>(columns: CandidateColumn<T>[], key: string): CandidateColumn<T> {
  const col = columns.find((c) => c.key === key);
  if (!col) throw new Error(`Unbekannte Spalte „${key}" im Fortschritt des Arbeitsblatts.`);
  return col;
}
