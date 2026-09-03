import type { PbRoundSnapshot } from "@/modules/budgeting/domain/pb-round-snapshot";
import { formatEUR } from "@/lib/formatting";

const ZONE_LABEL: Record<string, string> = {
  consensus: "Konsens",
  rejection: "Ablehnung",
  spread: "Streuzone",
};
const OUTCOME_LABEL: Record<string, string> = {
  funded: "finanziert",
  rejected: "abgelehnt",
  deferred_with_review: "vertagt",
};

/**
 * PB-Runden-Schicht des eingefrorenen Protokolls (F-C3): Zonen, Entscheidungen,
 * Report-outs und Reserve — so, wie sie beim Erfassen der Revision standen. Rein
 * präsentational; die Daten stammen aus dem `round`-Block der Revision-Payload.
 */
export function PbRoundProtocol({ round }: { round: PbRoundSnapshot }) {
  return (
    <section className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">PB-Runde · Protokoll</h2>
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span>
            Finanziert:{" "}
            <span className="font-medium tabular-nums text-foreground">
              {formatEUR(round.fundedSum)}
            </span>
          </span>
          {round.reserve != null && (
            <span>
              Reserve:{" "}
              <span className="font-medium tabular-nums text-foreground">
                {formatEUR(round.reserve)}
              </span>
            </span>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
              <th className="p-2 font-medium">Epic</th>
              <th className="p-2 text-right font-medium">Kosten</th>
              <th className="p-2 font-medium">Zone</th>
              <th className="p-2 text-right font-medium">Ja/Gesamt</th>
              <th className="p-2 font-medium">Entscheidung</th>
              <th className="p-2 text-center font-medium">Finanziert</th>
            </tr>
          </thead>
          <tbody>
            {round.epics.map((e) => (
              <tr key={e.epicId} className="border-b last:border-b-0">
                <td className="p-2">{e.title}</td>
                <td className="p-2 text-right tabular-nums">{formatEUR(e.cost)}</td>
                <td className="p-2">{ZONE_LABEL[e.zone] ?? e.zone}</td>
                <td className="p-2 text-right tabular-nums">
                  {e.yes}/{e.total}
                </td>
                <td className="p-2">{e.outcome ? (OUTCOME_LABEL[e.outcome] ?? e.outcome) : "—"}</td>
                <td className="p-2 text-center">{e.funded ? "✓" : "—"}</td>
              </tr>
            ))}
            {round.epics.length === 0 && (
              <tr>
                <td colSpan={6} className="p-4 text-center text-muted-foreground">
                  Keine Ballot-Epics im Protokoll.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {round.groups.some((g) => g.reportOut) && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Report-outs
          </h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {round.groups
              .filter((g) => g.reportOut)
              .map((g) => (
                <div key={g.name} className="rounded-md border bg-muted/20 p-3 text-xs">
                  <p className="text-sm font-medium">
                    {g.name}
                    {g.spokesperson && (
                      <span className="ml-1 font-normal text-muted-foreground">
                        · {g.spokesperson}
                      </span>
                    )}
                  </p>
                  <dl className="mt-1 space-y-0.5">
                    {g.reportOut!.costliestYes && (
                      <ReportRow
                        label="Teuerste Zusage"
                        value={g.reportOut!.costliestYes}
                        reason={g.reportOut!.costliestYesReason}
                      />
                    )}
                    {g.reportOut!.clearestNo && (
                      <ReportRow
                        label="Klarstes Nein"
                        value={g.reportOut!.clearestNo}
                        reason={g.reportOut!.clearestNoReason}
                      />
                    )}
                    {g.reportOut!.biggestDispute && (
                      <ReportRow
                        label="Streitpunkt"
                        value={g.reportOut!.biggestDispute}
                        reason={g.reportOut!.disputeReason}
                      />
                    )}
                  </dl>
                </div>
              ))}
          </div>
        </div>
      )}
    </section>
  );
}

function ReportRow({
  label,
  value,
  reason,
}: {
  label: string;
  value: string;
  reason: string | null;
}) {
  return (
    <div className="flex flex-wrap gap-x-2">
      <dt className="text-muted-foreground">{label}:</dt>
      <dd className="font-medium">{value}</dd>
      {reason && <dd className="text-muted-foreground">— {reason}</dd>}
    </div>
  );
}
