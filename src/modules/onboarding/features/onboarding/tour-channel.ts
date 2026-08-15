"use client";

import type { Role } from "@/modules/core/kernel/domain/roles";
import type { TourStep } from "@/modules/onboarding/domain/role-playbook";

/**
 * Ein schmaler Kanal zum montierten Tour-Overlay.
 *
 * Warum überhaupt: das Overlay wird ausschließlich von `RoleOnboardingMount`
 * gerendert, und der hängt im Dashboard-Layout — bewusst, denn nur dort
 * überlebt eine Tour den Seitenwechsel. Wer die Tour anstoßen will (der Knopf
 * „Tour erneut starten" auf `/meine-rolle`), sitzt dagegen im Seiteninhalt.
 * Zwei Zweige desselben Baums, die einander keine Props reichen können.
 *
 * Deshalb dasselbe Muster, das `sonner` für `toast()` gegen den montierten
 * `<Toaster />` benutzt: ein Modul-Set von Zuhörern. Der Mount ist genau so ein
 * Singleton.
 *
 * Bewusst ohne Zwischenspeicher: ein Auftrag ohne Zuhörer verfällt. Ein
 * gepufferter Auftrag würde beim nächsten Aufbau des Layouts eine Tour starten,
 * die niemand mehr angefordert hat.
 */

export interface TourRequest {
  role: Role;
  steps: readonly TourStep[];
}

type Listener = (request: TourRequest) => void;

const listeners = new Set<Listener>();

/** Startet die Tour im montierten Overlay. */
export function requestTour(request: TourRequest): void {
  for (const listener of listeners) listener(request);
}

/** Meldet einen Zuhörer an; der Rückgabewert meldet ihn wieder ab. */
export function subscribeTour(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
