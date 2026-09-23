"use client";

import { useEffect, useState } from "react";

/**
 * Ein Erfolg ist ein **Ereignis**, kein Zustand.
 *
 * `state.success` einer Server-Action bleibt bis zum nächsten Laden gesetzt;
 * ohne diesen Haken stünden nach drei Änderungen drei Häkchen da und
 * behaupteten, gerade eben sei etwas passiert.
 *
 * Stand bis September 2026 wortgleich an zwei Stellen (`role-slot.tsx`,
 * `epic-owner-assign.tsx`) und wäre mit dem Produkt-Manager das dritte Mal
 * abgeschrieben worden. Wer eine Bestätigung zeigt, die von selbst verschwindet,
 * nimmt ihn von hier.
 */
export function useTransientFlag(on: boolean, ms = 2500): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!on) return;
    setShown(true);
    const t = window.setTimeout(() => setShown(false), ms);
    return () => window.clearTimeout(t);
  }, [on, ms]);
  return shown;
}
