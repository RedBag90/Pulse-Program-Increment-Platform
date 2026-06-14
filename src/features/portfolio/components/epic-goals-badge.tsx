import Link from "next/link";
import type { EpicGoalContributions } from "@/server/views/epic-goal-contributions";

/**
 * Cross-Modul-Goal-Badge (Konzept V10). Im Epic-Overview unter den
 * Summary-Cards rendert die Karte „Strategische Beitraege": welche
 * Strategic Themes das Epic direkt erfuellt, plus pro Key Result der
 * €-Beitrag, der aus den KPIs dieses Epics einfliesst.
 *
 * Read-only — bearbeitet wird im Ziele-Modul (`/ziele?entity=…`).
 */
interface Props {
  contributions: EpicGoalContributions;
}

export function EpicGoalsBadge({ contributions }: Props) {
  const { directThemes, krContributions } = contributions;
  if (directThemes.length === 0 && krContributions.length === 0) return null;

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

      {directThemes.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] uppercase text-muted-foreground">Themes</span>
          {directThemes.map((t) => (
            <Link
              key={t.id}
              href={`/ziele?entity=theme&id=${t.id}` as never}
              className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2 py-0.5 text-[11px] hover:bg-muted"
            >
              <span
                aria-hidden
                className="size-2 rounded-sm"
                style={{ backgroundColor: t.color }}
              />
              {t.title}
            </Link>
          ))}
        </div>
      )}

      {krContributions.length > 0 && (
        <ul className="space-y-1.5">
          {krContributions.map((c) => (
            <li
              key={c.krId}
              className="flex items-center gap-3 rounded-md border bg-muted/20 px-2 py-1.5 text-xs"
            >
              <span
                aria-hidden
                className="size-2 rounded-sm"
                style={{ backgroundColor: c.themeColor }}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{c.krTitle}</p>
                <p className="truncate text-[10px] text-muted-foreground">
                  {c.themeTitle} · {c.objectiveTitle}
                </p>
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
                title="Im Ziele-Modul oeffnen"
              >
                →
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function formatEur(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return Math.round(n).toLocaleString("de-DE");
}
