import { Link } from "@/i18n/navigation";
import { Card } from "@/components/ui/card";
import { SectionLabel } from "@/components/ui/section-label";
import { ROAM_LABELS, ROAM_DOT } from "@/modules/core/kernel/domain/roam";
import type {
  PortfolioOverview,
  OverviewRiskBand,
} from "@/modules/work/server/views/portfolio-overview";

/** Exposure-Band → Badge-Klassen. Lokale Map, da `risks/.../labels.ts` für das
 *  `work`-Modul gesperrt ist (ADR-0013) — bewusst kleine Duplikation. */
const BAND_BADGE: Record<OverviewRiskBand, string> = {
  low: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
  critical: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
};

const BAND_LABEL: Record<OverviewRiskBand, string> = {
  low: "Niedrig",
  medium: "Mittel",
  high: "Hoch",
  critical: "Kritisch",
};

/**
 * „Risiken" — die dokumentierten, noch offenen Risiken des Portfolios, nach
 * Kritikalität (Exposure) absteigend. Rechts neben den „Fällig"-Sektionen; bei
 * vielen Einträgen scrollt die Liste. Server-only; Daten kommen als `data.risks`
 * aus dem DTO (der Risks-Adapter formt sie, Work rechnet nicht an `risks`).
 */
export function RisksBlock({ data }: { data: PortfolioOverview }) {
  const risks = data.risks;

  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <SectionLabel>Risiken</SectionLabel>
        {risks.length > 0 && (
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {risks.length}
          </span>
        )}
      </div>

      {risks.length === 0 ? (
        <p className="text-sm text-muted-foreground">Keine aktiven dokumentierten Risiken.</p>
      ) : (
        <ul className="max-h-96 space-y-2 overflow-y-auto">
          {risks.map((r) => (
            <li key={r.id} className="flex items-start gap-2">
              <span
                className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                  r.band ? BAND_BADGE[r.band] : "bg-muted text-muted-foreground"
                }`}
                title={r.band ? `Exposure: ${BAND_LABEL[r.band]} (${r.score})` : "Ungescored"}
              >
                {r.band ? BAND_LABEL[r.band] : "—"}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <Link
                    href="/risks"
                    className="truncate text-sm font-medium hover:text-primary hover:underline"
                    title={r.title}
                  >
                    {r.title}
                  </Link>
                  <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                    <span className={`size-1.5 rounded-full ${ROAM_DOT[r.roamStatus]}`} />
                    {ROAM_LABELS[r.roamStatus]}
                  </span>
                </div>
                {r.epic && (
                  <p className="truncate text-xs text-muted-foreground">
                    Epic:{" "}
                    <Link
                      href={`/portfolio/epics/${r.epic.id}`}
                      className="hover:text-primary hover:underline"
                    >
                      {r.epic.title}
                    </Link>
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
