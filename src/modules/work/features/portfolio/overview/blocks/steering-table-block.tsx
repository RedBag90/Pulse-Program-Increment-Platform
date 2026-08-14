import { Link } from "@/i18n/navigation";
import { Card } from "@/components/ui/card";
import { SectionLabel } from "@/components/ui/section-label";
import { STATUS_LABELS } from "@/components/detail/initiative-labels";
import {
  STAGE_GATE_LABEL,
  type PortfolioOverview,
} from "@/modules/work/server/views/portfolio-overview";

/**
 * „Zur Steuerung markiert" — Tabelle der Initiativen (Epics) mit
 * `needsSteeringAttention` (fürs nächste Steering-Meeting vorgemerkt). Volle
 * Breite unter der Feature-Sektion; sortiert nach längster Zeit ohne Update
 * (Agenda-Reihenfolge). Server-only.
 */
export function SteeringTableBlock({ data }: { data: PortfolioOverview }) {
  const rows = data.steeringEpics;

  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <SectionLabel>Zur Steuerung markiert</SectionLabel>
        {rows.length > 0 && (
          <span className="font-mono text-xs tabular-nums text-muted-foreground">{rows.length}</span>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Keine Initiative für das nächste Steering-Meeting markiert.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
              <tr className="border-b">
                <th className="px-3 py-2 text-left font-medium">Titel</th>
                <th className="px-3 py-2 text-left font-medium">Stage Gate</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-left font-medium">Owner</th>
                <th className="px-3 py-2 text-left font-medium">Wertstrom</th>
                <th className="px-3 py-2 text-right font-medium">Tage seit Update</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="px-3 py-2">
                    <Link
                      href={`/portfolio/epics/${r.id}`}
                      className="font-medium hover:text-primary hover:underline"
                    >
                      {r.title}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {STAGE_GATE_LABEL[r.stageGate]}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {STATUS_LABELS[r.status] ?? r.status}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{r.ownerName ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.valueStreamName ?? "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {r.daysSinceUpdate}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
