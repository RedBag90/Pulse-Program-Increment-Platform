import { CheckCircle2 } from "lucide-react";
import { type SubStage } from "@/domain/stage-gate";
import type { StageGate } from "@/domain/types";
import { SectionLabel } from "@/components/ui/section-label";
import type { EpicNextStep } from "@/domain/epic-next-step";
import { StageGateLifecycleHelp } from "@/features/portfolio/components/stage-gate-lifecycle-help";
import { ReifegradStepper } from "@/features/portfolio/components/reifegrad-stepper";

interface Props {
  stageGate: StageGate;
  /** Aktuelle Sub-Stage (derivativ). Treibt die Hervorhebung der
   *  Sub-Stage-Pills unter L2/L4. `null` bei L0/L1/L3/L5 oder bei L2 wenn
   *  noch kein BC-Inhalt vorhanden. */
  subStage: SubStage | null;
  /** Berechneter nächster Schritt; null = L5 / Endstand. */
  nextStep: EpicNextStep | null;
  /** UI-Repräsentation des CTAs (Link-Button oder Inline-Dialog). Wird von
   *  der Seite gerendert, weil die Variante Capability-abhängig ist. */
  actionSlot?: React.ReactNode;
}

/**
 * Sub-Header für die Epic-Detail-Seite — trennt die zwei Achsen visuell:
 *
 * - **Reifegrad** (links): kompakter L0..L5-Track mit dem aktuellen Gate
 *   hervorgehoben. Bewusst reduziert: keine Approval-Phase-, Budget- oder
 *   Sub-Step-Badges — die Approval-Phase steht im Page-Header, alle anderen
 *   Aspekte werden vom „Nächster Schritt"-Helfer rechts berücksichtigt.
 * - **Nächster Schritt** (rechts): kontextueller Helfer, der dem Owner
 *   zeigt, was als Nächstes zu tun ist, damit das Epic das nächste Stage
 *   Gate erreicht — inklusive CTA, der zur passenden Stelle springt.
 *
 * Reine Server-Komponente — keine Mutationen, keine State.
 */
export function EpicReifegradActivityBar({ stageGate, subStage, nextStep, actionSlot }: Props) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
      {/* ── Reifegrad ──────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center gap-1.5">
          <SectionLabel>Reifegrad</SectionLabel>
          <StageGateLifecycleHelp />
        </div>
        <div className="pr-2">
          <ReifegradStepper stageGate={stageGate} subStage={subStage} />
        </div>
      </section>

      {/* ── Nächster Schritt ───────────────────────────────── */}
      <section className="space-y-2 border-l-0 lg:border-l lg:pl-4">
        <SectionLabel>Nächster Schritt</SectionLabel>
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
