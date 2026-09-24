import { useTranslations } from "next-intl";
import {
  HORIZONS,
  HORIZON_KEYS,
  HORIZON_HELP_KEYS,
  stationsOf,
} from "@/modules/work/domain/portfolio-guardrails";

/**
 * **Vier Horizonte, fuenf Stationen.** Genau das soll die Figur zeigen: nur H1
 * traegt zwei Plaketten, alle anderen eine.
 *
 * Jede Zeile kommt aus `HORIZONS`, jede Plakette aus `stationsOf`. Wuerde
 * jemand einen sechsten Horizont einfuehren, stuende er hier von selbst — und
 * genau das ist der Zweck: eine abgeschriebene Leiter faellt zurueck, diese
 * nicht.
 */
export function HorizonLadder() {
  const t = useTranslations();
  return (
    <div className="divide-y overflow-hidden rounded-lg bg-card shadow-card">
      {HORIZONS.map((h) => {
        const stations = stationsOf(h);
        const help = HORIZON_HELP_KEYS[h];
        return (
          <div key={h} className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
            <div className="space-y-1.5">
              <p className="font-heading text-sm font-semibold text-foreground">
                {t(HORIZON_KEYS[h])}
              </p>
              <p className="text-sm leading-relaxed text-muted-foreground">{t(help.blurb)}</p>
              <dl className="grid gap-x-3 gap-y-0.5 text-xs text-muted-foreground sm:grid-cols-[auto_minmax(0,1fr)]">
                <dt className="font-mono text-meta uppercase tracking-wider sm:pt-[3px]">
                  {t("wiki.ui.epics")}
                </dt>
                <dd>{t(help.epicArt)}</dd>
                <dt className="font-mono text-meta uppercase tracking-wider sm:pt-[3px]">
                  {t("wiki.ui.budget")}
                </dt>
                <dd>{t(help.budgetFokus)}</dd>
              </dl>
            </div>
            <div className="flex gap-1.5 sm:justify-end">
              {stations.map((st) => (
                <span
                  key={st}
                  className="rounded-sm border bg-muted/60 px-2 py-1 font-mono text-meta tabular-nums text-muted-foreground"
                >
                  {st}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
