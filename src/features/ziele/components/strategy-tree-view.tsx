import type { ZieleTreeTheme, ZieleTreeVision } from "@/server/views/ziele-view";
import { isAtRisk, type RollupTrio } from "@/domain/goals-rollup";

/**
 * Strategy-Map · Tree-Layout (Konzept §4.1 / V1). Read-only Skelett:
 * Vision-Karten oben, Themes gruppiert nach kind (business / enabler),
 * Themes klappbar zu Objectives + Key Results. Edit-Affordances kommen
 * mit den Folge-Phasen (P3 OKR-Board / P4 Money / P5 Pflege); diese
 * Sicht ist die hierarchische Default-Sicht.
 */
interface Props {
  visions: ZieleTreeVision[];
  themes: ZieleTreeTheme[];
}

export function StrategyTreeView({ visions, themes }: Props) {
  if (visions.length === 0 && themes.length === 0) {
    return <EmptyState />;
  }

  const businessThemes = themes.filter((t) => t.kind === "business");
  const enablerThemes = themes.filter((t) => t.kind === "enabler");

  return (
    <div className="space-y-6">
      {visions.length > 0 && (
        <section className="space-y-3">
          {visions.map((v) => (
            <VisionCard key={v.id} vision={v} />
          ))}
        </section>
      )}

      {businessThemes.length > 0 && (
        <ThemeGroup label="Strategic Themes · Business" themes={businessThemes} />
      )}
      {enablerThemes.length > 0 && (
        <ThemeGroup label="Strategic Themes · Enabler" themes={enablerThemes} />
      )}
    </div>
  );
}

function VisionCard({ vision }: { vision: ZieleTreeVision }) {
  const label = vision.scope === "tenant" ? "Tenant" : `VS · ${vision.valueStreamName ?? "?"}`;
  const horizonLabel = `${vision.horizonStart.getUTCFullYear()} — ${vision.horizonEnd.getUTCFullYear()}`;
  return (
    <article className="rounded-lg border bg-gradient-to-b from-muted/30 to-muted/10 p-4 shadow-sm">
      <header className="flex items-baseline justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Vision · {label}
        </p>
        <span className="text-[11px] text-muted-foreground">Horizont {horizonLabel}</span>
      </header>
      <h2 className="mt-1 font-heading text-xl font-semibold tracking-tight">{vision.title}</h2>
      {vision.narrative && (
        <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{vision.narrative}</p>
      )}
      <div className="mt-3">
        <TrioBadge trio={vision.trio} />
      </div>
    </article>
  );
}

function ThemeGroup({ label, themes }: { label: string; themes: ZieleTreeTheme[] }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </h3>
      <div className="space-y-2">
        {themes.map((t) => (
          <ThemeCard key={t.id} theme={t} />
        ))}
      </div>
    </section>
  );
}

function ThemeCard({ theme }: { theme: ZieleTreeTheme }) {
  const atRisk = isAtRisk(theme.trio);
  return (
    <details className="group rounded-lg border bg-card shadow-sm open:shadow-md">
      <summary className="flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/30">
        <span
          aria-hidden
          className="size-3 shrink-0 rounded-sm"
          style={{ backgroundColor: theme.color }}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{theme.title}</p>
          {theme.narrative && (
            <p className="line-clamp-1 text-[11px] text-muted-foreground">{theme.narrative}</p>
          )}
        </div>
        <span className="text-[11px] text-muted-foreground">
          {theme.objectives.length} OKR · {theme.directEpicCount} Epic
        </span>
        <TrioBadge trio={theme.trio} />
        {atRisk && (
          <span
            className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-800"
            title="Run-Rate < 70 % vom Planned"
          >
            ⚠
          </span>
        )}
      </summary>
      <div className="space-y-2 border-t bg-muted/10 px-4 py-3">
        {theme.objectives.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Noch keine OKRs in diesem Quartal angelegt.
          </p>
        ) : (
          theme.objectives.map((o) => <ObjectiveRow key={o.id} objective={o} />)
        )}
      </div>
    </details>
  );
}

