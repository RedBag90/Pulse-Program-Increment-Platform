/**
 * **Tippen in Netzplan, Fahrplan und Ziele-Rad.** Mit der Maus hebt das Überfahren
 * hervor und ein Klick öffnet. Touch kennt kein Überfahren: dort hebt das
 * erste Tippen hervor, erst das zweite auf dasselbe Element öffnet.
 */
export function tapAction(
  isTouch: boolean,
  focusedId: string | null,
  nodeId: string,
): "focus" | "open" {
  return isTouch && focusedId !== nodeId ? "focus" : "open";
}
