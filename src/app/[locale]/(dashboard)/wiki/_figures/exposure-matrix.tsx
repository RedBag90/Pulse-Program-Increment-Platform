// Die Figur erklaert die Skala und benutzt deshalb **dieselbe**: Stufen,
// Schwellen, Baender, Woerter und Farben kommen aus dem Kernel. Sie hatte bis
// September 2026 eigene Tabellen — mit eigenen Woertern („sehr gering" gegen
// „Sehr niedrig"), also einer Erklaerung, die etwas anderes sagte als die Sache.
import {
  RISK_LEVELS,
  BAND_THRESHOLDS,
  EXPOSURE_LABEL,
  EXPOSURE_TONE,
  LEVEL_LABEL,
  riskExposure,
} from "@/modules/core/kernel/domain/exposure";

/**
 * **Die Exposure als 5×5-Gitter** — jede Zelle fragt `riskExposure`, also
 * dieselbe Funktion, die auch die Zeile in der Liste und die Zelle in der
 * Matrix faerbt.
 *
 * Deshalb steht hier keine Schwellen-Tabelle daneben, die veralten koennte:
 * die Baender **entstehen** aus `BAND_THRESHOLDS`, und wer sie im Code
 * verschiebt, verschiebt sie hier mit.
 */
export function ExposureMatrix() {
  // Wahrscheinlichkeit von oben nach unten absteigend — wie in der Matrix.
  const rows = [...RISK_LEVELS].reverse();
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg bg-card shadow-card p-3">
        <table className="min-w-[420px] border-separate border-spacing-1 text-center text-xs">
          <thead>
            <tr>
              <th className="w-28" />
              {RISK_LEVELS.map((i) => (
                <th
                  key={i}
                  className="px-1 pb-1 font-mono text-label font-normal uppercase tracking-[0.1em] text-muted-foreground"
                >
                  {LEVEL_LABEL[i]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p}>
                <th className="pr-2 text-right font-mono text-label font-normal uppercase tracking-[0.1em] text-muted-foreground">
                  {LEVEL_LABEL[p]}
                </th>
                {RISK_LEVELS.map((i) => {
                  const e = riskExposure(p, i);
                  return (
                    <td
                      key={i}
                      className={`rounded-sm px-2 py-2 font-medium tabular-nums ${EXPOSURE_TONE[e.band].badge}`}
                      title={EXPOSURE_LABEL[e.band]}
                    >
                      {e.score}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="font-mono text-meta uppercase tracking-wider">Bänder</span>
        {BAND_THRESHOLDS.map((t) => (
          <span key={t.band} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className={`inline-block size-2.5 rounded-sm ${EXPOSURE_TONE[t.band].badge}`}
            />
            {EXPOSURE_LABEL[t.band]} <span className="tabular-nums">≤ {t.max}</span>
          </span>
        ))}
      </p>
    </div>
  );
}
