import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type {
  ZieleTreeKeyResult,
  ZieleTreeObjective,
  ZieleTreeTheme,
  ZieleTreeVision,
} from "@/server/views/ziele-view";
import { isAtRisk, type RollupTrio } from "@/domain/goals-rollup";

/**
 * Strategie als hierarchische Tabelle (Refactor §Ziele-Visualisierung).
 *
 * Spalten: # · Name · Status · Progress · Time period. Hierarchie via
 * `<details>` (kein Client-State) und sichtbare Einrueckung. Jede
 * Zeile deeplinkt nach `/strategy?entity=…&id=…`; im /ziele-Modul
 * navigiert ein Klick raus zur Pflege, im /strategy-Modul oeffnet der
 * existierende Edit-Drawer.
 */
interface Props {
  visions: ZieleTreeVision[];
  themes: ZieleTreeTheme[];
}

export function StrategyTableView({ visions, themes }: Props) {
  const themesByVision = new Map<string, ZieleTreeTheme[]>();
  const orphanThemes: ZieleTreeTheme[] = [];
  for (const t of themes) {
    if (t.visionId) {
      const arr = themesByVision.get(t.visionId) ?? [];
      arr.push(t);
      themesByVision.set(t.visionId, arr);
    } else {
      orphanThemes.push(t);
    }
  }

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
          {visions.map((v, vi) => (
            <VisionRow
              key={v.id}
              index={vi + 1}
              vision={v}
              themes={themesByVision.get(v.id) ?? []}
            />
          ))}
          {orphanThemes.length > 0 && (
            <OrphanGroup themes={orphanThemes} startIndex={visions.length + 1} />
          )}
          {visions.length === 0 && orphanThemes.length === 0 && (
            <tr>
              <td colSpan={5} className="px-3 py-6 text-center text-xs text-muted-foreground">
                Noch keine Strategie definiert.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function VisionRow({
  index,
  vision,
  themes,
}: {
  index: number;
  vision: ZieleTreeVision;
  themes: ZieleTreeTheme[];
}) {
  const horizon = `${vision.horizonStart.getUTCFullYear()} — ${vision.horizonEnd.getUTCFullYear()}`;
  const prog = trioProgress(vision.trio);
  return (
    <>
      <Row
        depth={0}
        index={index}
        title={vision.title}
        subtitle={vision.scope === "tenant" ? "Tenant-Vision" : `VS · ${vision.valueStreamName}`}
        href={`/strategy?entity=vision&id=${vision.id}`}
        status={statusForVision(vision)}
        progress={prog}
        period={horizon}
        expandable={themes.length > 0}
      />
      {themes.map((t, ti) => (
        <ThemeRow key={t.id} index={ti + 1} theme={t} parentDepth={1} />
      ))}
    </>
  );
}

function OrphanGroup({ themes, startIndex }: { themes: ZieleTreeTheme[]; startIndex: number }) {
  return (
    <>
      <tr className="bg-muted/20 text-[10px] uppercase tracking-wider text-muted-foreground">
        <td colSpan={5} className="px-3 py-1.5">
          Themes ohne Vision
        </td>
      </tr>
      {themes.map((t, ti) => (
        <ThemeRow key={t.id} index={startIndex + ti} theme={t} parentDepth={0} />
      ))}
    </>
  );
}

function ThemeRow({
  index,
  theme,
  parentDepth,
}: {
  index: number;
  theme: ZieleTreeTheme;
  parentDepth: number;
}) {
  const prog = trioProgress(theme.trio);
  return (
    <>
      <Row
        depth={parentDepth}
        index={index}
        title={theme.title}
        subtitle={`Theme · ${theme.kind}`}
        href={`/strategy?entity=theme&id=${theme.id}`}
        accent={theme.color}
        status={statusForTheme(theme)}
        progress={prog}
        period={null}
        expandable={theme.objectives.length > 0}
      />
      {theme.objectives.map((o, oi) => (
        <ObjectiveRow key={o.id} index={oi + 1} objective={o} parentDepth={parentDepth + 1} />
      ))}
    </>
  );
}

function ObjectiveRow({
  index,
  objective,
  parentDepth,
}: {
  index: number;
  objective: ZieleTreeObjective;
  parentDepth: number;
}) {
  const prog = trioProgress(objective.trio);
  return (
    <>
      <Row
        depth={parentDepth}
        index={index}
        title={objective.title}
        subtitle="Objective"
        href={`/strategy?entity=objective&id=${objective.id}`}
        status={statusForObjective(objective)}
        progress={prog}
        period={objective.period ?? "Backlog"}
        expandable={objective.keyResults.length > 0}
      />
      {objective.keyResults.map((kr, ki) => (
        <KrRow key={kr.id} index={ki + 1} kr={kr} parentDepth={parentDepth + 1} />
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
      expandable={false}
    />
  );
}

interface RowProps {
  depth: number;
  index: number;
  title: string;
  subtitle: string;
  href: string;
  accent?: string;
  status: StatusSpec;
  progress: number;
  period: string | null;
  expandable: boolean;
}

function Row({ depth, index, title, subtitle, href, accent, status, progress, period }: RowProps) {
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
          {accent && (
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: accent }}
            />
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

// ── Status + Progress ────────────────────────────────────────────────

type StatusTier = "achieved" | "on-track" | "at-risk" | "off-track" | "draft" | "neutral";
interface StatusSpec {
  tier: StatusTier;
  label: string;
}

function statusForVision(v: ZieleTreeVision): StatusSpec {
  if (v.status === "archived") return { tier: "neutral", label: "archived" };
  if (isAtRisk(v.trio)) return { tier: "at-risk", label: "At risk" };
  return { tier: "on-track", label: "On track" };
}

function statusForTheme(t: ZieleTreeTheme): StatusSpec {
  if (t.status === "sunsetted") return { tier: "neutral", label: "sunsetted" };
  if (isAtRisk(t.trio)) return { tier: "at-risk", label: "At risk" };
  return { tier: "on-track", label: "On track" };
}

function statusForObjective(o: ZieleTreeObjective): StatusSpec {
  switch (o.status) {
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
  return isAtRisk(o.trio)
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
    status.tier === "achieved"
      ? "bg-emerald-500"
      : status.tier === "on-track"
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
