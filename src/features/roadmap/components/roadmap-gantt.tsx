import { Link } from "@/i18n/navigation";
import {
  barMetrics,
  type MonthAxis,
  type RoadmapRow,
  type RoadmapRowAccent,
} from "@/domain/roadmap";

// RoadmapRow now lives in the domain roadmap view-model; re-exported so existing
// importers of the component keep working.
export type { RoadmapRow } from "@/domain/roadmap";

interface Props {
  rows: RoadmapRow[];
  axis: MonthAxis;
  /**
   * Optional vertikale Anker auf der Zeitachse — z. B. PI-Grenzen. Linien
   * werden subtil gezeichnet; zwischen zwei Boundaries faerbt der Track
   * abwechselnd. Bleibt der Prop leer, ist die Sicht layout-identisch
   * mit der heutigen Generic-Roadmap.
   */
  piBoundaries?: ReadonlyArray<{ date: Date; label?: string }>;
}

const MONTH_PX = 88;
const LABEL_W = 256;
const ROW_H = 40;

/**
 * Generic roadmap Gantt — fester Label-Spalte links, Monatsachse rechts,
 * eine absolut positionierte Bar pro Row. Geteilt von Portfolio-, Value-
 * Stream-, ART- und Delivery-Cockpit-Roadmap; Bar-Positionen kommen aus
 * `@/domain/roadmap`.
 *
 * Visual-Polish 2026-06 (Cockpit-Folge): rounded-full Bars mit Gradient
 * und Schatten, sticky Header, Today-Linie, optionale PI-Grid-Linien
 * (`piBoundaries`) und optionaler Status-Akzent pro Row (`row.accent`).
 * Surfaces die weder `accent` noch `piBoundaries` setzen, sehen exakt
 * die alte Optik plus die crispere Bar-Behandlung.
 */
