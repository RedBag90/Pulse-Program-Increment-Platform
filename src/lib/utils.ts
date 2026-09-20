import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * **`tailwind-merge` muss die Haus-Tokens kennen — sonst frisst es sie.**
 *
 * `text-label` (10 px) und `text-meta` (11 px) sind eigene Schriftgrößen aus
 * `globals.css`. `tailwind-merge` kennt nur seine eingebaute Leiter; alles
 * andere hinter `text-` hält es für eine **Farbe**. Damit landen `text-meta` und
 * `text-muted-foreground` in derselben Gruppe, und die hintere gewinnt:
 *
 * ```
 * cn("text-meta text-muted-foreground")  →  "text-muted-foreground"   // 16 px!
 * cn("text-muted-foreground text-meta")  →  "text-meta"               // farblos
 * ```
 *
 * Es fällt nicht auf, weil nichts bricht — der Text rendert einfach in der
 * Grundgröße des Browsers. Gemessen traf es **acht Stellen** im Quellbaum, unter
 * anderem die Horizont-Pille der Organisations-Karte und die Tor-Marken der
 * Rollenverteilung: 16 px statt 11, mitten in einer Kachel aus 12ern.
 *
 * Die Reparatur gehört hierher und nicht in acht Komponenten: wer die beiden
 * Tokens als Schriftgrößen anmeldet, hat den ganzen Baum erledigt — auch die
 * Stellen, die noch niemand geschrieben hat.
 */
const twMerge = extendTailwindMerge({
  extend: { classGroups: { "font-size": [{ text: ["label", "meta"] }] } },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
