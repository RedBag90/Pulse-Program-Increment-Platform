import { CheckCircle2 } from "lucide-react";
import { STAGE_GATES, type SubStage } from "@/domain/stage-gate";
import type { StageGate } from "@/domain/types";
import { STAGE_GATE_LABELS, SUB_STAGE_LABELS } from "@/components/detail/initiative-labels";
import { PhaseBadge } from "@/components/detail/phase-badge";
import type { EpicNextStep } from "@/domain/epic-next-step";

interface Props {
  stageGate: StageGate;
  subStage: SubStage | null;
  approvalPhase: string | null;
  budgetAllocated: boolean;
  impactRecognizedAt: Date | null;
  /** Berechneter nächster Schritt; null = L5 / Endstand. */
  nextStep: EpicNextStep | null;
  /** UI-Repräsentation des CTAs (Link-Button oder Inline-Dialog). Wird von
   *  der Seite gerendert, weil die Variante Capability-abhängig ist. */
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
 * - **Nächster Schritt** (rechts): kontextueller Helfer, der dem Owner
 *   zeigt, was als Nächstes zu tun ist, damit das Epic das nächste Stage
 *   Gate erreicht — inklusive CTA, der zur passenden Stelle springt.
 *
 * Reine Server-Komponente — keine Mutationen, keine State.
 */
export function EpicReifegradActivityBar({
  stageGate,
  subStage,
  approvalPhase,
  budgetAllocated,
  impactRecognizedAt,
  nextStep,
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

      {/* ── Nächster Schritt ───────────────────────────────── */}
      <section className="space-y-2 border-l-0 lg:border-l lg:pl-4">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Nächster Schritt
        </p>
        {nextStep === null ? (
          <div className="space-y-1">
            <p className="inline-flex items-center gap-1.5 text-sm font-medium">
              <CheckCircle2 className="size-4 text-emerald-600" />
              Epic abgeschlossen
            </p>
            <p className="text-xs text-muted-foreground">
              Impact ist bestätigt und auf der Balance Sheet sichtbar.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            <p className="text-sm font-medium leading-snug">{nextStep.title}</p>
            <p className="text-xs leading-snug text-muted-foreground">{nextStep.hint}</p>
            {actionSlot && <div className="pt-1">{actionSlot}</div>}
          </div>
        )}
      </section>
    </div>
  );
}
