import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

/**
 * **Der Fehler, der nichts kaputt macht.**
 *
 * `tailwind-merge` kennt nur seine eingebaute Größenleiter. Die Haus-Tokens
 * `text-label` (10 px) und `text-meta` (11 px) hält es ohne Anmeldung für
 * **Farben** — und lässt dann in `cn("text-meta text-muted-foreground")` die
 * hintere Klasse gewinnen. Der Text rendert in 16 px, nichts wirft, nichts
 * fällt auf; gemessen traf es acht Stellen im Quellbaum, darunter die
 * Horizont-Pille der Organisations-Karte.
 *
 * Deshalb steht die Zusicherung hier und nicht im Vertrauen.
 */
describe("cn — die Haus-Schriftgrößen überleben eine Farbe daneben", () => {
  it("behält Größe und Farbe, in beiden Reihenfolgen", () => {
    expect(cn("text-meta text-muted-foreground")).toBe("text-meta text-muted-foreground");
    expect(cn("text-muted-foreground text-meta")).toBe("text-muted-foreground text-meta");
    expect(cn("text-label font-semibold text-warning")).toBe(
      "text-label font-semibold text-warning",
    );
  });

  it("verrechnet echte Größen-Konflikte weiterhin", () => {
    expect(cn("text-meta", "text-xs")).toBe("text-xs");
    expect(cn("text-sm", "text-label")).toBe("text-label");
    expect(cn("text-xs", "text-sm")).toBe("text-sm");
  });

  it("lässt alles Übrige, wie es war", () => {
    expect(cn("px-2", false && "hidden", "py-1")).toBe("px-2 py-1");
    expect(cn("bg-card", "bg-muted")).toBe("bg-muted");
  });
});
