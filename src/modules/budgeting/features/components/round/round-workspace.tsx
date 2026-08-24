"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { ToggleGroup } from "@/components/ui/toggle-group";
import { SectionLabel } from "@/components/ui/section-label";
import { formatEUR } from "@/lib/formatting";
import { buildBudgetingBoardModel } from "@/modules/budgeting/server/views/budgeting-board";
import type { BudgetingBoardModel } from "@/modules/budgeting/server/views/budgeting-board";
import type { ArtBudgetModel } from "@/modules/budgeting/server/views/art-budget-breakdown";
import type { BudgetEpicView } from "@/modules/budgeting/domain/budgeting";
import { LevelPool } from "@/modules/budgeting/features/components/round/level-pool";
import { SaveBar } from "@/modules/budgeting/features/components/round/save-bar";
import { CandidatesSection } from "@/modules/budgeting/features/components/round/candidates-section";
import { ProcessRail } from "@/modules/budgeting/features/components/round/process-rail";
import { CycleControls } from "@/modules/budgeting/features/components/round/cycle-controls";
import type { ProcessStep } from "@/modules/budgeting/server/views/budget-process-rail";
import type { BudgetingCandidate } from "@/modules/budgeting/server/services/budgeting";
import type { ReactNode } from "react";
import {
  ArtBudgetBreakdown,
  type ArtBudgetState,
} from "@/modules/budgeting/features/components/art-budget/art-budget-breakdown";
import { ValueStreamChart } from "@/modules/budgeting/features/components/board/value-stream-chart-lazy";
import {
  numOr0,
  encodeSaveBudgetPoolPayload,
  encodeSaveBudgetAllocationPayload,
  encodeSaveArtBudgetPayload,
} from "@/modules/budgeting/features/lib/allocation-payload";
import {
  saveBudgetPoolAction,
  saveBudgetAllocationAction,
  saveArtBudgetAction,
} from "@/modules/budgeting/features/actions/budgeting";

/** Ein Wertstrom mit seinem ART-Breakdown und der Editier-Berechtigung. */
export interface ArtByValueStream {
  vsId: string;
  name: string;
  model: ArtBudgetModel;
  canEdit: boolean;
}

type Level = "pool" | "vs" | "art";
const LEVELS: readonly Level[] = ["pool", "vs", "art"];

interface Props {
  cycleLabel: string;
  boardModel: BudgetingBoardModel;
  artByVs: ArtByValueStream[];
  canManage: boolean;
  /** Vormerkbare Epics (leer, wenn kein `epic.update`-Recht). */
  candidates: BudgetingCandidate[];
  /** Prozess-Leiste (erledigt/offen/blockiert je Schritt). */
  railSteps: ProcessStep[];
  /** Gehört die jüngste Revision zum aktiven Zyklus? */
  snapshotCurrent: boolean;
  /** Darf der Nutzer den Zyklus fortschreiben (`budget.cycle.advance`)? */
  canAdvance: boolean;
}

const LEVEL_HINT: Record<Level, string> = {
  pool: "Portfolio-Ebene · Topf je Halbjahr auf vorgemerkte Epics verteilen",
  vs: "Wertstrom-Ebene · abgeleitet aus den Epic-Zuteilungen (read-only)",
  art: "ART-Ebene · Finance verteilt das Wertstrom-Budget auf die ARTs",
};

function poolFromModel(m: BudgetingBoardModel): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of m.periods) out[p.key] = m.pool[p.key] != null ? String(m.pool[p.key]) : "";
  return out;
}

function artStateFromVs(artByVs: ArtByValueStream[]): Record<string, ArtBudgetState> {
  const out: Record<string, ArtBudgetState> = {};
  for (const vs of artByVs) {
    const byArt: ArtBudgetState = {};
    for (const r of vs.model.rows) {
      const cells: Record<string, string> = {};
      for (const p of vs.model.periods) {
        cells[p.key] = r.budgetByPeriod[p.key] ? String(r.budgetByPeriod[p.key]) : "";
      }
      byArt[r.artId] = cells;
    }
    out[vs.vsId] = byArt;
  }
  return out;
}

