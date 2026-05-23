import { Check } from "lucide-react";
import { APPROVAL_PHASE_LABELS } from "@/components/detail/initiative-labels";
import type { ApprovalPhase } from "@/domain/epic-approval";

/** The approval workflow's phases, in the order they are reached. */
const PHASE_ORDER: ApprovalPhase[] = [
  "draft",
  "hypothesis_review",
  "business_case",
  "stakeholder_review",
  "approved",
];

/**
 * Horizontal progress indicator for the multi-party approval workflow. Phases
 * before the current one read as done (filled + check), the current one is
 * highlighted, and later phases are muted — so the Epic's position in the
 * lifecycle is legible at a glance above the phase actions.
 */
export function PhaseStepper({ phase }: { phase: ApprovalPhase }) {
  const currentIndex = PHASE_ORDER.indexOf(phase);

  return (
    <ol className="flex flex-wrap items-center gap-x-1 gap-y-2">
      {PHASE_ORDER.map((p, i) => {
        const done = i < currentIndex;
        const current = i === currentIndex;
        return (
          <li key={p} className="flex items-center gap-1">
            <span
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                current
                  ? "bg-primary text-primary-foreground"
                  : done
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              <span
                className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${
                  current
                    ? "bg-primary-foreground/20"
                    : done
                      ? "bg-emerald-600 text-white"
                      : "bg-foreground/10"
                }`}
              >
                {done ? <Check className="h-2.5 w-2.5" /> : i + 1}
              </span>
              {APPROVAL_PHASE_LABELS[p] ?? p}
            </span>
            {i < PHASE_ORDER.length - 1 && (
              <span
                aria-hidden
                className={`h-px w-4 ${i < currentIndex ? "bg-emerald-400" : "bg-border"}`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
