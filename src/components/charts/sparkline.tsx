/**
 * Mini-Trendlinie über eine Messreihe — der letzte Punkt markiert.
 *
 * Sie stand als lokale Komponente im KPI-Reiter eines Epics und gab bei
 * weniger als zwei Punkten `null` zurück: die Zeile sprang in der Breite,
 * sobald der zweite Messwert eintraf. Hier behält sie ihren Platz und zeigt
 * stattdessen eine gestrichelte Grundlinie — „noch kein Trend" ist eine
 * Aussage, ein Sprung ist keine.
 *
 * Rein präsentational, ohne Abhängigkeit auf recharts: für 20 × 6 Pixel wäre
 * eine Chart-Bibliothek Umweg statt Hilfe.
 */
export function Sparkline({
  points,
  className = "h-6 w-20",
  label,
}: {
  points: readonly number[];
  className?: string;
  /** Zugängliche Beschriftung; ohne sie ist die Linie rein dekorativ. */
  label?: string;
}) {
  const enough = points.length >= 2;
  const min = enough ? Math.min(...points) : 0;
  const max = enough ? Math.max(...points) : 1;
  const range = max - min || 1;
  const step = enough ? 100 / (points.length - 1) : 0;
  const y = (v: number) => (22 - ((v - min) / range) * 18 + 1).toFixed(1);
  const coords = enough ? points.map((v, i) => `${(i * step).toFixed(1)},${y(v)}`).join(" ") : "";

  return (
    <svg
      viewBox="0 0 100 24"
      preserveAspectRatio="none"
      className={`${className} shrink-0 overflow-visible text-primary`}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {enough ? (
        <>
          <polyline
            points={coords}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <circle cx={100} cy={y(points[points.length - 1]!)} r={1.8} className="fill-primary" />
        </>
      ) : (
        <line
          x1={0}
          y1={12}
          x2={100}
          y2={12}
          stroke="currentColor"
          strokeWidth={1}
          strokeDasharray="3 3"
          className="text-muted-foreground/40"
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  );
}
