"use client";

import { useEffect, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import type { Notice } from "@/modules/onboarding/domain/role-tour";
import { subscribeTour, type TourRequest } from "@/modules/onboarding/features/onboarding/tour-channel";
import { RoleWelcomeDialog } from "./role-welcome-dialog";
import { RoleTourOverlay } from "./role-tour-overlay";

/**
 * Der globale Einstiegspunkt des Rollen-Onboardings — der einzige Berührungs-
 * punkt des Moduls mit `src/app`.
 *
 * Hängt als Geschwister des Seiteninhalts im Dashboard-Layout. Das ist keine
 * Kosmetik: das Layout bleibt über Client-Navigation hinweg montiert, und nur
 * deshalb kann eine Tour über mehrere Seiten laufen, ohne bei jedem
 * Seitenwechsel neu zu starten.
 *
 * Die Warteschlange wird der Reihe nach abgearbeitet (`onboardingNotices`
 * liefert sie in stabiler Rollen-Reihenfolge), damit jemand mit zwei neuen
 * Rollen nicht zwei Fenster übereinander bekommt.
 *
 * Zweiter Weg hinein: ein Auftrag über `tour-channel`. Den schickt der Knopf
 * „Tour erneut starten" auf `/meine-rolle`. Ohne ihn ginge das nicht — `notices`
 * ist ein Schnappschuss vom ersten Aufbau des Layouts (siehe unten), und die
 * Warteschlange ist auf dieser Seite ohnehin meist leer.
 */

interface Props {
  notices: Notice[];
}

export function RoleOnboardingMount({ notices }: Props) {
  // Absichtlich nur der Anfangswert: neue Server-Props werden **nicht**
  // übernommen. Sonst käme ein mit „Nicht jetzt" weggeklickter Hinweis nach
  // jeder Speicheraktion irgendwo in der App zurück — weggeklickt wird nur im
  // Arbeitsspeicher gemerkt, nicht in der Datenbank.
  const [queue, setQueue] = useState(notices);
  const [touring, setTouring] = useState(false);
  const [manual, setManual] = useState<TourRequest | null>(null);
  const router = useRouter();

  useEffect(() => subscribeTour(setManual), []);

  /** Aktuelle Notice abschließen und zur nächsten gehen. */
  const advance = () => {
    setTouring(false);
    setQueue((q) => q.slice(1));
  };

  // Vor dem Warteschlangen-Zweig: eine angeforderte Tour läuft unabhängig davon,
  // ob es offene Hinweise gibt — auf `/meine-rolle` gibt es meist keine.
  if (manual) {
    return (
      <RoleTourOverlay
        role={manual.role}
        steps={manual.steps}
        onFinish={() => {
          setManual(null);
          // `markStepsSeenAction` revalidiert bewusst nicht (sonst ruckelte
          // jeder Schrittwechsel). Ohne diesen Anstoß stünde die Seite hinter
          // der Tour mit veralteten Haken da.
          router.refresh();
        }}
      />
    );
  }

  const current = queue[0];
  if (!current) return null;

  if (touring) {
    return <RoleTourOverlay role={current.role} steps={current.open} onFinish={advance} />;
  }

  return (
    <RoleWelcomeDialog notice={current} onStartTour={() => setTouring(true)} onDismiss={advance} />
  );
}