export function RoadmapGantt({ rows, axis, piBoundaries }: Props) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Keine Einträge.</p>;
  }

  const trackWidth = axis.months.length * MONTH_PX;
  const today = new Date();
  const todayPct = pctOnAxis(today, axis);
  const boundaryPcts = (piBoundaries ?? [])
    .map((b) => ({ pct: pctOnAxis(b.date, axis), label: b.label }))
    .filter((b) => b.pct !== null && b.pct > 0 && b.pct < 100) as Array<{
    pct: number;
    label: string | undefined;
  }>;

  // Hintergrund-Bands zwischen aufeinanderfolgenden Boundaries (alternating).
  const bandRanges = boundaryPcts.length > 0 ? buildBands(boundaryPcts.map((b) => b.pct)) : [];

  return (
    <div className="overflow-x-auto rounded-lg border">
      <div style={{ width: LABEL_W + trackWidth, minWidth: "100%" }}>
        {/* Month header — sticky am Top, dezenter Gradient */}
        <div
          className="sticky top-0 z-20 flex border-b bg-gradient-to-b from-muted/60 to-muted/40
            shadow-[0_1px_0_var(--color-border)]"
        >
          <div
            className="sticky left-0 z-10 shrink-0 bg-gradient-to-b from-muted/60 to-muted/40 px-4
              py-2 text-xs font-medium text-muted-foreground"
            style={{ width: LABEL_W }}
          >
            Eintrag
          </div>
          <div className="flex" style={{ width: trackWidth }}>
            {axis.months.map((m) => (
              <div
                key={m.key}
                className="shrink-0 border-l px-2 py-2 text-center text-[10px] font-medium
                  uppercase tracking-wide text-muted-foreground"
                style={{ width: MONTH_PX }}
              >
                {m.label}
              </div>
            ))}
          </div>
        </div>

        {/* Rows */}
        {rows.map((row) => {
          if (row.kind === "group") {
            return (
              <div key={row.id} className="flex border-b bg-muted/40">
                <div
                  className="sticky left-0 z-10 bg-muted/40 px-4 py-1.5 text-xs font-semibold
                    uppercase tracking-wide"
                  style={{ width: LABEL_W }}
                >
                  {row.label}
                </div>
                <div style={{ width: trackWidth }} />
              </div>
            );
          }

          const bar = row.range ? barMetrics(row.range, axis) : null;
          const derivedBar = row.derivedRange ? barMetrics(row.derivedRange, axis) : null;
          const accent = resolveAccent(row.accent ?? (row.kind as RoadmapRowAccent));

          return (
            <div
              key={row.id}
              className="group flex border-b transition-colors duration-100 last:border-b-0
                hover:bg-muted/30"
              style={{ minHeight: ROW_H }}
            >
              <div
                className="sticky left-0 z-10 flex shrink-0 flex-col justify-center bg-background
                  pr-4"
                style={{ width: LABEL_W, paddingLeft: 16 + row.depth * 20 }}
              >
                {row.href ? (
                  <Link
                    href={row.href}
                    className="line-clamp-1 text-sm font-medium text-primary hover:underline"
                    title={row.label}
                  >
                    {row.label}
                  </Link>
                ) : (
                  <span className="line-clamp-1 text-sm font-medium" title={row.label}>
                    {row.label}
                  </span>
                )}
                {row.sublabel && (
                  <p
                    className="line-clamp-1 text-[10px] text-muted-foreground/80"
                    title={row.sublabel}
                  >
                    {row.sublabel}
                  </p>
                )}
              </div>
              <div className="relative" style={{ width: trackWidth }}>
                {/* PI-Bands (alternating background) — unter allen anderen Layern */}
                {bandRanges.map((band, i) =>
                  i % 2 === 0 ? null : (
                    <div
                      key={`band-${i}`}
                      className="absolute inset-y-0 bg-muted/30"
                      style={{ left: `${band.start}%`, width: `${band.end - band.start}%` }}
                    />
                  ),
                )}
                {/* PI-Boundary-Linien */}
                {boundaryPcts.map((b, i) => (
                  <div
                    key={`pi-line-${i}`}
                    className="absolute inset-y-0 w-px bg-border/70"
                    style={{ left: `${b.pct}%` }}
                    {...(b.label ? { title: b.label } : {})}
                  />
                ))}
                {/* Today-Linie */}
                {todayPct !== null && (
                  <div
                    className="pointer-events-none absolute inset-y-0 w-px bg-rose-500/70"
                    style={{ left: `${todayPct}%` }}
                    title={`Heute · ${today.toLocaleDateString("de-DE")}`}
                  />
                )}

                {/* Primary-Bar (Soll, oder Ist wenn kein Soll) */}
                {bar && bar.widthPct > 0 ? (
                  <div
                    className={`absolute top-1/2 h-3 -translate-y-1/2 rounded-full
                      bg-gradient-to-b shadow-[0_1px_2px_rgba(0,0,0,0.08)]
                      transition-shadow group-hover:shadow-[0_2px_4px_rgba(0,0,0,0.12)] ${accent.bar}`}
                    style={{ left: `${bar.leftPct}%`, width: `${bar.widthPct}%`, minWidth: 6 }}
                    title={`${row.label}${derivedBar ? " — Soll" : ""}`}
                  />
                ) : (
                  <span
                    className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px]
                      text-muted-foreground/60"
                  >
                    ungeplant
                  </span>
                )}
                {/* Ist-Overlay (Epic-Roadmap) */}
                {derivedBar && derivedBar.widthPct > 0 && (
                  <div
                    className="absolute bottom-1 h-1 rounded-full bg-primary/40"
                    style={{
                      left: `${derivedBar.leftPct}%`,
                      width: `${derivedBar.widthPct}%`,
                      minWidth: 4,
                    }}
                    title={`${row.label} — Ist (aus Features)`}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface AccentClasses {
  bar: string;
}

function resolveAccent(accent: RoadmapRowAccent | "group"): AccentClasses {
  switch (accent) {
    case "approved":
      return { bar: "from-sky-400 to-sky-600" };
    case "in_progress":
      return { bar: "from-indigo-400 to-indigo-600" };
    case "blocked":
      return { bar: "from-amber-300 to-amber-500" };
    case "completed":
      return { bar: "from-emerald-400 to-emerald-600" };
    case "cancelled":
      return { bar: "from-slate-300 to-slate-500" };
    case "epic":
      return { bar: "from-indigo-500 to-indigo-700" };
    case "feature":
    default:
      return { bar: "from-sky-400 to-sky-600" };
  }
}

/**
 * Wo liegt `date` prozentual auf der Achse `[axis.start … axis.end]`?
 * Outside → `null`, damit der Caller die Linie ausblenden kann.
 */
function pctOnAxis(date: Date, axis: MonthAxis): number | null {
  const t = date.getTime();
  const start = axis.start.getTime();
  const end = axis.end.getTime();
  if (end <= start) return null;
  if (t < start || t > end) return null;
  return ((t - start) / (end - start)) * 100;
}

/** Aus aufsteigenden Boundary-Prozenten Track-Bands `[0, b1, b2, …, 100]` formen. */
function buildBands(pcts: number[]): Array<{ start: number; end: number }> {
  const sorted = [...pcts].sort((a, b) => a - b);
  const stops = [0, ...sorted, 100];
  const out: Array<{ start: number; end: number }> = [];
  for (let i = 0; i < stops.length - 1; i++) {
    out.push({ start: stops[i]!, end: stops[i + 1]! });
  }
  return out;
}
