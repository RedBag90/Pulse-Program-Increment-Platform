import Link from "next/link";
import type { EpicGoalContributions } from "@/server/views/epic-goal-contributions";

/**
 * Cross-Modul-Goal-Badge — flach (Refactor §Hierarchie-Vereinfachung).
 *
 * Pro KR der €-Beitrag, der aus den KPIs dieses Epics einfliesst. Das
 * Parent-Theme (= Objective im Schema) wird als Label gezeigt.
 *
 * Read-only — bearbeitet wird im Strategie-Modul.
 */
interface Props {
  contributions: EpicGoalContributions;
}

export function EpicGoalsBadge({ contributions }: Props) {
  const { krContributions } = contributions;
  if (krContributions.length === 0) return null;

  return (
    <section className="space-y-3 rounded-lg border bg-card p-4">
      <header className="flex items-baseline justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Strategische Beitraege
        </h3>
        <Link
          href={"/ziele" as never}
          className="text-[11px] text-muted-foreground hover:text-foreground hover:underline"
        >
          → Ziele-Modul
        </Link>
      </header>

      <ul className="space-y-1.5">
        {krContributions.map((c) => (
          <li
            key={c.krId}
            className="flex items-center gap-3 rounded-md border bg-muted/20 px-2 py-1.5 text-xs"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{c.krTitle}</p>
              <p className="truncate text-[10px] text-muted-foreground">{c.themeTitle}</p>
            </div>
            <span className="tabular-nums text-[11px]">
              <span className="font-medium">€{formatEur(c.contributionRealized)}</span>
              {c.krPlanned > 0 && (
                <span className="text-muted-foreground"> / €{formatEur(c.krPlanned)}</span>
              )}
            </span>
            <Link
              href={`/ziele?entity=kr&id=${c.krId}` as never}
              className="text-[10px] text-muted-foreground hover:text-foreground hover:underline"
              title="Im Strategie-Modul oeffnen"
            >
              →
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function formatEur(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return Math.round(n).toLocaleString("de-DE");
}
