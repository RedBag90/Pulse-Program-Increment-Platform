import { Check } from "lucide-react";
import { STAGE_GATES, type SubStage } from "@/modules/work/domain/stage-gate";
import type { StageGate } from "@/modules/core/kernel/domain/types";
import { STAGE_SHORT, STAGE_GATE_LABELS } from "@/components/detail/initiative-labels";

/**
 * Durchgehender Reifegrad-Stepper (L0→L5): erledigte Gates sind gefüllt und mit
 * einer durchgezogenen Primary-Linie verbunden, das aktuelle Gate trägt einen
 * Ring + „you are here"-Punkt, kommende Gates sind hohl auf grauer Linie. Ersetzt
 * die diskreten Outline-Chips — die Progression liest sich als ein Weg. Rein.
 */
export function ReifegradStepper({
  stageGate,
  subStage,
}: {
  stageGate: StageGate;
  subStage?: SubStage | null;
}) {
  const curIdx = STAGE_GATES.indexOf(stageGate);
  return (
    <ol className="flex items-start" aria-label="Reifegrad">
      {STAGE_GATES.map((g, i) => {
        const done = i < curIdx;
        const current = i === curIdx;
        const reached = done || current;
        return (
          <li
            key={g}
            className="relative flex flex-1 flex-col items-center gap-2"
            title={STAGE_GATE_LABELS[g] ?? g}
          >
            {i > 0 && (
              <span
                className={`absolute top-3 left-[-50%] h-0.5 w-full ${
                  reached ? "bg-primary" : "bg-border"
                }`}
              />
            )}
            <span
              className={`relative z-10 grid size-6 place-items-center rounded-full border-2 ${
                done
                  ? "border-primary bg-primary text-primary-foreground"
                  : current
                    ? "border-primary bg-background ring-4 ring-primary/15"
                    : "border-border bg-card"
              }`}
            >
              {done && <Check className="size-3.5" />}
              {current && <span className="size-2 rounded-full bg-primary" />}
            </span>
            <span
              className={`text-center text-sm leading-tight font-medium ${
                reached ? "text-foreground" : "text-muted-foreground/70"
              }`}
            >
              {STAGE_SHORT[g] ?? g}
            </span>
            {current && subStage && (
              <span className="text-xs font-medium text-primary">{subStage}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
