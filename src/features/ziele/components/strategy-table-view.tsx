import Link from "next/link";
import { ChevronRight, Pencil, Plus } from "lucide-react";
import type { ZieleTreeKeyResult, ZieleTreeTheme } from "@/server/views/ziele-view";
import { isAtRisk, type RollupTrio } from "@/domain/goals-rollup";

/**
 * Strategie als hierarchische Tabelle — Default-Layout im Strategie-Tab.
 *
 * Zwei Ebenen: **Theme** (OKR-Statement) + **Key Results**. Spalten:
 * `# · Name (incl. Narrativ + Confidence + Drift) · Status · Progress ·
 * €-Trio · Time period · Aktionen`. Edit-Affordances erscheinen nur
 * wenn `canEdit=true` (Strategie-Modul); im Ziele-Modul ist die Sicht
 * read-only.
 */
interface Props {
  themes: ZieleTreeTheme[];
  canEdit: boolean;
}

export function StrategyTableView({ themes, canEdit }: Props) {
  if (themes.length === 0) {
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

  return (
    <div className="space-y-3">
      {canEdit && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] text-muted-foreground">
            Klick auf eine Zeile oeffnet den Editor.
          </p>
          <NewLink entity="theme">+ Theme (OKR)</NewLink>
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <Th className="w-10">#</Th>
              <Th>Name</Th>
              <Th className="w-32">Status</Th>
              <Th className="w-48">Progress</Th>
              <Th className="w-40">€ Planned / Realized</Th>
              <Th className="w-28">Time period</Th>
              {canEdit && <Th className="w-24">Aktionen</Th>}
            </tr>
          </thead>
          <tbody className="divide-y">
            {themes.map((t, ti) => (
              <ThemeBlock key={t.id} index={ti + 1} theme={t} canEdit={canEdit} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ThemeBlock({
  index,
  theme,
  canEdit,
}: {
  index: number;
  theme: ZieleTreeTheme;
  canEdit: boolean;
}) {
  return (
    <>
      <Row
        depth={0}
        index={index}
        title={theme.title}
        subtitle="Theme (OKR)"
        narrative={theme.narrative}
        confidence={theme.confidence}
        drift={isAtRisk(theme.trio)}
        href={`/strategy?entity=theme&id=${theme.id}`}
        status={statusForTheme(theme)}
        progress={trioProgress(theme.trio)}
        trio={theme.trio}
        period={theme.period}
        canEdit={canEdit}
        actions={
          canEdit ? (
            <RowActions
              editHref={`/strategy?entity=theme&id=${theme.id}`}
              addHref={`/strategy?entity=kr&new=1&parent=${theme.id}`}
              addLabel="Key Result hinzufuegen"
            />
          ) : null
        }
      />
      {theme.keyResults.map((kr, ki) => (
        <KrRow key={kr.id} index={ki + 1} kr={kr} parentDepth={1} canEdit={canEdit} />
      ))}
    </>
  );
}

function KrRow({
  index,
  kr,
  parentDepth,
  canEdit,
}: {
  index: number;
  kr: ZieleTreeKeyResult;
  parentDepth: number;
  canEdit: boolean;
}) {
  const prog = krProgress(kr);
  return (
    <Row
      depth={parentDepth}
      index={index}
      title={kr.title}
      subtitle="Key Result"
      narrative={null}
      confidence={null}
      drift={kr.trio.planned > 0 && kr.trio.realized / kr.trio.planned < 0.7}
      href={`/strategy?entity=kr&id=${kr.id}`}
      status={statusForKr(kr, prog)}
      progress={prog}
      trio={kr.trio}
      period={null}
      canEdit={canEdit}
      actions={
        canEdit ? (
          <RowActions editHref={`/strategy?entity=kr&id=${kr.id}`} addHref={null} addLabel="" />
        ) : null
      }
    />
  );
}

interface RowProps {
  depth: number;
  index: number;
  title: string;
  subtitle: string;
  narrative: string | null;
  confidence: number | null;
  drift: boolean;
  href: string;
  status: StatusSpec;
  progress: number;
  trio: RollupTrio;
  period: string | null;
  canEdit: boolean;
  actions: React.ReactNode;
}

function Row({
  depth,
  index,
  title,
  subtitle,
  narrative,
  confidence,
  drift,
  href,
  status,
  progress,
  trio,
  period,
  canEdit,
  actions,
}: RowProps) {
  const indent = depth * 20 + 8;
  return (
    <tr className="group hover:bg-muted/30">
      <Td className="text-[10px] text-muted-foreground tabular-nums">{index}</Td>
      <Td>
        <Link
          href={href as never}
          scroll={false}
          className="block hover:underline"
          style={{ paddingLeft: indent }}
        >
          <span className="flex items-center gap-2">
            {depth > 0 && (
              <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
            )}
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="truncate font-medium">{title}</span>
                {drift && (
                  <span
                    className="shrink-0 rounded-full bg-amber-100 px-1 py-0.5 text-[9px] font-semibold text-amber-800"
                    title="Run-Rate < 70 % vom Planned"
                  >
                    ⚠
                  </span>
                )}
                {confidence != null && (
                  <span
                    className="shrink-0 text-[11px] text-muted-foreground"
                    title="Confidence (Fist-of-Five)"
                  >
                    {"★".repeat(confidence)}
                    {"☆".repeat(5 - confidence)}
                  </span>
                )}
              </span>
              <span className="block truncate text-[10px] uppercase tracking-wider text-muted-foreground">
                {subtitle}
              </span>
              {narrative && (
                <span className="block truncate text-[10px] text-muted-foreground/80">
                  {narrative}
                </span>
              )}
            </span>
          </span>
        </Link>
      </Td>
      <Td>
        <StatusPill status={status} />
      </Td>
      <Td>
        <ProgressBar value={progress} />
      </Td>
      <Td>
        <TrioBadge trio={trio} />
      </Td>
      <Td className="text-xs text-muted-foreground">{period ?? "—"}</Td>
      {canEdit && <Td>{actions}</Td>}
    </tr>
  );
}

function RowActions({
  editHref,
  addHref,
  addLabel,
}: {
  editHref: string;
  addHref: string | null;
  addLabel: string;
}) {
  return (
    <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100">
      {addHref && (
        <Link
          href={addHref as never}
          scroll={false}
          className="grid size-7 place-items-center rounded-md border bg-card hover:bg-muted"
          title={addLabel}
          aria-label={addLabel}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
        </Link>
      )}
      <Link
        href={editHref as never}
        scroll={false}
        className="grid size-7 place-items-center rounded-md border bg-card hover:bg-muted"
        title="Bearbeiten"
        aria-label="Bearbeiten"
      >
        <Pencil className="h-3.5 w-3.5" aria-hidden />
      </Link>
    </div>
  );
}

function NewLink({ entity, children }: { entity: "theme"; children: React.ReactNode }) {
  return (
    <Link
      href={`/strategy?entity=${entity}&new=1` as never}
      scroll={false}
      className="inline-flex items-center gap-1 rounded-md border border-dashed bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted/40 hover:text-foreground"
    >
      <Plus className="h-3 w-3" aria-hidden />
      {children}
    </Link>
  );
}

// ── Status + Progress + €-Trio ───────────────────────────────────────

type StatusTier = "achieved" | "on-track" | "at-risk" | "off-track" | "draft" | "neutral";
interface StatusSpec {
  tier: StatusTier;
  label: string;
}

function statusForTheme(t: ZieleTreeTheme): StatusSpec {
  switch (t.status) {
    case "achieved":
      return { tier: "achieved", label: "Achieved" };
    case "missed":
      return { tier: "off-track", label: "Missed" };
    case "stretched":
      return { tier: "on-track", label: "Stretched" };
    case "cancelled":
      return { tier: "neutral", label: "Cancelled" };
    case "draft":
      return { tier: "draft", label: "Draft" };
  }
  return isAtRisk(t.trio)
    ? { tier: "at-risk", label: "At risk" }
    : { tier: "on-track", label: "On track" };
}

function statusForKr(kr: ZieleTreeKeyResult, progress: number): StatusSpec {
  if (progress >= 1) return { tier: "achieved", label: "Achieved" };
  if (progress >= 0.7) return { tier: "on-track", label: "On track" };
  if (progress > 0) return { tier: "at-risk", label: "At risk" };
  if (kr.baseline == null || kr.target == null) return { tier: "draft", label: "No baseline" };
  return { tier: "off-track", label: "Off track" };
}

function trioProgress(trio: RollupTrio): number {
  if (trio.planned <= 0) return 0;
  return Math.max(0, Math.min(1, trio.realized / trio.planned));
}

function krProgress(kr: ZieleTreeKeyResult): number {
  if (kr.baseline == null || kr.target == null || kr.current == null) return 0;
  const span = kr.target - kr.baseline;
  if (span === 0) return kr.current === kr.target ? 1 : 0;
  return Math.max(0, Math.min(1, (kr.current - kr.baseline) / span));
}

function StatusPill({ status }: { status: StatusSpec }) {
  const cls =
    status.tier === "achieved"
      ? "bg-emerald-100 text-emerald-800"
      : status.tier === "on-track"
        ? "bg-emerald-50 text-emerald-700"
        : status.tier === "at-risk"
          ? "bg-amber-100 text-amber-800"
          : status.tier === "off-track"
            ? "bg-rose-100 text-rose-800"
            : status.tier === "draft"
              ? "bg-slate-100 text-slate-700"
              : "bg-muted text-muted-foreground";
  const dot =
    status.tier === "achieved" || status.tier === "on-track"
      ? "bg-emerald-500"
      : status.tier === "at-risk"
        ? "bg-amber-500"
        : status.tier === "off-track"
          ? "bg-rose-500"
          : "bg-slate-400";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] ${cls}`}
    >
      <span aria-hidden className={`size-1.5 rounded-full ${dot}`} />
      {status.label}
    </span>
  );
}

function ProgressBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${
            value >= 0.7 ? "bg-emerald-500/80" : value >= 0.3 ? "bg-amber-500/80" : "bg-rose-500/80"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
        {pct} %
      </span>
    </div>
  );
}

function TrioBadge({ trio }: { trio: RollupTrio }) {
  if (trio.planned === 0 && trio.realized === 0) {
    return <span className="text-[10px] text-muted-foreground/60">—</span>;
  }
  return (
    <span
      className="inline-block rounded-md border bg-background px-1.5 py-0.5 text-[11px] tabular-nums"
      title={`Planned €${Math.round(trio.planned).toLocaleString("de-DE")} · Realized €${Math.round(trio.realized).toLocaleString("de-DE")} · Run-Rate €${Math.round(trio.runRate).toLocaleString("de-DE")}`}
    >
      €{compact(trio.planned)} / €{compact(trio.realized)}
    </span>
  );
}

function compact(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return Math.round(n).toLocaleString("de-DE");
}

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <th className={`px-3 py-2 text-left ${className ?? ""}`}>{children}</th>;
}

function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 align-middle ${className ?? ""}`}>{children}</td>;
}
