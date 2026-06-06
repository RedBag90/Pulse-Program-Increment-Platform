import { Compass } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { RtePortfolioModel, RtePortfolioRow } from "@/server/views/rte-cockpit";

interface Props {
  model: RtePortfolioModel;
}

const RAG_DOT: Record<RtePortfolioRow["rag"], string> = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  muted: "bg-muted-foreground/30",
};

const RAG_LABEL: Record<RtePortfolioRow["rag"], string> = {
  green: "Grün",
  amber: "Gelb",
  red: "Rot",
  muted: "—",
};

/**
 * Portfolio-Sicht für RTEs / LACE / Admins mit Sicht auf mehrere ARTs.
 * Eine Zeile pro ART mit denselben Roll-up-Zahlen wie die ART-Karten;
 * Klick führt in den ART-Cockpit `/rte/<artId>`.
 */
export function RtePortfolioShell({ model }: Props) {
  return (
    <main className="space-y-6 p-6 md:p-8">
      <header className="rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <Compass className="size-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold">RTE-Cockpit</h1>
            <p className="text-sm text-muted-foreground">
              Wähle einen ART aus — oder behalte die Portfolio-Sicht für den Cross-ART-Überblick.
            </p>
          </div>
        </div>
      </header>

      {model.arts.length === 0 ? (
        <div className="rounded-2xl border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
          Keine ARTs im Zugriff.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pl-4 pr-2">ART</th>
                <th className="py-2 pr-3">Aktive PI</th>
                <th className="py-2 pr-3">RAG</th>
                <th className="py-2 pr-3 text-right">Teams</th>
                <th className="py-2 pr-3 text-right">Approvals</th>
                <th className="py-2 pr-3 text-right">Eskaliert</th>
                <th className="py-2 pr-4 text-right">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {model.arts.map((a) => (
                <tr key={a.artId} className="border-b last:border-b-0 hover:bg-muted/30">
                  <td className="py-3 pl-4 pr-2 font-medium">
                    <Link href={`/rte/${a.artId}`} className="text-primary hover:underline">
                      {a.artName}
                    </Link>
                  </td>
                  <td className="py-3 pr-3 text-muted-foreground">{a.activePiName ?? "—"}</td>
                  <td className="py-3 pr-3">
                    <span className="inline-flex items-center gap-1.5 text-xs">
                      <span className={`size-2 rounded-full ${RAG_DOT[a.rag]}`} />
                      <span className="text-muted-foreground">{RAG_LABEL[a.rag]}</span>
                    </span>
                  </td>
                  <td className="py-3 pr-3 text-right tabular-nums">{a.teamCount}</td>
                  <td className="py-3 pr-3 text-right tabular-nums">{a.openApprovals}</td>
                  <td className="py-3 pr-3 text-right tabular-nums">{a.escalatedImpediments}</td>
                  <td className="py-3 pr-4 text-right tabular-nums">
                    {a.confidenceAvg != null ? a.confidenceAvg.toFixed(1) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
