import { periodPhases } from "@/modules/budgeting/domain/period-phases";

/**
 * **Die sieben Phasen einer Budget-Kachel** — gezeigt am Zustand einer frisch
 * angelegten: was als Naechstes dran ist, und was worauf wartet.
 *
 * Die Figur baut die Leiste nicht nach, sie **ruft** `periodPhases` mit den
 * Fakten einer leeren Kachel auf. Damit stehen hier dieselben Beschriftungen,
 * dieselbe Reihenfolge und vor allem dieselben Sperr-Begruendungen wie an der
 * Kachel selbst — Saetze, die sonst niemand abschreibt, weil sie im Code
 * zwischen zwei Bedingungen stehen.
 */
const FRESH = periodPhases({
  status: "draft",
  poolTotal: 0,
  hasTimeframe: false,
  candidateCount: 0,
  staffedGroupCount: 0,
  groupCount: 0,
  submittedCount: 0,
  hasRevision: false,
});

const TAB_LABEL: Record<string, string> = {
  setup: "Setup",
  verteilung: "Verteilung",
  ergebnis: "Ergebnis",
};

export function PeriodPhases() {
  return (
    <ol className="divide-y overflow-hidden rounded-lg border bg-card">
      {FRESH.map((p, i) => (
        <li key={p.key} className="grid gap-1 p-4 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="space-y-0.5">
            <p className="text-[14px] font-medium text-foreground">
              <span className="mr-2 font-mono text-[11px] tabular-nums text-muted-foreground">
                {i + 1}
              </span>
              {p.label}
            </p>
            {p.blockedBy && (
              <p className="max-w-[var(--reading-max-w)] pl-6 text-[13px] leading-relaxed text-muted-foreground">
                {p.blockedBy}
              </p>
            )}
          </div>
          <p className="pl-6 font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground sm:pl-0 sm:text-right">
            {TAB_LABEL[p.tab] ?? p.tab}
          </p>
        </li>
      ))}
    </ol>
  );
}
