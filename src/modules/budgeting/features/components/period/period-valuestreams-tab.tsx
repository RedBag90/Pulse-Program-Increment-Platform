import { Fragment } from "react";
import { formatEUR } from "@/lib/formatting";
import type { PeriodValueStreamsModel } from "@/modules/budgeting/server/views/period-valuestreams";

/**
 * VS-/ART-/RtB-Budget-Tab: je Value Stream = Run the Business (RtB) + Change the
 * Business (Epics, nach ART geschachtelt), abgeleitet aus der finalen Verteilung.
 * Rein präsentational.
 */
export function PeriodValueStreamsTab({ model }: { model: PeriodValueStreamsModel }) {
  if (model.rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Noch keine abgeleiteten Budgets — die Kachel ist noch nicht finalisiert.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Abgeleitet aus der tatsächlichen (finalen) Verteilung. VS-Budget = Run the Business +
        Change the Business (Epics nach ART).
      </p>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
              <th className="px-3 py-2 text-left font-medium">Value Stream / Aufschlüsselung</th>
              <th className="px-3 py-2 text-right font-medium">Σ Budget</th>
            </tr>
          </thead>
          <tbody>
            {model.rows.map((vs) => (
              <Fragment key={vs.valueStreamId ?? "none"}>
                <tr className="border-b bg-muted/20">
                  <td className="px-3 py-2 font-medium">{vs.valueStreamName}</td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums">{formatEUR(vs.total)}</td>
                </tr>
                {vs.runTotal > 0 && (
                  <tr className="border-b">
                    <td className="px-3 py-1.5 pl-8 text-muted-foreground">
                      <span className="text-amber-700">Run the Business</span>
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{formatEUR(vs.runTotal)}</td>
                  </tr>
                )}
                {vs.arts.map((art) => (
                  <tr key={art.artId ?? "noart"} className="border-b">
                    <td className="px-3 py-1.5 pl-8 text-muted-foreground">ART {art.artName}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{formatEUR(art.total)}</td>
                  </tr>
                ))}
              </Fragment>
            ))}
            <tr className="border-t bg-muted/40 font-medium">
              <td className="px-3 py-2">Σ gesamt</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatEUR(model.grandTotal)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
