import type { ReactNode } from "react";
import { Check, CircleDot, Circle, CheckCircle2 } from "lucide-react";
import { SectionLabel } from "@/components/ui/section-label";
import type { EpicNextStep } from "@/modules/work/domain/epic-next-step";
import type { LifecycleStep } from "@/modules/work/features/portfolio/lib/epic-lifecycle";

interface Props {
  steps: LifecycleStep[];
  /** Dynamic next-action for the current step; null = Epic done. */
  nextStep: EpicNextStep | null;
  /** CTA (link / impact-confirm dialog) rendered by the page. */
  actionSlot?: ReactNode;
}

const TILE: Record<LifecycleStep["status"], string> = {
  done: "border-input bg-muted/40 text-muted-foreground/70",
  current: "border-primary bg-primary/10 text-foreground shadow-xs",
  upcoming: "border-input bg-card text-muted-foreground",
};

function StatusIcon({ status }: { status: LifecycleStep["status"] }) {
  if (status === "done") return <Check className="size-3.5 shrink-0" />;
  if (status === "current") return <CircleDot className="size-3.5 shrink-0 text-primary" />;
  return <Circle className="size-3.5 shrink-0 opacity-50" />;
}

/**
 * Epic lifecycle — every step is its own tile with a static Erklärung, so the
 * whole process is explicit and readable from the start. Completed steps are
 * greyed, the next open step is highlighted, later steps neutral. The highlighted
 * (current) tile additionally shows the dynamic "Nächster Schritt" title + hint +
 * activity CTA (absorbs the former Reifegrad/Nächster-Schritt band). Server-only.
 */
export function EpicLifecycleStepper({ steps, nextStep, actionSlot }: Props) {
  return (
    <div className="space-y-3 rounded-lg border bg-card p-3.5 shadow-xs">
      <SectionLabel>Fortschritt</SectionLabel>
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {steps.map((step) => {
          const isCurrent = step.status === "current";
          return (
            <li
              key={step.key}
              className={`flex flex-col gap-1 rounded-md border p-2.5 ${TILE[step.status]}`}
            >
              <div className="flex items-center gap-1.5">
                <StatusIcon status={step.status} />
                <span className="text-xs font-medium">{step.label}</span>
              </div>
              <p className="text-[11px] leading-snug">{step.description}</p>

              {isCurrent && nextStep && (
                <div className="mt-1 space-y-1 border-t border-primary/20 pt-1.5">
                  <p className="text-xs font-semibold leading-snug">{nextStep.title}</p>
                  <p className="text-[11px] leading-snug text-muted-foreground">{nextStep.hint}</p>
                  {actionSlot && <div className="pt-0.5">{actionSlot}</div>}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {nextStep === null && (
        <p className="inline-flex items-center gap-1.5 text-sm font-medium">
          <CheckCircle2 className="size-4 text-emerald-600" />
          Epic abgeschlossen — Impact ist bestätigt.
        </p>
      )}
    </div>
  );
}
