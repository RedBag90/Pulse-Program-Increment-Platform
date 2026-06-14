import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ZieleTreeKeyResult, ZieleTreeTheme } from "@/server/views/ziele-view";
import { isAtRisk, type RollupTrio } from "@/domain/goals-rollup";

/**
 * Strategie als flache hierarchische Tabelle (Refactor §Hierarchie-
 * Vereinfachung).
 *
 * Zwei Ebenen: **Theme** (OKR-Statement) + **Key Results**. Spalten:
 * # · Name · Status · Progress · Time period. Jede Zeile deeplinkt
 * nach `/strategy?entity=…&id=…`.
 */
interface Props {
  themes: ZieleTreeTheme[];
}

export function StrategyTableView({ themes }: Props) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <Th className="w-10">#</Th>
            <Th>Name</Th>
            <Th className="w-32">Status</Th>
            <Th className="w-48">Progress</Th>
            <Th className="w-32">Time period</Th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {themes.map((t, ti) => (
            <ThemeBlock key={t.id} index={ti + 1} theme={t} />
          ))}
          {themes.length === 0 && (
            <tr>
              <td colSpan={5} className="px-3 py-6 text-center text-xs text-muted-foreground">
                Noch keine Themes definiert.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function ThemeBlock({ index, theme }: { index: number; theme: ZieleTreeTheme }) {
  return (
    <>
      <Row
        depth={0}
        index={index}
        title={theme.title}
        subtitle="Theme (OKR)"
        href={`/strategy?entity=theme&id=${theme.id}`}
        status={statusForTheme(theme)}
        progress={trioProgress(theme.trio)}
        period={theme.period}
      />
      {theme.keyResults.map((kr, ki) => (
        <KrRow key={kr.id} index={ki + 1} kr={kr} parentDepth={1} />
      ))}
    </>
  );
}

function KrRow({
  index,
  kr,
  parentDepth,
}: {
  index: number;
  kr: ZieleTreeKeyResult;
  parentDepth: number;
}) {
  const prog = krProgress(kr);
  return (
    <Row
      depth={parentDepth}
      index={index}
      title={kr.title}
      subtitle="Key Result"
      href={`/strategy?entity=kr&id=${kr.id}`}
      status={statusForKr(kr, prog)}
      progress={prog}
      period={null}
    />
  );
}

interface RowProps {
  depth: number;
  index: number;
  title: string;
  subtitle: string;
  href: string;
  status: StatusSpec;
  progress: number;
  period: string | null;
}

function Row({ depth, index, title, subtitle, href, status, progress, period }: RowProps) {
  const indent = depth * 20 + 8;
  return (
    <tr className="group hover:bg-muted/30">
      <Td className="text-[10px] text-muted-foreground tabular-nums">{index}</Td>
      <Td>
        <Link
          href={href as never}
          scroll={false}
          className="flex items-center gap-2 hover:underline"
          style={{ paddingLeft: indent }}
        >
          {depth > 0 && (
            <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
          )}
          <span className="min-w-0">
            <span className="block truncate font-medium">{title}</span>
            <span className="block truncate text-[10px] uppercase tracking-wider text-muted-foreground">
              {subtitle}
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
      <Td className="text-xs text-muted-foreground">{period ?? "—"}</Td>
    </tr>
  );
}

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

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <th className={`px-3 py-2 text-left ${className ?? ""}`}>{children}</th>;
}

function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 align-middle ${className ?? ""}`}>{children}</td>;
}
