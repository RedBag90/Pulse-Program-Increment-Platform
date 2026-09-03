/**
 * Der Cookie-Name der Reiter-Erinnerung — bewusst **ohne** `"use client"`.
 *
 * Beide Seiten brauchen ihn: der Server liest das Cookie beim ersten Render
 * (sonst stünde erst „Allgemein" da und spränge danach sichtbar um), die
 * Client-Komponente schreibt es. Stünde er in der Client-Datei, könnte der
 * Server ihn nicht aufrufen — genau daran ist die erste Fassung gescheitert.
 *
 * Je **Knotenart** eine Ablage, weil Wertstrom und ART verschiedene Reiter
 * haben: „Betrieb" gibt es nur beim Wertstrom.
 */
export function tabCookieName(kind: string): string {
  return `pulse-structure-tab-${kind}`;
}

/** 90 Tage — die Erinnerung ist eine Bequemlichkeit, kein Geheimnis. */
export const TAB_COOKIE_MAX_AGE = 60 * 60 * 24 * 90;
