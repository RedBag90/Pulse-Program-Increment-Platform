import { Link } from "@/i18n/navigation";
import { barMetrics, type DateRange, type MonthAxis } from "@/domain/roadmap";

export interface RoadmapRow {
  id: string;
  label: string;
  sublabel?: string | undefined;
  href?: string | undefined;
  range: DateRange | null;
  depth: 0 | 1;
  kind: "epic" | "feature" | "group";
}

interface Props {
  rows: RoadmapRow[];
  axis: MonthAxis;
}

const MONTH_PX = 88;
const LABEL_W = 256;

/**
 * Generic roadmap Gantt — a fixed left label column plus a month-axis track
 * with one absolutely-positioned bar per row. Shared by the Portfolio, Value
 * Stream and ART roadmaps; bar positions come from `@/domain/roadmap`.
 */
export function RoadmapGantt({ rows, axis }: Props) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Keine Einträge.</p>;
  }

  const trackWidth = axis.months.length * MONTH_PX;

  return (
    <div className="overflow-x-auto rounded-lg border">
      <div style={{ width: LABEL_W + trackWidth, minWidth: "100%" }}>
        {/* Month header */}
        <div className="flex border-b bg-muted/50">
          <div
            className="sticky left-0 z-10 shrink-0 bg-muted/50 px-4 py-2 text-xs font-medium text-muted-foreground"
            style={{ width: LABEL_W }}
          >
            Eintrag
          </div>
          <div className="flex" style={{ width: trackWidth }}>
            {axis.months.map((m) => (
              <div
                key={m.key}
                className="shrink-0 border-l px-2 py-2 text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
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
                  className="sticky left-0 z-10 bg-muted/40 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide"
                  style={{ width: LABEL_W }}
                >
                  {row.label}
                </div>
                <div style={{ width: trackWidth }} />
              </div>
            );
          }

          const bar = row.range ? barMetrics(row.range, axis) : null;
          const barClass = row.kind === "epic" ? "bg-primary" : "bg-blue-400";

          return (
            <div key={row.id} className="flex border-b last:border-b-0 hover:bg-muted/30">
              <div
                className="sticky left-0 z-10 shrink-0 bg-background py-2 pr-4"
                style={{ width: LABEL_W, paddingLeft: 16 + row.depth * 20 }}
              >
                {row.href ? (
                  <Link
                    href={row.href}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    {row.label}
                  </Link>
                ) : (
                  <span className="text-sm font-medium">{row.label}</span>
                )}
                {row.sublabel && (
                  <p className="truncate text-[10px] text-muted-foreground">{row.sublabel}</p>
                )}
              </div>
              <div className="relative" style={{ width: trackWidth }}>
                {bar && bar.widthPct > 0 ? (
                  <div
                    className={`absolute top-1/2 h-4 -translate-y-1/2 rounded ${barClass}`}
                    style={{ left: `${bar.leftPct}%`, width: `${bar.widthPct}%`, minWidth: 4 }}
                    title={row.label}
                  />
                ) : (
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground/60">
                    ungeplant
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
