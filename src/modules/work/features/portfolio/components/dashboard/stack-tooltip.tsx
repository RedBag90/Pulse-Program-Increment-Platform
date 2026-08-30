"use client";

import { formatEUR as fmtEur } from "@/lib/formatting";

/**
 * Die Tooltips der gestapelten Dashboard-Charts — und die reine Faltung, die
 * sie speist.
 *
 * Eine Serie erscheint im Chart als **mehrere** Bars: die Benefit Velocity legt
 * den projizierten Rest zum Plan als `${id}#up` obendrauf, der Cash-Flow teilt
 * denselben Saldo in `${id}#pos` und `${id}#neg`. Recharts kennt diese
 * Zusammengehörigkeit nicht und listet jede Bar einzeln — was den Tooltip
 * doppelt so lang macht, wie er sein müsste, und die Zeilen ununterscheidbar
 * hinterlässt.
 *
 * Dazu kommt der Konfidenz-Split: die Status-, Wertstrom- und ART-Gruppierungen
 * legen je Gruppe zwei Serien an, `<id>` für die budgetierten Epics und
 * `<id>:est` für die veranschlagten. Beide tragen denselben Titel — erst
 * `stackLabel` macht sie auseinanderhaltbar.
 */

export interface Stack {
  id: string;
  title: string;
  color: string;
  /** `false` ⇒ Epics ohne freigegebene Budget-Allokation (schraffiert). */
  confirmed: boolean;
}

/**
 * Der Anzeigename einer Serie. Der Zusatz hängt an der Serie selbst, nicht an
 * einer Darstellungs-Prop: sonst heißen in Charts ohne Schraffur zwei Serien
 * wörtlich gleich.
 */
export function stackLabel(s: Stack): string {
  return s.confirmed ? s.title : `${s.title} (veranschlagt)`;
}

/** Ein Recharts-Payload-Eintrag, so weit dieses Modul ihn kennen muss. */
export interface StackPayloadItem {
  dataKey?: string | number | undefined;
  value?: number | undefined;
}

export interface StackTooltipRow {
  id: string;
  label: string;
  color: string;
  /** Summe aller Segmente dieser Serie (inkl. Forecast-Anteil). */
  total: number;
  /** Der Anteil aus dem `#up`-Segment — projizierter Rest zum Plan. */
  forecast: number;
}

/**
 * Faltet den Recharts-Payload zu **einer Zeile je Serie**: alle Segmente eines
 * `id` (`#up`, `#pos`, `#neg`) summieren sich, Serien ohne Beitrag fallen weg.
 * Absteigend nach Betrag sortiert — was den Monat trägt, steht oben.
 *
 * `#pos`/`#neg` sind bereits vorzeichenbehaftet und addieren sich deshalb
 * korrekt zum Saldo; der Betrag entscheidet über die Reihenfolge, damit ein
 * großer negativer Saldo nicht ans Ende rutscht.
 */
export function stackTooltipRows(
  payload: readonly StackPayloadItem[],
  stacks: readonly Stack[],
): StackTooltipRow[] {
  const totals = new Map<string, number>();
  const forecasts = new Map<string, number>();
  for (const p of payload) {
    const key = typeof p.dataKey === "string" ? p.dataKey : "";
    if (key === "") continue;
    const [id, segment] = splitSegment(key);
    const v = typeof p.value === "number" && Number.isFinite(p.value) ? p.value : 0;
    totals.set(id, (totals.get(id) ?? 0) + v);
    if (segment === "up") forecasts.set(id, (forecasts.get(id) ?? 0) + v);
  }
  return stacks
    .map((s) => ({
      id: s.id,
      label: stackLabel(s),
      color: s.color,
      total: totals.get(s.id) ?? 0,
      forecast: forecasts.get(s.id) ?? 0,
    }))
    .filter((r) => r.total !== 0)
    .sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
}

/** `"status:L1:est#up"` → `["status:L1:est", "up"]`. */
function splitSegment(key: string): [string, string | null] {
  const hash = key.indexOf("#");
  return hash === -1 ? [key, null] : [key.slice(0, hash), key.slice(hash + 1)];
}

const shell: React.CSSProperties = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  fontSize: 12,
  color: "var(--popover-foreground)",
  padding: "8px 10px",
};

/**
 * Der Tooltip der gestapelten Charts: je beitragender Serie eine Zeile, der
 * Forecast-Anteil als Zusatz in derselben Zeile, darunter die Summe.
 */
export function StackTooltip({
  active,
  payload,
  label,
  stacks,
  suffix = "",
}: {
  active?: boolean | undefined;
  payload?: readonly StackPayloadItem[] | undefined;
  label?: string | undefined;
  stacks: readonly Stack[];
  /** Zusatz hinter jedem Betrag, etwa „/Monat“. */
  suffix?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const rows = stackTooltipRows(payload, stacks);
  const sum = rows.reduce((acc, r) => acc + r.total, 0);

  return (
    <div style={shell}>
      <p className="mb-1 font-medium">{label}</p>
      {rows.length === 0 ? (
        <p className="text-muted-foreground">kein Beitrag in diesem Monat</p>
      ) : (
        <>
          {rows.map((r) => (
            <div key={r.id} className="flex items-center gap-1.5">
              <span
                className="inline-block size-2 shrink-0 rounded-sm"
                style={{ background: r.color }}
              />
              <span>
                {r.label}: {fmtEur(r.total)}
                {suffix}
                {r.forecast !== 0 && (
                  <span className="text-muted-foreground">
                    {" "}
                    · davon {fmtEur(r.forecast)} Forecast
                  </span>
                )}
              </span>
            </div>
          ))}
          {rows.length > 1 && (
            <div className="mt-1 border-t pt-1 font-medium">
              Σ {fmtEur(sum)}
              {suffix}
            </div>
          )}
        </>
      )}
    </div>
  );
}
