import type { Horizon } from "@/modules/core/org/domain/horizon";

/**
 * **Die Horizont-Töne — als reines Modul, nicht als Teil des Abzeichens.**
 *
 * Sie standen bis September 2026 in `horizon-badge.tsx`. Das ist ein
 * `"use client"`-Modul, und aus einer **Server**-Komponente importiert liefert
 * es keine Werte, sondern Client-Referenzen: `HORIZON_BADGE_CLASS[h]` war dort
 * `undefined`, und die Struktur-Fläche stürzte beim Rendern ab. Ein jsdom-Test
 * kann das nicht sehen — er rendert clientseitig, wo das Modul normal auflöst.
 *
 * Deshalb liegen die Töne jetzt hier, ohne Direktive: Server **und** Client
 * lesen dieselbe Datei. Das Abzeichen bleibt, was es ist — eine Komponente.
 */

/**
 * Farbklassen je Horizont — Punkt + weicher Hintergrund (Anzeige-Konsistenz).
 *
 * **Die Töne sind nach Nähe zur Wertschöpfung geordnet**, nicht nach Laune:
 * violett (fern, erkundend) → türkis (wachsend) → orange (der Kern, wo das Geld
 * liegt) → steingrau (im Abgang). Vorher standen hier Fuchsia, Violett, Blau
 * und Schiefer — drei Einwände dagegen, alle nachprüfbar:
 *
 *  1. Fuchsia und Violett sind Nachbartöne und bei Symbolgröße im
 *     Horizont-Trichter kaum zu unterscheiden — ausgerechnet bei den beiden
 *     Bahnen mit den vielen kleinen Posten.
 *  2. H1 trug das **Primärblau** der Anwendung. Links und Schaltflächen sind
 *     blau; der Kern-Horizont sah dadurch aus wie Bedienelement, nicht wie
 *     Inhalt.
 *  3. Die vier Töne hatten keine Reihenfolge, obwohl die Sache eine hat.
 */
export const HORIZON_BADGE_CLASS: Record<Horizon, { pill: string; dot: string }> = {
  h3: {
    pill: "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
    dot: "bg-violet-600",
  },
  h2: {
    pill: "bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
    dot: "bg-teal-600",
  },
  h1: {
    pill: "bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
    dot: "bg-orange-600",
  },
  h0: {
    pill: "bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300",
    dot: "bg-stone-500",
  },
};

/**
 * Dieselben Toene als Farbwert — Balken, Quadrate und SVG koennen keine
 * Tailwind-Klasse tragen. Steht bewusst neben `HORIZON_BADGE_CLASS`, damit die
 * zwei Definitionen desselben Farbraums nicht auseinanderlaufen.
 */
export const HORIZON_HEX: Record<Horizon, string> = {
  h3: "#7c3aed", // violet-600 — fern, erkundend
  h2: "#0d9488", // teal-600 — wachsend
  h1: "#ea580c", // orange-600 — der Kern, wo das Geld liegt
  h0: "#78716c", // stone-500 — entsättigt, im Abgang
};

/**
 * „Ohne Horizont" — der Neutralton für alles, was (noch) nirgends steht.
 * Bewusst ein reines Grau: es soll sich keiner Bahn zuordnen lassen.
 */
export const HORIZON_NONE_HEX = "#a1a1aa"; // zinc-400