function ObjectiveRow({
  objective,
}: {
  objective: {
    id: string;
    title: string;
    period: string | null;
    confidence: number | null;
    status: string;
    keyResults: ReadonlyArray<{
      id: string;
      title: string;
      trio: RollupTrio;
      baseline: number | null;
      target: number | null;
      current: number | null;
      formula: string;
    }>;
    trio: RollupTrio;
  };
}) {
  const atRisk = isAtRisk(objective.trio);
  return (
    <details className="rounded-md border bg-background">
      <summary className="flex cursor-pointer items-center gap-3 px-3 py-2 transition-colors hover:bg-muted/30">
        <span className="text-xs font-medium">{objective.title}</span>
        {objective.period && (
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
            {objective.period}
          </span>
        )}
        {objective.confidence != null && (
          <span className="text-[11px] text-muted-foreground">
            {"★".repeat(objective.confidence)}
            {"☆".repeat(5 - objective.confidence)}
          </span>
        )}
        <span className="ml-auto">
          <TrioBadge trio={objective.trio} compact />
        </span>
        {atRisk && (
          <span
            className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-800"
            title="Run-Rate < 70 % vom Planned"
          >
            ⚠
          </span>
        )}
      </summary>
      <ul className="space-y-1.5 border-t px-3 py-2">
        {objective.keyResults.length === 0 ? (
          <li className="text-[11px] text-muted-foreground">Keine Key Results.</li>
        ) : (
          objective.keyResults.map((kr) => (
            <li key={kr.id} className="flex items-center gap-3 text-xs">
              <span className="min-w-0 flex-1 truncate">{kr.title}</span>
              <KrAchievementBar kr={kr} />
              <TrioBadge trio={kr.trio} compact />
            </li>
          ))
        )}
      </ul>
    </details>
  );
}

function KrAchievementBar({
  kr,
}: {
  kr: { baseline: number | null; target: number | null; current: number | null; formula: string };
}) {
  if (kr.baseline === null || kr.target === null || kr.current === null) {
    return (
      <span className="text-[10px] text-muted-foreground/70">
        {kr.formula === "manual" ? "manuell" : "—"}
      </span>
    );
  }
  const span = kr.target - kr.baseline;
  const pct = span === 0 ? 0 : Math.max(0, Math.min(1, (kr.current - kr.baseline) / span));
  const slots = 8;
  const filled = Math.round(pct * slots);
  return (
    <span className="font-mono text-[10px] text-muted-foreground" aria-hidden>
      {"●".repeat(filled)}
      {"○".repeat(slots - filled)} {Math.round(pct * 100)}%
    </span>
  );
}

function TrioBadge({ trio, compact = false }: { trio: RollupTrio; compact?: boolean }) {
  if (trio.planned === 0 && trio.realized === 0) {
    return <span className="text-[10px] text-muted-foreground/60">—</span>;
  }
  const planned = formatEuro(trio.planned, compact);
  const realized = formatEuro(trio.realized, compact);
  return (
    <span
      className="rounded-md border bg-card px-1.5 py-0.5 text-[11px] tabular-nums text-foreground"
      title={`Planned ${formatEuro(trio.planned)} · Realized ${formatEuro(trio.realized)} · Run-Rate ${formatEuro(trio.runRate)}`}
    >
      {planned} / {realized}
    </span>
  );
}

function formatEuro(n: number, compact = false): string {
  if (compact && Math.abs(n) >= 1_000_000) return `€${(n / 1_000_000).toFixed(1)}M`;
  if (compact && Math.abs(n) >= 1_000) return `€${(n / 1_000).toFixed(0)}K`;
  return `€${Math.round(n).toLocaleString("de-DE")}`;
}

function EmptyState() {
  return (
    <div className="grid h-[300px] place-items-center rounded-lg border bg-muted/10">
      <div className="max-w-md text-center">
        <p className="font-medium">Noch keine Strategie definiert.</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Starte mit einer Vision und leite daraus Strategic Themes ab.
        </p>
        <p className="mt-1 text-xs text-muted-foreground/80">
          (Editor folgt mit der naechsten Phase.)
        </p>
      </div>
    </div>
  );
}
