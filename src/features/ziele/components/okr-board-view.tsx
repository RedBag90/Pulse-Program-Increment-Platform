"use client";

import { useRef, useState, useTransition, type MutableRefObject } from "react";
import Link from "next/link";
import type { ZieleTreeTheme, ZieleTreeObjective } from "@/server/views/ziele-view";
import { isAtRisk, type RollupTrio } from "@/domain/goals-rollup";
import { updateObjectiveAction } from "@/features/ziele/actions/ziele";

/**
 * OKR-Quarterly-Board (Konzept §4.2 / V7). Vier Quartals-Spalten um das
 * aktuelle Quartal herum + Backlog (Objectives ohne `period`). Pro
 * Objective eine kompakte Card mit Theme-Color-Stripe, Confidence-
 * Sternen, Achievement-Bars je KR und €-Linse. Klick → Edit-Drawer
 * (URL-State `?entity=objective&id=…`). Drag horizontal = Period-Update
 * (B1) — HTML5-native, gleicher Pattern wie das Cockpit-Board.
 */
interface Props {
  themes: ZieleTreeTheme[];
  canEdit: boolean;
}

interface QuarterColumn {
  key: string;
  label: string;
  isCurrent: boolean;
  isPast: boolean;
}

function currentQuarter(now = new Date()): { year: number; q: number } {
  const m = now.getUTCMonth();
  return { year: now.getUTCFullYear(), q: Math.floor(m / 3) + 1 };
}

function quarterKey(year: number, q: number): string {
  return `${year}-Q${q}`;
}

function buildColumns(): QuarterColumn[] {
  const { year, q } = currentQuarter();
  const cols: QuarterColumn[] = [];
  for (let offset = -1; offset <= 2; offset++) {
    let y = year;
    let qq = q + offset;
    while (qq < 1) {
      qq += 4;
      y -= 1;
    }
    while (qq > 4) {
      qq -= 4;
      y += 1;
    }
    cols.push({
      key: quarterKey(y, qq),
      label: `Q${qq}-${String(y).slice(2)}`,
      isCurrent: offset === 0,
      isPast: offset < 0,
    });
  }
  return cols;
}

export function OkrBoardView({ themes, canEdit }: Props) {
  const columns = buildColumns();
  const draggingId = useRef<string | null>(null);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Optimistische Period-Overrides je Objective-Id. `null` = Backlog.
  const [optimistic, setOptimistic] = useState<Record<string, string | null>>({});

  // Objective + Theme zusammen sammeln und die Optimistik auf `period`
  // anwenden, ohne die Server-Liste zu mutieren.
  const objectives: Array<{
    objective: ZieleTreeObjective;
    theme: ZieleTreeTheme;
    effectivePeriod: string | null;
  }> = [];
  for (const t of themes) {
    for (const o of t.objectives) {
      const override = optimistic[o.id];
      const effectivePeriod = override !== undefined ? override : o.period;
      objectives.push({ objective: o, theme: t, effectivePeriod });
    }
  }

  const grouped = new Map<string, typeof objectives>();
  for (const col of columns) grouped.set(col.key, []);
  const backlog: typeof objectives = [];
  for (const entry of objectives) {
    if (!entry.effectivePeriod) {
      backlog.push(entry);
      continue;
    }
    const bucket = grouped.get(entry.effectivePeriod);
    if (bucket) bucket.push(entry);
    else backlog.push(entry);
  }

  function moveTo(targetPeriod: string | null, targetIsPast: boolean) {
    const id = draggingId.current;
    draggingId.current = null;
    if (!id || !canEdit) return;

    const source = objectives.find((e) => e.objective.id === id);
    if (!source) return;
    if (source.effectivePeriod === targetPeriod) return;

    if (targetIsPast) {
      const ok = window.confirm(
        "Quartal liegt in der Vergangenheit. Objective wirklich dorthin verschieben?",
      );
      if (!ok) return;
    }

    setOptimistic((prev) => ({ ...prev, [id]: targetPeriod }));

    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("id", id);
        // Period leer = null (Backlog). updateObjectiveAction mapped "" → null.
        fd.set("period", targetPeriod ?? "");
        const res = await updateObjectiveAction({}, fd);
        if (res.error) throw new Error(res.error);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Period-Update fehlgeschlagen");
        // Rollback der Optimistik fuer dieses Objective
        setOptimistic((prev) => {
          const { [id]: _drop, ...rest } = prev;
          return rest;
        });
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">
          Aktuelles Quartal markiert · Klick auf Objective → Bearbeiten
          {canEdit ? " · Drag zwischen Spalten = Quartal-Wechsel" : ""}
        </p>
        {error && (
          <span className="rounded-md border border-destructive/40 bg-destructive/5 px-2 py-1 text-[11px] text-destructive">
            {error}
          </span>
        )}
      </div>
      <div className="grid grid-cols-[repeat(5,minmax(0,1fr))] gap-3">
        {columns.map((col) => (
          <Column
            key={col.key}
            label={col.label}
            isCurrent={col.isCurrent}
            entries={grouped.get(col.key) ?? []}
            canEdit={canEdit}
            quarterKey={col.key}
            onDropPeriod={() => moveTo(col.key, col.isPast)}
            draggingId={draggingId}
          />
        ))}
        <Column
          key="backlog"
          label="Backlog"
          isCurrent={false}
          entries={backlog}
          canEdit={canEdit}
          quarterKey={null}
          onDropPeriod={() => moveTo(null, false)}
          draggingId={draggingId}
        />
      </div>
    </div>
  );
}

