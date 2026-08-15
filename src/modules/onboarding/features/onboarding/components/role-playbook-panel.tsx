"use client";

import { useState, useTransition } from "react";
import { ArrowRight, Check, Circle, RotateCcw } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ROLE_LABELS } from "@/modules/core/kernel/domain/roles";
import type { Role } from "@/modules/core/kernel/domain/roles";
import type { ResolvedTour } from "@/modules/onboarding/domain/role-tour";
import { restartTourAction } from "@/modules/onboarding/features/onboarding/actions/role-onboarding";
import { requestTour } from "@/modules/onboarding/features/onboarding/tour-channel";

/**
 * Nachschlage-Ansicht einer Rolle: dieselbe Erklärung wie im Willkommensfenster,
 * aber jederzeit erreichbar statt nur einmalig. Zeigt zusätzlich, welche
 * Schritte schon gesehen wurden — der Fortschritt ist ohnehin gespeichert, also
 * kann man ihn auch zeigen.
 *
 * Anders als der Dialog filtert diese Ansicht nichts weg, was der Nutzer bereits
 * kennt: hier will man das Ganze sehen, nicht nur das Neue.
 */

interface Props {
  role: Role;
  tour: ResolvedTour;
  seenStepKeys: readonly string[];
}

export function RolePlaybookPanel({ role, tour, seenStepKeys }: Props) {
  // Wie im Willkommensfenster: Button statt Formular, also die Action direkt in
  // einer Transition aufrufen — `useActionState`-Dispatch gehört an ein
  // `action`/`formAction`.
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const seen = new Set(seenStepKeys);
  const doneCount = tour.steps.filter((s) => seen.has(s.key)).length;

  const restart = () => {
    setError(null);
    const fd = new FormData();
    fd.set("role", role);
    startTransition(async () => {
      const res = await restartTourAction({}, fd);
      if (res.error) {
        setError(res.error);
        return;
      }
      // Das Overlay hängt im Dashboard-Layout, nicht auf dieser Seite — es
      // bekommt den Auftrag deshalb über den Kanal. Erst nach Erfolg: eine Tour
      // starten, die der Server nicht zurückgesetzt hat, wäre eine Lüge.
      //
      // Alle Schritte, nicht nur die offenen: nach dem Reset sind ohnehin alle
      // offen, und wer „erneut starten" drückt, will von vorne.
      requestTour({ role, steps: tour.steps });
    });
  };

  return (
    <Card className="space-y-5 p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-semibold tracking-tight">{ROLE_LABELS[role]}</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{tour.mission}</p>
        </div>
        {tour.total > 0 && (
          <div className="flex items-center gap-3">
            <span className="rounded-full border bg-card px-3 py-1 text-sm font-medium tabular-nums">
              {doneCount} / {tour.total}
            </span>
            <Button variant="ghost" size="sm" disabled={pending} onClick={restart}>
              <RotateCcw className="size-3.5" />
              Tour erneut starten
            </Button>
          </div>
        )}
      </header>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {tour.responsibilities.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Deine Verantwortung
          </h3>
          <ul className="space-y-1.5">
            {tour.responsibilities.map((text) => (
              <li key={text} className="flex gap-2 text-sm">
                <Check className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tour.handoffs.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Zusammenspiel
          </h3>
          <ul className="space-y-1.5">
            {tour.handoffs.map((text) => (
              <li key={text} className="flex gap-2 text-sm text-muted-foreground">
                <ArrowRight className="mt-0.5 size-3.5 shrink-0" />
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tour.total > 0 ? (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Deine Flächen
          </h3>
          <ol className="space-y-2">
            {tour.steps.map((s) => (
              <li key={s.key} className="flex gap-2.5">
                {seen.has(s.key) ? (
                  <Check className="mt-1 size-3.5 shrink-0 text-primary" />
                ) : (
                  <Circle className="mt-1 size-3.5 shrink-0 text-muted-foreground/50" />
                )}
                <div className="min-w-0">
                  <Link
                    href={s.route}
                    className="text-sm font-medium underline-offset-4 hover:underline"
                  >
                    {s.title}
                  </Link>
                  <p className="text-sm text-muted-foreground">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      ) : (
        <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          In diesem Workspace ist für diese Rolle aktuell nichts freigeschaltet. Sobald weitere
          Module dazukommen, erscheinen sie hier.
        </p>
      )}
    </Card>
  );
}
