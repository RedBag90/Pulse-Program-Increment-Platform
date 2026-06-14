import Link from "next/link";
import type { ZieleTreeTheme } from "@/server/views/ziele-view";
import { isAtRisk, type RollupTrio } from "@/domain/goals-rollup";

/**
 * Strategie als flacher Theme-Tree (Refactor §Hierarchie-Vereinfachung).
 *
 * Zwei Ebenen: **Theme** (OKR-Statement, intern Objective) +
 * **Key Results**. Kein Vision-Layer, kein Strategic-Theme-Layer mehr.
 */
interface Props {
  themes: ZieleTreeTheme[];
  canEdit: boolean;
}

export function StrategyTreeView({ themes, canEdit }: Props) {
  if (themes.length === 0) {
    return <EmptyState canEdit={canEdit} />;
  }

  return (
    <div className="space-y-3">
      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <NewLink entity="theme">+ Theme (OKR)</NewLink>
        </div>
      )}
      <div className="space-y-2">
        {themes.map((t) => (
          <ThemeCard key={t.id} theme={t} canEdit={canEdit} />
        ))}
      </div>
    </div>
  );
}

function NewLink({
  entity,
  parent,
  children,
}: {
  entity: "theme" | "kr";
  parent?: string;
  children: React.ReactNode;
}) {
  const href = `/strategy?entity=${entity}&new=1${parent ? `&parent=${parent}` : ""}`;
  return (
    <Link
      href={href as never}
      scroll={false}
      className="inline-flex items-center rounded-md border border-dashed bg-card px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted/40 hover:text-foreground"
    >
      {children}
    </Link>
  );
}

function EditLink({
  entity,
  id,
  className,
  children,
}: {
  entity: "theme" | "kr";
  id: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={`/strategy?entity=${entity}&id=${id}` as never}
      scroll={false}
      className={
        className ??
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
      }
    >
      {children}
    </Link>
  );
}

function ThemeCard({ theme, canEdit }: { theme: ZieleTreeTheme; canEdit: boolean }) {
  const atRisk = isAtRisk(theme.trio);
  return (
    <details className="group rounded-lg border bg-card shadow-sm open:shadow-md">
      <summary className="flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/30">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{theme.title}</p>
          {theme.narrative && (
            <p className="line-clamp-1 text-[11px] text-muted-foreground">{theme.narrative}</p>
          )}
        </div>
        {theme.period && (
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
            {theme.period}
          </span>
        )}
        {theme.confidence != null && (
          <span className="text-[11px] text-muted-foreground">
            {"★".repeat(theme.confidence)}
            {"☆".repeat(5 - theme.confidence)}
          </span>
        )}
        <span className="text-[11px] text-muted-foreground">{theme.keyResults.length} KR</span>
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
        {canEdit && (
          <div className="flex flex-wrap gap-2 pb-1">
            <EditLink entity="theme" id={theme.id}>
              Theme bearbeiten
            </EditLink>
            <NewLink entity="kr" parent={theme.id}>
              + Key Result
            </NewLink>
          </div>
        )}
        {theme.keyResults.length === 0 ? (
          <p className="text-xs text-muted-foreground">Noch keine Key Results.</p>
        ) : (
          <ul className="space-y-1.5">
            {theme.keyResults.map((kr) => (
              <li key={kr.id} className="flex items-center gap-3 text-xs">
                <span className="min-w-0 flex-1 truncate">{kr.title}</span>
                <KrAchievementBar kr={kr} />
                <TrioBadge trio={kr.trio} compact />
                {canEdit && (
                  <EditLink
                    entity="kr"
                    id={kr.id}
                    className="text-[11px] text-muted-foreground hover:text-foreground hover:underline"
                  >
                    ✎
                  </EditLink>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
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

function EmptyState({ canEdit }: { canEdit: boolean }) {
  return (
    <div className="grid h-[300px] place-items-center rounded-lg border bg-muted/10">
      <div className="max-w-md text-center">
        <p className="font-medium">Noch keine Strategie definiert.</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Leg ein Theme (OKR-Statement) an und haeng Key Results dran.
        </p>
        {canEdit && (
          <div className="mt-4 flex justify-center">
            <NewLink entity="theme">+ Theme anlegen</NewLink>
          </div>
        )}
      </div>
    </div>
  );
}
