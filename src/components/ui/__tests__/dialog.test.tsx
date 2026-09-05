import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

/**
 * Ein Dialog darf nie höher werden als das Fenster.
 *
 * Er war es: die Breite war gegen das Fenster gedeckelt, die Höhe nicht, und es
 * gab kein `overflow`. Wuchs der Inhalt darüber hinaus, schob die Zentrierung
 * die obere Hälfte hinaus — unerreichbar, weil das Popup `fixed` ist und der
 * Body-Scroll gesperrt ist, solange der Dialog offen ist. 22 der 23 Aufrufer
 * hatten dagegen nichts; genau einer deckelte sich selbst.
 *
 * Der Test liest Klassennamen, und das ist hier die einzige ehrliche Wahl:
 * jsdom rechnet kein Layout, „ragt aus dem Fenster" ist dort nicht messbar. Die
 * Zusicherung, die er hält, ist trotzdem die richtige — dass die **Primitive**
 * diese Regel trägt, statt sie jedem Aufrufer zu überlassen.
 */
function open(className?: string) {
  render(
    <Dialog open>
      <DialogContent {...(className ? { className } : {})}>
        <DialogTitle>Titel</DialogTitle>
        <p>Inhalt</p>
      </DialogContent>
    </Dialog>,
  );
  return document.querySelector('[data-slot="dialog-content"]')!;
}

describe("DialogContent", () => {
  it("deckelt seine Höhe gegen das Fenster", () => {
    expect(open().className).toContain("max-h-[calc(100dvh-2rem)]");
  });

  it("macht überschüssigen Inhalt scrollbar", () => {
    expect(open().className).toContain("overflow-y-auto");
  });

  it("deckelt Höhe und Breite mit demselben Rand", () => {
    // Oben/unten derselbe Abstand wie links/rechts — sonst sieht der gedeckelte
    // Dialog aus wie ein Fehler statt wie eine Absicht.
    const cls = open().className;
    expect(cls).toContain("max-w-[calc(100%-2rem)]");
    expect(cls).toContain("max-h-[calc(100dvh-2rem)]");
  });

  it("laesst den Aufrufer seine Breite weiterhin setzen", () => {
    const cls = open("max-w-lg").className;
    expect(cls).toContain("max-w-lg");
    expect(cls).toContain("max-h-[calc(100dvh-2rem)]");
  });

  it("rendert den Inhalt", () => {
    open();
    expect(screen.getByText("Inhalt")).toBeInTheDocument();
  });
});
