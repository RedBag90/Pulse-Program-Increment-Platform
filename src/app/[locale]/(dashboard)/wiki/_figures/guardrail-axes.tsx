import {
  STATIONS,
  DEFAULT_GUARDRAIL_TARGETS as D,
} from "@/modules/work/domain/portfolio-guardrails";

interface Axis {
  no: number;
  title: string;
  fields: { label: string; value: string }[];
  rule: string;
  mix: boolean;
}

/**
 * Die vier Guardrails — und die Unterscheidung, an der sich beim Aufbau die
 * Geister scheiden: **zwei sind Mischungen, zwei sind es nicht.** Nur die
 * Mischungen muessen 100 ergeben.
 *
 * Die Startwerte kommen aus `DEFAULT_GUARDRAIL_TARGETS`, die Horizont-Felder
 * aus `STATIONS` — deshalb sind es hier fuenf und nicht vier, ohne dass es
 * jemand nachpflegen muesste.
 */
const AXES: Axis[] = [
  {
    no: 1,
    title: "Investment by Horizon",
    fields: STATIONS.map((st) => ({ label: st, value: `${D.horizon[st]} %` })),
    rule: "Summe 100 (Toleranz 0,5)",
    mix: true,
  },
  {
    no: 2,
    title: "Capacity Allocation",
    fields: [
      { label: "business", value: `${D.capacity.business} %` },
      { label: "enabler", value: `${D.capacity.enabler} %` },
      { label: "maintenance", value: `${D.capacity.maintenance} %` },
    ],
    rule: "Summe 100 (Toleranz 0,5)",
    mix: true,
  },
  {
    no: 3,
    title: "Portfolio-Schwelle",
    fields: [
      {
        label: "portfolioThreshold",
        value: `${D.approval.portfolioThreshold.toLocaleString("de-DE")} €`,
      },
    ],
    rule: "kein Mix — eine Grenze in Euro",
    mix: false,
  },
  {
    no: 4,
    title: "Business-Owner-Engagement",
    fields: [
      { label: "coverage", value: `${D.engagement.coverage} %` },
      { label: "responseDays", value: `${D.engagement.responseDays} Tage` },
    ],
    rule: "kein Mix — zwei unabhaengige Werte",
    mix: false,
  },
];

export function GuardrailAxes() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {AXES.map((a) => (
        <div key={a.no} className="space-y-2.5 rounded-lg bg-card shadow-card p-4">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-meta tabular-nums text-muted-foreground">{a.no}</span>
            <p className="font-heading text-sm font-semibold text-foreground">{a.title}</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {a.fields.map((f) => (
              <span
                key={f.label}
                className="rounded-sm border bg-muted/60 px-2 py-1 font-mono text-meta tabular-nums text-muted-foreground"
              >
                {f.label} <span className="text-foreground">{f.value}</span>
              </span>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {a.mix ? <span className="text-foreground">Mischung</span> : "Schwelle"} · {a.rule}
          </p>
        </div>
      ))}
    </div>
  );
}
