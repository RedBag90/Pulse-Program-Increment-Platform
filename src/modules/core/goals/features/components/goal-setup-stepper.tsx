"use client";

import { useTransition } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Check, CircleDot, Circle, X, Plus, ArrowRight } from "lucide-react";
import { SectionLabel } from "@/components/ui/section-label";
import {
  goalCreateHref,
  goalDetailHref,
  goalDetailHrefClearingScope,
} from "@/modules/core/goals/features/lib/goal-href";
import type { GoalSetupStep } from "@/modules/core/goals/domain/goal-setup";
import { dismissZieleSetupAction } from "@/modules/core/goals/features/actions/ziele-setup";

const TILE: Record<GoalSetupStep["status"], string> = {
  done: "border-input bg-muted/40 text-muted-foreground/70",
  current: "border-primary bg-primary/10 text-foreground shadow-xs",
  upcoming: "border-input bg-card text-muted-foreground",
};

function StatusIcon({ status }: { status: GoalSetupStep["status"] }) {
  if (status === "done") return <Check className="size-3.5 shrink-0" />;
  if (status === "current") return <CircleDot className="size-3.5 shrink-0 text-primary" />;
  return <Circle className="size-3.5 shrink-0 opacity-50" />;
}

/**
 * First-run setup guide for the Ziele page — every step a tile with a static
 * Erklärung, coloured by status (done greyed / next highlighted / upcoming
 * neutral); the current tile carries a CTA (create the first goal, or open the
 * goal that still needs the attribute). Mirrors the Epic `EpicLifecycleStepper`
 * look. Client component: builds the deep-links from live search-params and hosts
 * the dismiss (×) control. The shell only renders it while incomplete + not
 * dismissed + for editors.
 *
 * `clearScope` (= `GoalSetupResult.actionGoalHidden`): das CTA-Ziel liegt außerhalb
 * der aktiven Filter — der Link räumt sie dann ab, sonst öffnet der Drawer ein
 * leeres Formular. Ohne aktiven Filter bleibt die Query unverändert.
 */
export function GoalSetupStepper({
  steps,
  clearScope = false,
}: {
  steps: GoalSetupStep[];
  clearScope?: boolean;
}) {
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();

  const dismiss = () =>
    startTransition(async () => {
      await dismissZieleSetupAction({}, new FormData());
    });

  return (
    <div className="space-y-3 rounded-lg border bg-card p-3.5 shadow-xs">
      <div className="flex items-center justify-between">
        <SectionLabel>Fortschritt</SectionLabel>
        <button
          type="button"
          onClick={dismiss}
          disabled={pending}
          aria-label="Anleitung ausblenden"
          className="rounded-md p-0.5 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:opacity-50"
        >
          <X className="size-3.5" />
        </button>
      </div>

      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {steps.map((step) => {
          const isCurrent = step.status === "current";
          const href =
            step.ctaKind === "create"
              ? goalCreateHref(sp)
              : step.actionGoalId
                ? clearScope
                  ? goalDetailHrefClearingScope(sp, step.actionGoalId)
                  : goalDetailHref(sp, step.actionGoalId)
                : null;
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

              {isCurrent && href && (
                <div className="mt-1 border-t border-primary/20 pt-1.5">
                  <Link
                    href={href}
                    scroll={false}
                    className="inline-flex items-center gap-1.5 rounded-md border border-input bg-card px-2.5 py-1 text-xs font-medium shadow-xs transition-colors hover:bg-muted/50"
                  >
                    {step.ctaKind === "create" && <Plus className="size-3.5" />}
                    {step.ctaLabel}
                    <ArrowRight className="size-3.5" />
                  </Link>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