const HIGHLIGHT_DROP = "ring-2 ring-primary/60";

function Column({
  label,
  isCurrent,
  entries,
  canEdit,
  quarterKey,
  onDropPeriod,
  draggingId,
}: {
  label: string;
  isCurrent: boolean;
  entries: Array<{ objective: ZieleTreeObjective; theme: ZieleTreeTheme }>;
  canEdit: boolean;
  quarterKey: string | null;
  onDropPeriod: () => void;
  draggingId: MutableRefObject<string | null>;
}) {
  const [over, setOver] = useState(false);
  return (
    <section
      className={`flex flex-col gap-2 rounded-lg border bg-card p-2 transition-shadow ${
        isCurrent ? "border-primary bg-primary/5" : ""
      } ${over && canEdit ? HIGHLIGHT_DROP : ""}`}
      onDragOver={(e) => {
        if (!canEdit) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (!over) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        if (!canEdit) return;
        e.preventDefault();
        setOver(false);
        onDropPeriod();
      }}
    >
      <header className="flex items-baseline justify-between px-1">
        <h3 className="text-xs font-semibold tracking-tight">{label}</h3>
        <span className="text-[10px] text-muted-foreground tabular-nums">{entries.length}</span>
      </header>
      <ul className="flex flex-col gap-1.5">
        {entries.length === 0 && (
          <li className="rounded-md border border-dashed bg-background/50 px-2 py-3 text-center text-[10px] text-muted-foreground">
            leer
          </li>
        )}
        {entries.map((e) => (
          <ObjectiveCard
            key={e.objective.id}
            objective={e.objective}
            theme={e.theme}
            canDrag={canEdit}
            draggingId={draggingId}
          />
        ))}
      </ul>
      {canEdit && quarterKey && (
        <Link
          href={`/strategy?entity=objective&new=1&parent=` as never}
          scroll={false}
          className="rounded-md border border-dashed bg-background/40 px-2 py-1.5 text-center text-[10px] text-muted-foreground hover:bg-muted/40 hover:text-foreground"
          title="OKR fuer dieses Quartal anlegen — bitte im Drawer Theme + Quartal setzen"
        >
          + OKR
        </Link>
      )}
    </section>
  );
}

