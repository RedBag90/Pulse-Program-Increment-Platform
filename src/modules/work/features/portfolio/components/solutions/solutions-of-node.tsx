import { Link } from "@/i18n/navigation";
import { HorizonBadge } from "@/modules/work/features/portfolio/components/horizon-badge";
import { nodeHref } from "@/modules/core/org/features/structure/components/structure-routes";
import { formatCompactEUR } from "@/lib/formatting";
import type { SolutionListRow } from "@/modules/work/server/views/solutions-list";

/**
 * Die Solutions eines Knotens — am Wertstrom alle seine, am ART die ihm
 * zugewiesenen.
 *
 * Bewusst eine schlanke Tabelle statt der vollen Listen-Fläche: hier geht es um
 * „was hängt an diesem Knoten", nicht um den Vergleich über Wertströme hinweg.
 * Den leistet die flache Liste unter `/structure/solutions`.
 */
export function SolutionsOfNode({
  rows,
  emptyText,
  showArt = true,
}: {
  rows: SolutionListRow[];
  emptyText: string;
  showArt?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
          <tr className="border-b">
            <th className="px-3 py-2 text-left font-medium">Solution</th>
            <th className="px-3 py-2 text-left font-medium">Horizont</th>
            {showArt && <th className="px-3 py-2 text-left font-medium">ART</th>}
            <th className="px-3 py-2 text-right font-medium">Grow</th>
            <th className="px-3 py-2 text-right font-medium">Epics</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b last:border-0 hover:bg-muted/20">
              <td className="px-3 py-2">
                <Link
                  href={nodeHref("solution", r.id)}
                  className="font-medium hover:text-primary hover:underline"
                >
                  {r.name}
                </Link>
              </td>
              <td className="px-3 py-2">
                <HorizonBadge horizon={r.horizon} />
              </td>
              {showArt && (
                <td className="px-3 py-2 text-muted-foreground">
                  {r.artName ?? <span className="text-xs">keinem zugewiesen</span>}
                </td>
              )}
              <td className="px-3 py-2 text-right tabular-nums">{formatCompactEUR(r.grow)}</td>
              <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                {r.epicCount}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
