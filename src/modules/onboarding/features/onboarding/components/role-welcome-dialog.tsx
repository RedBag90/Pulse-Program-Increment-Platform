"use client";

import { useState, useTransition } from "react";
import { ArrowRight, Check, Compass, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS } from "@/modules/core/kernel/domain/roles";
import { MODULES } from "@/modules/core/kernel/domain/modules";
import type { Notice } from "@/modules/onboarding/domain/role-tour";
import { acknowledgeRoleAction } from "@/modules/onboarding/features/onboarding/actions/role-onboarding";

/**
 * Das Fenster, das eine Rollenzuweisung überhaupt erst sichtbar macht.
 *
 * Zwei Varianten aus einer Komponente, gesteuert von `notice.kind`:
 *
 * - **`new_role`** — die Rolle ist neu und noch nicht quittiert. Bewusst
 *   *nicht* per Klick daneben schließbar: der Nutzer soll einmal aktiv zur
 *   Kenntnis nehmen, was er jetzt verantwortet.
 * - **`new_scope`** — die Rolle ist längst angenommen, es sind nur Aufgaben
 *   dazugekommen (Modul freigeschaltet, Practice aktiviert, Recht nachgezogen).
 *   Hier wäre ein blockierender Dialog übergriffig: schaltet ein Admin ein
 *   Modul ein, würde er alle aktiven Nutzer gleichzeitig unterbrechen. Also
 *   schließbar, und „Nicht jetzt" speichert nichts — der Hinweis kommt wieder,
 *   bis die Schritte gesehen sind.
 */

interface Props {
  notice: Notice;
  /** Nutzer hat die Rolle angenommen und will die Tour sehen. */
  onStartTour: () => void;
  /** Fenster ist erledigt (angenommen ohne Tour, oder weggeklickt). */
  onDismiss: () => void;
}

export function RoleWelcomeDialog({ notice, onStartTour, onDismiss }: Props) {
  // Kein `useActionState`: dessen Dispatch gehört an ein `action`/`formAction`
  // eines Formulars. Hier hängt die Quittung an einem Button, deshalb die Action
  // direkt in einer Transition aufrufen — dasselbe Muster wie in
  // `setup-checklist.tsx`. Nebeneffekt: wir sehen das Ergebnis und schalten erst
  // bei Erfolg weiter, statt blind zu quittieren.
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isNewRole = notice.kind === "new_role";
  const label = ROLE_LABELS[notice.role];
  const hasSteps = notice.open.length > 0;

  /** Quittiert die Rolle und geht erst weiter, wenn das geklappt hat. */
  const acknowledgeThen = (next: () => void) => {
    setError(null);
    const fd = new FormData();
    fd.set("role", notice.role);
    startTransition(async () => {
      const res = await acknowledgeRoleAction({}, fd);
      if (res.error) {
        setError(res.error);
        return;
      }
      next();
    });
  };

  // Schritte können aus zwei Gründen dazukommen: ein Modul wurde freigeschaltet
  // — oder es gibt jetzt Bestand, den es vorher nicht gab (erstes Epic, erstes
  // PI). Im zweiten Fall ist `modules` leer, und ohne diese Verzweigung stünde
  // dort „ ist freigeschaltet".
  const newModules =
    notice.kind === "new_scope" && notice.modules.length > 0
      ? notice.modules.map((m) => MODULES[m].label).join(" und ")
      : null;
  const scopeTitle = newModules
    ? `${newModules} ist freigeschaltet`
    : "Neue Aufgaben in deiner Rolle";

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        // new_role bleibt stehen, bis aktiv entschieden wurde.
        if (!open && !isNewRole) onDismiss();
      }}
    >
      <DialogContent
        showCloseButton={!isNewRole}
        className="sm:max-w-lg"
        aria-live="polite"
      >
        <DialogHeader>
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            {isNewRole ? <Sparkles className="size-4" /> : <Compass className="size-4" />}
            {isNewRole ? "Neue Rolle" : "Neue Aufgaben"}
          </div>
          <DialogTitle className="font-heading text-xl">
            {isNewRole ? label : scopeTitle}
          </DialogTitle>
          <DialogDescription>
            {isNewRole
              ? notice.tour.mission
              : `Als ${label} kommen dadurch ${notice.open.length} ${
                  notice.open.length === 1 ? "Aufgabe" : "Aufgaben"
                } dazu.`}
          </DialogDescription>
        </DialogHeader>

        {isNewRole && notice.tour.responsibilities.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Deine Verantwortung
            </h3>
            <ul className="space-y-1.5">
              {notice.tour.responsibilities.map((text) => (
                <li key={text} className="flex gap-2 text-sm">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {isNewRole && notice.tour.handoffs.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Zusammenspiel
            </h3>
            <ul className="space-y-1.5">
              {notice.tour.handoffs.map((text) => (
                <li key={text} className="flex gap-2 text-sm text-muted-foreground">
                  <ArrowRight className="mt-0.5 size-3.5 shrink-0" />
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {!isNewRole && (
          <ul className="space-y-1.5">
            {notice.open.map((s) => (
              <li key={s.key} className="flex gap-2 text-sm">
                <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                <span>{s.title}</span>
              </li>
            ))}
          </ul>
        )}

        {isNewRole && !hasSteps && (
          <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            In diesem Workspace ist für diese Rolle aktuell nichts freigeschaltet. Sobald weitere
            Module dazukommen, melden wir uns hier wieder.
          </p>
        )}

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <DialogFooter showCloseButton={false}>
          {isNewRole ? (
            <>
              {hasSteps && (
                <Button variant="ghost" disabled={pending} onClick={() => acknowledgeThen(onDismiss)}>
                  Annehmen, Tour später
                </Button>
              )}
              <Button disabled={pending} onClick={() => acknowledgeThen(hasSteps ? onStartTour : onDismiss)}>
                {hasSteps ? "Rolle annehmen & Tour starten" : "Verstanden"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={onDismiss}>
                Nicht jetzt
              </Button>
              <Button onClick={onStartTour}>Ansehen</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
