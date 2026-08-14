import { Link } from "@/i18n/navigation";
import { Card } from "@/components/ui/card";
import { SectionLabel } from "@/components/ui/section-label";
import type { PortfolioOverview } from "@/modules/work/server/views/portfolio-overview";
import type { UnitValue } from "@/modules/core/goals/server/views/epic-goal-contributions";

/** Kompakte Zahl (Muster aus der früheren Funding-Kachel), ohne Einheit. */
function compact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${Math.round(n / 1_000)}k`;
  return `${Math.round(n)}`;
}

/** Wert mit dem Einheiten-Label des Top-Ziels (€, %, Stück, …). */
function fmt(unit: string | null, n: number): string {
  return unit ? `${compact(n)} ${unit}` : compact(n);
}

/**
 * Beitragswerte einer Effektart — je Einheit eine Zeile (Plan fett + Ist
 * gedämpft). Top-Ziele können unterschiedliche Einheiten haben; deshalb wird
 * nicht über Einheiten summiert. „—" wenn keine Werte.
 */
function ValueCell({ values }: { values: UnitValue[] }) {
  if (values.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <div className="space-y-1 tabular-nums">
      {values.map((v, i) => (
        <div key={v.unit ?? `u${i}`}>
          <div className="font-medium">{fmt(v.unit, v.planned)}</div>
          <div className="text-xs text-muted-foreground">Ist: {fmt(v.unit, v.realized)}</div>
        </div>
      ))}
    </div>
  );
}

/**
 * „Epic-Beitrag zu Kopf-Zielen" — ersetzt die Funding-Kachel. Listet die Epics
 * nach ihrem berechneten Nutzen-Beitrag an die Top-Ziele (KPI × Conversion die
 * Ziel-Kette hoch), getrennt nach wiederkehrendem und einmaligem Effekt, je
 * Plan + Ist. Absteigend nach Gesamt-Plan sortiert; scrollbar. Server-only.
 */
export function GoalContributionBlock({ data }: { data: PortfolioOverview }) {
  const rows = data.goalContributions;

  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <SectionLabel>Epic-Beitrag zu Kopf-Zielen</SectionLabel>
          <p className="text-xs text-muted-foreground">Plan / Ist</p>
        </div>
        {rows.length > 0 && (
          <span className="font-mono text-xs tabular-nums text-muted-foreground">{rows.length}</span>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Noch keine Epic-Ziel-Beiträge berechnet.{" "}
          <Link href="/ziele" className="text-primary hover:underline">
            Ziele verknüpfen →
          </Link>
        </p>
      ) : (
        <div className="max-h-96 overflow-y-auto rounded-lg border bg-card">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
              <tr className="border-b">
                <th className="px-3 py-2 text-left font-medium">Epic</th>
                <th className="px-3 py-2 text-left font-medium">Wertstrom</th>
                <th className="px-3 py-2 text-right font-medium">
                  Wiederkehrend
                  <span className="block font-normal normal-case">pro Jahr</span>
                </th>
                <th className="px-3 py-2 text-right font-medium">Einmalig</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.epicId} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="px-3 py-2">
                    <Link
                      href={`/portfolio/epics/${r.epicId}`}
                      className="font-medium hover:text-primary hover:underline"
                    >
                      {r.title}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{r.valueStreamName ?? "—"}</td>
                  <td className="px-3 py-2 text-right">
                    <ValueCell values={r.recurring} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <ValueCell values={r.oneTime} />
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
