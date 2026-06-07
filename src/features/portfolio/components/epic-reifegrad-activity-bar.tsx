import { CheckCircle2 } from "lucide-react";
import { STAGE_GATES, type SubStage } from "@/domain/stage-gate";
import type { StageGate } from "@/domain/types";
import {
  STAGE_GATE_LABELS,
  SUB_STAGE_LABELS,
  STATUS_DOT,
  STATUS_LABELS,
} from "@/components/detail/initiative-labels";
import { PhaseBadge } from "@/components/detail/phase-badge";

interface Props {
  stageGate: StageGate;
  subStage: SubStage | null;
  approvalPhase: string | null;
  status: string;
  childTotal: number;
  childCompleted: number;
  budgetAllocated: boolean;
  impactRecognizedAt: Date | null;
  /** Optionaler Hinweis-Knopf rechts (z.B. „Impact bestätigen"). */
  actionSlot?: React.ReactNode;
}

const STAGE_DOT: Record<StageGate, string> = {
  L0: "bg-muted-foreground/40",
  L1: "bg-amber-400",
  L2: "bg-blue-400",
  L3: "bg-indigo-400",
  L4: "bg-primary",
  L5: "bg-emerald-500",
};

/**
 * Sub-Header für die Epic-Detail-Seite — trennt die zwei Achsen visuell:
 *
 * - **Reifegrad** (links): kompakter L0..L5-Track mit dem aktuellen Gate
 *   hervorgehoben, Sub-Step-Mini-Label (L2.1/L2.2 bzw. L4.1/L4.2), und
 *   die zugehörigen Kontext-Badges (Approval-Phase, Budget alloziert,
 *   Impact realisiert).
 * - **Aktivität** (rechts): heutiger Kanban-Status, Feature-Burndown
 *   (completed/total), optionaler Aktions-Slot (z.B. „Impact bestätigen").
 *
 * Reine Server-Komponente — keine Mutationen, keine State.
 */
export function EpicReifegradActivityBar({
  stageGate,
  subStage,
  approvalPhase,
  status,
  childTotal,
  childCompleted,
  budgetAllocated,
  impactRecognizedAt,
  actionSlot,
}: Props) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
      {/* ── Reifegrad ──────────────────────────────────────── */}
      <section className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Reifegrad
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {STAGE_GATES.map((g) => {
            const isActive = g === stageGate;
            const isPast = STAGE_GATES.indexOf(g) < STAGE_GATES.indexOf(stageGate);
            return (
              <div
                key={g}
                className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs ${
                  isActive
                    ? "border-foreground bg-card font-medium"
                    : isPast
                      ? "border-input bg-muted/40 text-muted-foreground"
                      : "border-dashed border-input bg-transparent text-muted-foreground/60"
                }`}
              >
                <span className={`size-2 rounded-full ${STAGE_DOT[g as StageGate]}`} />
                <span>{STAGE_GATE_LABELS[g] ?? g}</span>
                {isActive && subStage && (
                  <span className="rounded bg-muted px-1 text-[10px] tabular-nums">{subStage}</span>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {approvalPhase && <PhaseBadge phase={approvalPhase} />}
          {budgetAllocated && (
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] text-indigo-700">
              Budget alloziert
            </span>
          )}
          {impactRecognizedAt && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] text-emerald-700">
              <CheckCircle2 className="size-3" />
              Impact realisiert · {impactRecognizedAt.toLocaleDateString("de-DE")}
            </span>
          )}
          {subStage && (
            <span className="text-[11px] text-muted-foreground">
              {subStage} · {SUB_STAGE_LABELS[subStage]}
            </span>
          )}
        </div>
      </section>

      {/* ── Aktivität ──────────────────────────────────────── */}
      <section className="space-y-2 border-l-0 lg:border-l lg:pl-4">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Aktivität
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs">
            <span
              className={`size-2 rounded-full ${STATUS_DOT[status] ?? "bg-muted-foreground/40"}`}
            />
            <span className="text-muted-foreground">{STATUS_LABELS[status] ?? status}</span>
          </span>
          {childTotal > 0 && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] tabular-nums text-muted-foreground">
              Features {childCompleted}/{childTotal}
            </span>
          )}
        </div>
        {actionSlot && <div className="pt-1">{actionSlot}</div>}
      </section>
    </div>
  );
}
