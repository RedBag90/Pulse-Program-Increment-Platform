"use client";

import { useTranslations } from "next-intl";
import { useUrlState } from "@/modules/drumbeat/features/lib/use-url-state";
import type { PiLage } from "@/modules/drumbeat/server/views/pi-lage-view";
import { SIGNAL_KEY, SIGNAL_TONE } from "./lage-view";

/**
 * **Die Lage in einer Zeile** — unter der PI-Leiste der anderen Sichten, nur
 * beim laufenden PI. Wer auf dem Board arbeitet, sieht, ob der PI auf Kurs
 * ist, ohne die Sicht zu wechseln; ein Klick öffnet „Lage".
 */
export function LageStrip({ lage }: { lage: PiLage }) {
  const t = useTranslations();
  const { setParam } = useUrlState();
  const { head } = lage;
  const blockiert = lage.attention.length;
  const ohneRoam = lage.risks.filter((r) => r.roamStatus === "open").length;
  return (
    <button
      type="button"
      onClick={() => setParam("view", "lage")}
      className="mx-6 mb-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border bg-background px-3 py-2 text-left text-sm hover:bg-muted"
    >
      <span
        className={`rounded-full px-2.5 py-0.5 text-meta font-semibold ${SIGNAL_TONE[head.signal]}`}
      >
        {t(SIGNAL_KEY[head.signal])}
      </span>
      <span className="tabular-nums">
        {t("drumbeat.lage.strip.tag", { tag: head.days.elapsed, total: head.days.total })}
      </span>
      <span className="tabular-nums">
        {t("drumbeat.lage.strip.geliefert", { js: head.deliveredJs, plan: head.plannedJs })}
      </span>
      {blockiert > 0 && (
        <span className="font-medium text-destructive">
          {t("drumbeat.lage.strip.blockiert", { n: blockiert })}
        </span>
      )}
      {ohneRoam > 0 && (
        <span className="text-destructive">
          {t("drumbeat.lage.strip.ohneRoam", { n: ohneRoam })}
        </span>
      )}
      <span className="ml-auto text-primary">{t("drumbeat.lage.strip.oeffnen")}</span>
    </button>
  );
}
