"use client";

import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Check, Circle, X, Plus, ArrowRight, ListChecks } from "lucide-react";
import {
  goalCreateHref,
  goalDetailHref,
  goalDetailHrefClearingScope,
} from "@/modules/core/goals/features/lib/goal-href";
import type { GoalSetupStep } from "@/modules/core/goals/domain/goal-setup";
import { dismissZieleSetupAction } from "@/modules/core/goals/features/actions/ziele-setup";

/**
 * Die Einrichtungs-Liste der Ziele-Seite — was noch zu tun ist, bis die Ziele
 * tragen.
 *
 * **Dasselbe Schema wie die Tor-Kachel eines Epics**
 * (`work/.../gate/epic-gate-card.tsx`): eine Karte mit Akzentschiene, Titel mit
 * Listen-Symbol, darunter eine senkrechte Liste — je Zeile links die Marke,
 * rechts der Weg dorthin. Erledigtes tritt zurück, Offenes steht in voller
 * Farbe.
 *
 * Vorher waren es fünf Kacheln nebeneinander, von denen nur die aktive einen
 * Weg trug: das hob **einen** Schritt hervor und machte aus den anderen
 * Kulisse. Zwei Flächen im Produkt beantworten dieselbe Frage — „was ist als
 * Nächstes zu tun?" —, und sie sollten dabei gleich aussehen.
 *
 * **Erledigte Zeilen tragen keinen Link**, und das ist der eine bewusste
 * Unterschied zum Epic: dort gehören alle Kriterien zu *einem* Epic, hier
 * heisst „erledigt", dass *irgendein* Ziel den Schritt erfüllt. Das
 * Sprungziel zeigt aber auf das erste Ziel, das ihn weiterhin **nicht**
 * erfüllt — ein Weg, der der Zeile daneben widerspräche.
 *
 * Client-Komponente: sie baut die Deep-Links aus den laufenden Search-Params
 * (damit Filter und Layout erhalten bleiben) und trägt das ×. Ob sie überhaupt
 * erscheint, entscheidet die Shell.
 */
export function GoalSetupStepper({ steps }: { steps: GoalSetupStep[] }) {
  const t = useTranslations();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();

  const dismiss = () =>
    startTransition(async () => {
      await dismissZieleSetupAction({}, new FormData());
    });

  return (
    /* Akzentschiene statt Umriss — dieselbe Geste wie an der Tor-Kachel des
       Epics, und die einzige, die ADR-0021 an einer Karte zulaesst. */
    <div className="space-y-3 rounded-lg border-l-2 border-l-primary bg-card p-3.5 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <ListChecks className="size-4 shrink-0 text-primary" aria-hidden />
          {t("goals.setup.heading")}
        </h2>
        <button
          type="button"
          onClick={dismiss}
          disabled={pending}
          aria-label={t("goals.setup.hideGuide")}
          className="rounded-md p-0.5 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:opacity-50"
        >
          <X className="size-3.5" />
        </button>
      </div>

      <ol className="space-y-1.5">
        {steps.map((step) => {
          // Jede Zeile kennt ihr eigenes Ziel — und ob der aktive Filter es
          // gerade ausblendet. Tut er das, raeumt der Link ihn ab, sonst
          // oeffnete der Drawer ein leeres Formular.
          const href =
            step.ctaKind === "create"
              ? goalCreateHref(sp)
              : step.actionGoalId
                ? step.actionGoalHidden
                  ? goalDetailHrefClearingScope(sp, step.actionGoalId)
                  : goalDetailHref(sp, step.actionGoalId)
                : null;
          return (
            <li
              key={step.key}
              className={`flex flex-wrap items-start justify-between gap-x-3 gap-y-0.5 text-sm ${
                step.done ? "text-muted-foreground" : "text-foreground"
              }`}
            >
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="flex items-start gap-2">
                  {step.done ? (
                    <Check className="mt-0.5 size-4 shrink-0 text-success" />
                  ) : (
                    <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className="flex flex-wrap items-baseline gap-x-1.5">
                    {step.label}
                    {/* Markiert wird die Ausnahme — dieselbe Pille, die am Epic
                        „Pflicht" traegt. Sie sagt, wo man anfaengt, ohne die
                        uebrigen Zeilen zu Kulisse zu machen. */}
                    {step.isNext && (
                      <span className="rounded-sm bg-muted px-1.5 py-0.5 text-label font-medium uppercase tracking-[0.08em] text-muted-foreground">
                        {t("goals.setup.nextStep")}
                      </span>
                    )}
                  </span>
                </span>
                {/* Erklaert wird, was noch aussteht. Eine erledigte Zeile
                    schrumpft auf ihren Titel — sonst waere die Kachel bei fuenf
                    Schritten eine Textwand, die ueberwiegend Vergangenes
                    beschreibt. */}
                {!step.done && (
                  <span className="pl-6 text-meta leading-snug text-muted-foreground">
                    {step.description}
                  </span>
                )}
              </span>
              {!step.done && href && (
                <Link
                  href={href}
                  scroll={false}
                  className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  {step.ctaKind === "create" && <Plus className="size-3.5" aria-hidden />}
                  {step.ctaLabel}
                  <ArrowRight className="size-3.5" aria-hidden />
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
