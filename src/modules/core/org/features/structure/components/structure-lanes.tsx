import type { ReactNode } from "react";

/**
 * **Das Gerüst der Struktur-Flächen** — je Wertstrom eine Bahn, darin Spalten.
 *
 * Es trägt keine Fachlichkeit, nur die Form: Karte, Kopfleiste, ein optionaler
 * Streifen über die volle Breite, und darunter ein Spaltensatz, der **in sich**
 * waagerecht rollt statt die Seite zu verbreitern. Unter `sm` stapeln sich die
 * Spalten, weil zwei nebeneinander dort niemandem nutzen.
 *
 * Es steht hier, weil zwei Flächen dieselbe Form brauchen: die Organisation
 * (Wertstrom → ART → Solution mit Geld) und die Rollenverteilung (dieselbe
 * Hierarchie mit Personen). Sie sehen damit gleich aus, weil es **dieselben
 * zehn Klassen** sind — nicht, weil jemand sie abgeschrieben hat.
 *
 * **Bewusst ohne `"use client"`.** Die Organisations-Karte rendert auf dem
 * Server, die Rollenverteilung im Client; ein Modul ohne Direktive kann beides
 * sein. Eine Direktive hier zwänge die eine Seite in den Client-Graphen.
 */
export interface LaneColumn {
  key: string;
  children: ReactNode;
}

export function LaneGroup({ children }: { children: ReactNode }) {
  return <div className="space-y-3">{children}</div>;
}

export function Lane({
  head,
  strip,
  columns,
  empty,
}: {
  /** Die Kopfleiste: Name, Art, Marken, Summen. */
  head: ReactNode;
  /**
   * Eine Reihe über die volle Breite zwischen Kopf und Spalten — dort stehen
   * die Angaben, die dem Wertstrom **selbst** gehören und zu keiner Spalte.
   */
  strip?: ReactNode;
  columns: readonly LaneColumn[];
  /** Was statt der Spalten steht, wenn es keine gibt. */
  empty?: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-lg bg-card shadow-card">
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b bg-surface-frame px-4 py-2.5">
        {head}
      </header>

      {strip && <div className="border-b px-4 py-3">{strip}</div>}

      {columns.length === 0 ? (
        (empty ?? null)
      ) : (
        <div className="flex flex-col divide-y sm:grid sm:auto-cols-[minmax(15rem,1fr)] sm:grid-flow-col sm:divide-x sm:divide-y-0 sm:overflow-x-auto">
          {columns.map((c) => (
            <div key={c.key} className="flex min-w-0 flex-col gap-2.5 p-3">
              {c.children}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
