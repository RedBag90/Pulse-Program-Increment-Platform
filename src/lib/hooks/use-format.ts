"use client";

import { useLocale } from "next-intl";
import { useMemo } from "react";
import { isLocale, type Locale } from "@/i18n/routing";
import {
  formatDate,
  formatEUR,
  formatEURPrefix,
  formatCompactEUR,
  formatPercent,
  formatPp,
  formatScaledEUR,
} from "@/lib/formatting";

/**
 * **Die Formatierer, an die Sprache des Lesers gebunden.**
 *
 * `src/lib/formatting.ts` bleibt rein — die Funktionen nehmen einen Locale als
 * Argument, damit Domäne, Server und Tests sie ohne React benutzen können. In
 * einer Client-Komponente will das niemand von Hand durchreichen; hier wird es
 * einmal gebunden.
 *
 * ```tsx
 * const f = useFormat();
 * <span>{f.eur(budget)}</span>
 * ```
 *
 * Wer den Locale ausnahmsweise selbst wählt (ein Bericht in fester Sprache,
 * eine Vorschau), ruft weiterhin `formatEUR(n, "en")` direkt.
 */
export function useFormat() {
  const raw = useLocale();
  const locale: Locale | undefined = isLocale(raw) ? raw : undefined;

  return useMemo(
    () => ({
      eur: (n: number) => formatEUR(n, locale),
      eurPrefix: (n: number) => formatEURPrefix(n, locale),
      compactEur: (n: number) => formatCompactEUR(n, locale),
      scaledEur: (n: number) => formatScaledEUR(n, locale ?? "de"),
      percent: (ratio: number) => formatPercent(ratio, locale ?? "de"),
      pp: (delta: number) => formatPp(delta, locale ?? "de"),
      date: (v: Date | string | null | undefined, mode?: "date" | "datetime") =>
        formatDate(v, mode ?? "date", locale),
      /** Der aufgelöste Locale — für alles, was ihn selbst weiterreichen muss. */
      locale,
    }),
    [locale],
  );
}
