import { Compass } from "lucide-react";
import type { RteCockpitHero } from "@/server/views/rte-cockpit";

interface Props {
  hero: RteCockpitHero;
}

/**
 * Hero-Streifen für das RTE-Cockpit. Zeigt ART, aktive PI, Tage bis
 * PI-Ende, Predictability der letzten ≤3 abgeschlossenen PIs (delivered
 * Features ÷ in-PI Features) und die durchschnittliche Confidence der
 * aktiven PI-Ziele.
 */
export function RteHero({ hero }: Props) {
  const pi = hero.activePi;
  const piLabel = pi ? pi.name : "Keine aktive PI";
  const daysLabel =
    pi == null
      ? "—"
      : pi.daysUntilEnd > 0
        ? `${pi.daysUntilEnd}d bis Ende`
        : pi.daysUntilEnd === 0
          ? "endet heute"
          : `${Math.abs(pi.daysUntilEnd)}d überfällig`;
  const predictabilityPct =
    hero.predictability != null ? `${Math.round(hero.predictability.value * 100)} %` : "—";
  const confidenceLabel = hero.confidenceAvg != null ? `${hero.confidenceAvg.toFixed(1)} / 5` : "—";

  return (
    <header className="rounded-2xl border bg-card p-6 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div className="flex items-center gap-3">
          <Compass className="size-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold">{hero.artName}</h1>
            <p className="text-sm text-muted-foreground">RTE-Cockpit · ART-Sicht</p>
          </div>
        </div>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Aktive PI" value={piLabel} sub={daysLabel} />
        <Stat
          label="Predictability"
          value={predictabilityPct}
          sub={hero.predictability ? hero.predictability.piNames.join(" · ") : "Keine Historie"}
        />
        <Stat label="Confidence ⌀" value={confidenceLabel} sub="Aktuelle PI-Ziele" />
        <Stat
          label="PI-Fenster"
          value={pi ? `${formatDate(pi.startDate)} → ${formatDate(pi.endDate)}` : "—"}
          sub=" "
        />
      </dl>
    </header>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-lg font-semibold tabular-nums">{value}</dd>
      <p className="text-[11px] text-muted-foreground">{sub}</p>
    </div>
  );
}

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}