function ObjectiveCard({
  objective,
  theme,
  canDrag,
  draggingId,
}: {
  objective: ZieleTreeObjective;
  theme: ZieleTreeTheme;
  canDrag: boolean;
  draggingId: MutableRefObject<string | null>;
}) {
  const atRisk = isAtRisk(objective.trio);
  return (
    <li>
      <Link
        href={`/strategy?entity=objective&id=${objective.id}` as never}
        scroll={false}
        draggable={canDrag}
        onDragStart={(e) => {
          if (!canDrag) return;
          draggingId.current = objective.id;
          e.dataTransfer.effectAllowed = "move";
          e.currentTarget.classList.add("opacity-40");
        }}
        onDragEnd={(e) => {
          e.currentTarget.classList.remove("opacity-40");
          draggingId.current = null;
        }}
        title={canDrag ? "Drag fuer Quartal-Wechsel" : undefined}
        className={`block overflow-hidden rounded-md border bg-background shadow-sm transition-shadow hover:shadow-md ${
          canDrag ? "cursor-grab active:cursor-grabbing" : ""
        }`}
      >
        <div className="h-1" style={{ backgroundColor: theme.color }} aria-hidden />
        <div className="space-y-1.5 px-2 py-2">
          <div className="flex items-start justify-between gap-2">
            <p className="line-clamp-2 text-[11px] font-medium leading-tight">{objective.title}</p>
            {atRisk && (
              <span
                className="shrink-0 rounded-full bg-amber-100 px-1 py-0.5 text-[9px] font-semibold uppercase text-amber-800"
                title="Run-Rate < 70 % vom Planned"
              >
                ⚠
              </span>
            )}
          </div>
          <p className="truncate text-[9px] uppercase tracking-wider text-muted-foreground">
            {theme.title}
          </p>
          {objective.confidence != null && (
            <p className="text-[10px] text-muted-foreground">
              {"★".repeat(objective.confidence)}
              {"☆".repeat(5 - objective.confidence)}
            </p>
          )}
          {objective.keyResults.length > 0 && (
            <ul className="space-y-0.5">
              {objective.keyResults.slice(0, 4).map((kr) => (
                <li key={kr.id} className="flex items-center gap-1.5 text-[10px]">
                  <KrMiniBar kr={kr} />
                </li>
              ))}
              {objective.keyResults.length > 4 && (
                <li className="text-[9px] text-muted-foreground/70">
                  +{objective.keyResults.length - 4} weitere KRs
                </li>
              )}
            </ul>
          )}
          <TrioBadge trio={objective.trio} />
          <StatusPill status={objective.status} />
        </div>
      </Link>
    </li>
  );
}

function KrMiniBar({
  kr,
}: {
  kr: {
    baseline: number | null;
    target: number | null;
    current: number | null;
    formula: string;
  };
}) {
  if (kr.baseline === null || kr.target === null || kr.current === null) {
    return <span className="text-muted-foreground/70">—</span>;
  }
  const span = kr.target - kr.baseline;
  const pct = span === 0 ? 0 : Math.max(0, Math.min(1, (kr.current - kr.baseline) / span));
  const slots = 6;
  const filled = Math.round(pct * slots);
  return (
    <span className="font-mono text-muted-foreground" aria-hidden>
      {"▆".repeat(filled)}
      {"░".repeat(slots - filled)} {Math.round(pct * 100)}%
    </span>
  );
}

function TrioBadge({ trio }: { trio: RollupTrio }) {
  if (trio.planned === 0 && trio.realized === 0) return null;
  return (
    <p
      className="text-[10px] tabular-nums text-muted-foreground"
      title={`Planned ${eur(trio.planned)} · Realized ${eur(trio.realized)} · Run-Rate ${eur(trio.runRate)}`}
    >
      €{compact(trio.planned)} / €{compact(trio.realized)}
    </p>
  );
}

function StatusPill({ status }: { status: string }) {
  if (status === "active" || status === "draft") return null;
  const cls =
    status === "achieved"
      ? "bg-emerald-100 text-emerald-800"
      : status === "missed"
        ? "bg-rose-100 text-rose-800"
        : status === "stretched"
          ? "bg-blue-100 text-blue-800"
          : "bg-muted text-muted-foreground";
  return (
    <span className={`inline-block rounded-full px-1.5 py-0.5 text-[9px] uppercase ${cls}`}>
      {status}
    </span>
  );
}

function eur(n: number): string {
  return `€${Math.round(n).toLocaleString("de-DE")}`;
}

function compact(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return Math.round(n).toLocaleString("de-DE");
}
