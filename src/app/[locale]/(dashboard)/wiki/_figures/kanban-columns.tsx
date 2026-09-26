import { useTranslations } from "next-intl";
import {
  PORTFOLIO_COLUMNS,
  PORTFOLIO_COLUMN_LABELS,
} from "@/modules/work/features/portfolio/lib/epic-lifecycle";

/**
 * Die sechs Spalten des Portfolio-Kanbans — und die Besonderheit, um die es in
 * dieser Phase geht: **die Spalte ist nicht der Reifegrad.**
 *
 * Sie kommen aus `PORTFOLIO_COLUMNS`, also aus derselben Liste, aus der das
 * Kanban sie nimmt. Bis September 2026 entstanden sie aus `STAGE_GATES` — Spalte
 * und Grad waren dasselbe, und die eine Ausnahme (Funnel/Hypothese) stand als
 * Fussnote daneben. Seit dem Neuschnitt der Achse sind es drei Abweichungen; sie
 * gehoeren damit in die Tabelle, nicht in eine Fussnote.
 */
const REIFEGRAD: Record<string, string> = {
  funnel: "L0",
  hypothesis: "L0 · L1",
  business_case: "L1",
  investment: "L2 · L3",
  implementation: "L4.1",
  impact: "L4.2",
};

export function KanbanColumns() {
  const t = useTranslations();
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg bg-card shadow-card">
        <div className="flex min-w-[520px] divide-x">
          {PORTFOLIO_COLUMNS.map((c) => (
            <div key={c} className="flex-1 px-3 py-3 text-center">
              <p className="font-mono text-meta uppercase tracking-[0.1em] text-muted-foreground">
                {REIFEGRAD[c]}
              </p>
              <p className="mt-1 text-xs font-medium text-foreground">
                {PORTFOLIO_COLUMN_LABELS[c]}
              </p>
            </div>
          ))}
        </div>
      </div>
      <p className="max-w-[var(--reading-max-w)] text-xs leading-relaxed text-muted-foreground">
        {t.rich("wiki.ui.kanbanDreiGrenzenErklaerung", {
          strong: (c) => <strong className="font-medium text-foreground">{c}</strong>,
          em: (c) => <em>{c}</em>,
          code: (c) => <code>{c}</code>,
        })}
      </p>
    </div>
  );
}