function mapChanged(cur: Record<string, string> = {}, base: Record<string, string> = {}): boolean {
  const keys = new Set([...Object.keys(cur), ...Object.keys(base)]);
  for (const k of keys) if (numOr0(cur[k] ?? "") !== numOr0(base[k] ?? "")) return true;
  return false;
}

/**
 * Budget-Runde — eine Arbeitsfläche mit drei Ebenen (Topf & Epics · Wertströme ·
 * ARTs). Der Workspace hält den gesamten Editier-Stand und leitet — wie der
 * Server — über `buildBudgetingBoardModel`/`buildArtBudgetModel` ab. Statt eines
 * Speichern-Knopfs je Zeile sammelt eine **Sticky-Save-Bar** alle Änderungen und
 * speichert sie gebündelt über die bestehenden Actions.
 */
export function RoundWorkspace({
  cycleLabel,
  boardModel,
  artByVs,
  canManage,
  candidates,
  railSteps,
  snapshotCurrent,
  canAdvance,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const periods = boardModel.periods;

  // ---- Editier-Stand + Baselines (für Dirty-Vergleich) ----
  const [pool, setPool] = useState<Record<string, string>>(() => poolFromModel(boardModel));
  const [epics, setEpics] = useState<BudgetEpicView[]>(() => boardModel.rows.map((r) => r.epic));
  const [artBudgets, setArtBudgets] = useState<Record<string, ArtBudgetState>>(() =>
    artStateFromVs(artByVs),
  );
  const basePool = useRef(pool);
  const baseEpics = useRef(epics);
  const baseArt = useRef(artBudgets);

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---- Live-Ableitung (eine Regel, wie beim Server) ----
  const liveBoard = useMemo(() => {
    const poolNumbers: Record<string, number> = {};
    for (const [k, v] of Object.entries(pool)) poolNumbers[k] = numOr0(v);
    return buildBudgetingBoardModel({
      epics,
      axis: boardModel.axis,
      pool: poolNumbers,
      editableKeys: boardModel.editableKeys,
      activeCycleKey: boardModel.activeCycleKey,
    });
  }, [epics, pool, boardModel.axis, boardModel.editableKeys, boardModel.activeCycleKey]);

  const poolTotal = periods.reduce((s, p) => s + numOr0(pool[p.key] ?? ""), 0);
  const allocatedTotal = liveBoard.rollup.reduce((s, r) => s + r.total, 0);
  const remaining = poolTotal - allocatedTotal;

  // ---- Dirty-Tracking ----
  function epicChanged(cur: BudgetEpicView, b: BudgetEpicView): boolean {
    if (cur.priority !== b.priority) return true;
    if ((cur.hypothesisBudget ?? null) !== (b.hypothesisBudget ?? null)) return true;
    for (const p of periods) {
      if ((cur.allocations[p.key] ?? 0) !== (b.allocations[p.key] ?? 0)) return true;
    }
    return false;
  }
  const poolDirty = periods.some(
    (p) => numOr0(pool[p.key] ?? "") !== numOr0(basePool.current[p.key] ?? ""),
  );
  const baseById = new Map(baseEpics.current.map((e) => [e.id, e]));
  const dirtyEpics = epics.filter((e) => {
    const b = baseById.get(e.id);
    return b ? epicChanged(e, b) : false;
  });
  const dirtyArt: Array<{ vsId: string; artId: string }> = [];
  for (const vs of artByVs) {
    const cur = artBudgets[vs.vsId] ?? {};
    const base = baseArt.current[vs.vsId] ?? {};
    for (const artId of Object.keys(cur)) {
      if (mapChanged(cur[artId], base[artId])) dirtyArt.push({ vsId: vs.vsId, artId });
    }
  }
  const dirtyCount = (poolDirty ? 1 : 0) + dirtyEpics.length + dirtyArt.length;
  const detailParts: string[] = [];
  if (poolDirty) detailParts.push("Topf");
  if (dirtyEpics.length) detailParts.push(`${dirtyEpics.length} Epic${dirtyEpics.length > 1 ? "s" : ""}`);
  if (dirtyArt.length) detailParts.push(`${dirtyArt.length} ART${dirtyArt.length > 1 ? "s" : ""}`);

  // ---- Speichern / Verwerfen ----
  async function save() {
    setPending(true);
    setError(null);
    try {
      if (poolDirty) {
        const byPeriod: Record<string, number> = {};
        for (const p of periods) {
          const n = numOr0(pool[p.key] ?? "");
          if (n > 0) byPeriod[p.key] = n;
        }
        const res = await saveBudgetPoolAction({}, encodeSaveBudgetPoolPayload({ byPeriod }));
        if (res.error) throw new Error(`Topf: ${res.error}`);
      }
      for (const e of dirtyEpics) {
        const res = await saveBudgetAllocationAction(
          {},
          encodeSaveBudgetAllocationPayload({
            epicId: e.id,
            priority: e.priority,
            hypothesisBudget: e.isHypothesisOnly ? e.hypothesisBudget : null,
            allocations: e.allocations,
          }),
        );
        if (res.error) throw new Error(`${e.title}: ${res.error}`);
      }
      for (const { vsId, artId } of dirtyArt) {
        const cells = artBudgets[vsId]?.[artId] ?? {};
        const byPeriod: Record<string, number> = {};
        for (const [k, v] of Object.entries(cells)) {
          const n = numOr0(v);
          if (n > 0) byPeriod[k] = n;
        }
        const res = await saveArtBudgetAction({}, encodeSaveArtBudgetPayload({ artId, byPeriod }));
        if (res.error) throw new Error(`ART: ${res.error}`);
      }
      // Erfolg: Baselines auf den aktuellen Stand ziehen → Dirty verschwindet.
      basePool.current = pool;
      baseEpics.current = epics;
      baseArt.current = artBudgets;
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen");
    } finally {
      setPending(false);
    }
  }

  function discard() {
    setPool(basePool.current);
    setEpics(baseEpics.current);
    setArtBudgets(baseArt.current);
    setError(null);
  }

  // ---- Ebenen-/VS-Auswahl über URL ----
  const rawLevel = searchParams.get("level");
  const level: Level = (LEVELS as readonly string[]).includes(rawLevel ?? "")
    ? (rawLevel as Level)
    : "pool";
  const rawVs = searchParams.get("vs");
  const selectedVs =
    (rawVs && artByVs.some((a) => a.vsId === rawVs) && rawVs) || artByVs[0]?.vsId || "";

  function pushParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    next.set(key, value);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  const activeArt = artByVs.find((a) => a.vsId === selectedVs);

  return (
    <div className="space-y-5">
      {/* Zyklus-Header */}
      <Card className="grid grid-cols-2 divide-y divide-border sm:grid-cols-5 sm:divide-x sm:divide-y-0">
        <HeaderCell label="Aktives Halbjahr" value={cycleLabel} />
        <HeaderCell label="Topf gesamt" value={formatEUR(poolTotal)} />
        <HeaderCell label="Σ zugeteilt" value={formatEUR(allocatedTotal)} />
        <HeaderCell
          label="Verbleibend"
          value={formatEUR(remaining)}
          valueClassName={remaining < 0 ? "text-destructive" : undefined}
        />
        <HeaderCell
          label="Snapshot"
          value={
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
                snapshotCurrent
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200"
                  : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200"
              }`}
            >
              {snapshotCurrent ? "Aktuell" : "Veraltet"}
            </span>
          }
        />
      </Card>

      {/* Kompakte Prozess-Leiste */}
      <ProcessRail steps={railSteps} />

      {/* Rolling-Window: Fenster-Spanne, Größe, Fortschreiben */}
      <CycleControls
        activeCycleKey={boardModel.activeCycleKey}
        windowLabel={liveBoard.windowLabel}
        windowSize={boardModel.windowSize}
        canManage={canManage}
        canAdvance={canAdvance}
      />

      {/* Ebenen-Umschalter */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ToggleGroup<Level>
          ariaLabel="Ebene"
          value={level}
          onChange={(next) => pushParam("level", next)}
          options={[
            { id: "pool", label: "Topf & Epics" },
            { id: "vs", label: "Wertströme" },
            { id: "art", label: "ARTs" },
          ]}
        />
        <p className="text-xs text-muted-foreground">{LEVEL_HINT[level]}</p>
      </div>

      {/* Ebene: Topf & Epics */}
      {level === "pool" && (
        <div className="space-y-4">
          <LevelPool
            model={liveBoard}
            pool={pool}
            setPool={setPool}
            onEpicChange={(next) =>
              setEpics((prev) => prev.map((e) => (e.id === next.id ? next : e)))
            }
            canManage={canManage}
          />
          <CandidatesSection candidates={candidates} />
        </div>
      )}

      {/* Ebene: Wertströme (abgeleitet) */}
      {level === "vs" && (
        <div className="space-y-4">
          <ValueStreamChart rollup={liveBoard.rollup} chartRows={liveBoard.chartRows} />
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
                  <th className="p-2 text-left font-medium">Wertstrom</th>
                  {periods.map((p) => (
                    <th key={p.key} className="p-2 text-right font-medium">
                      {p.label}
                    </th>
                  ))}
                  <th className="p-2 text-right font-medium">Summe</th>
                </tr>
              </thead>
              <tbody>
                {liveBoard.rollup.map((r) => (
                  <tr key={r.valueStreamId ?? "none"} className="border-b">
                    <td className={`p-2 ${r.valueStreamId ? "font-medium" : "text-muted-foreground"}`}>
                      {r.valueStream ?? "Ohne Wertstrom"}
                    </td>
                    {periods.map((p) => (
                      <td key={p.key} className="p-2 text-right tabular-nums">
                        {r.byPeriod[p.key] ? formatEUR(r.byPeriod[p.key]!) : "—"}
                      </td>
                    ))}
                    <td className="p-2 text-right font-medium tabular-nums">{formatEUR(r.total)}</td>
                  </tr>
                ))}
                {liveBoard.rollup.length === 0 && (
                  <tr>
                    <td colSpan={periods.length + 2} className="p-6 text-center text-muted-foreground">
                      Noch keine Zuteilungen — im Tab „Topf &amp; Epics" verteilen.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
          <p className="text-xs text-muted-foreground">
            Wertstrom-Budgets sind <span className="font-medium">abgeleitet</span> aus den
            Epic-Zuteilungen und nicht direkt editierbar.
          </p>
        </div>
      )}

      {/* Ebene: ARTs (Finance) */}
      {level === "art" && (
        <div className="space-y-4">
          {artByVs.length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              Noch keine Wertströme mit ARTs.
            </Card>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <SectionLabel>Wertstrom</SectionLabel>
                <ToggleGroup<string>
                  ariaLabel="Wertstrom wählen"
                  value={selectedVs}
                  onChange={(next) => pushParam("vs", next)}
                  options={artByVs.map((a) => ({ id: a.vsId, label: a.name }))}
                />
              </div>
              {activeArt && (
                <ArtBudgetBreakdown
                  model={activeArt.model}
                  budgets={artBudgets[activeArt.vsId] ?? {}}
                  canEdit={activeArt.canEdit}
                  onChange={(artId, key, value) =>
                    setArtBudgets((prev) => ({
                      ...prev,
                      [activeArt.vsId]: {
                        ...prev[activeArt.vsId],
                        [artId]: { ...prev[activeArt.vsId]?.[artId], [key]: value },
                      },
                    }))
                  }
                />
              )}
            </>
          )}
        </div>
      )}

      <SaveBar
        count={dirtyCount}
        detail={detailParts.join(" · ")}
        pending={pending}
        error={error}
        onSave={save}
        onDiscard={discard}
      />
    </div>
  );
}

function HeaderCell({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: ReactNode;
  valueClassName?: string | undefined;
}) {
  return (
    <div className="px-4 py-3">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className={`mt-1 text-lg font-semibold tabular-nums ${valueClassName ?? ""}`}>
        {value}
      </div>
    </div>
  );
}
