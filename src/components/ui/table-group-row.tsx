"use client";

import { ChevronDown, ChevronRight } from "lucide-react";

/**
 * **Die Kopfzeile einer Tabellengruppe** — Chevron, Name, Zähler-Pille, über die
 * volle Breite.
 *
 * Sie stand wortgleich zweimal im Haus (`epics-list-table.tsx` nach Stage-Gate,
 * `features-list-table.tsx` nach Status); die Issue-Tabelle wäre die dritte
 * Abschrift gewesen. Die beiden bestehenden ziehen mechanisch nach, wenn jemand
 * sie anfasst — hier entsteht der Ort dafür.
 *
 * Bewusst **ohne** `sticky`: über ihr klebt schon der Spaltenkopf und darüber
 * die Bedienleiste. Eine dritte klebende Lage stritte mit den beiden um
 * denselben Platz.
 */
export function TableGroupRow({
  label,
  count,
  open,
  onToggle,
  colSpan,
}: {
  label: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  colSpan: number;
}) {
  return (
    <tr className="border-b bg-muted/30">
      <td colSpan={colSpan} className="py-1.5">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex w-full items-center gap-2 px-3 text-left"
        >
          {open ? (
            <ChevronDown className="size-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-4 text-muted-foreground" />
          )}
          <span className="text-label font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            {label}
          </span>
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-meta font-medium tabular-nums text-muted-foreground">
            {count}
          </span>
        </button>
      </td>
    </tr>
  );
}

/**
 * **„+ n weitere zeigen"** unter einer gekappten Gruppe.
 *
 * Dieselbe Formulierung wie die übrigen Kappungen im Haus (`risks-block.tsx`,
 * `cockpit-board.tsx`) — dort als `<details>`, hier als Knopf, weil die Tabelle
 * ohnehin ein Client-Bauteil ist und die Zeilen im selben `<tbody>` bleiben
 * müssen, damit die Spalten fluchten.
 */
export function TableMoreRow({
  remaining,
  onMore,
  colSpan,
  indent = "pl-3",
}: {
  remaining: number;
  onMore: () => void;
  colSpan: number;
  indent?: string;
}) {
  return (
    <tr className="border-b last:border-0">
      <td colSpan={colSpan} className={`py-1.5 ${indent}`}>
        <button
          type="button"
          onClick={onMore}
          className="rounded-sm text-meta text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          + {remaining} weitere zeigen
        </button>
      </td>
    </tr>
  );
}
