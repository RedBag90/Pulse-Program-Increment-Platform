import { describe, it, expect } from "vitest";
import { spotlightRect, cardPlacement, centeredCard, SPOTLIGHT_PADDING } from "../spotlight";

const VIEWPORT = { width: 1200, height: 800 };

describe("spotlightRect", () => {
  it("polstert das Ziel allseitig", () => {
    const hole = spotlightRect({ top: 100, left: 200, width: 300, height: 40 }, VIEWPORT);
    expect(hole).toEqual({
      top: 100 - SPOTLIGHT_PADDING,
      left: 200 - SPOTLIGHT_PADDING,
      width: 300 + 2 * SPOTLIGHT_PADDING,
      height: 40 + 2 * SPOTLIGHT_PADDING,
    });
  });

  it("klemmt am oberen/linken Rand statt negativ zu werden", () => {
    const hole = spotlightRect({ top: 2, left: 0, width: 100, height: 20 }, VIEWPORT);
    expect(hole.top).toBe(0);
    expect(hole.left).toBe(0);
  });

  it("wächst nicht über den sichtbaren Bereich hinaus", () => {
    const hole = spotlightRect(
      { top: 790, left: 1190, width: 400, height: 400 },
      VIEWPORT,
    );
    expect(hole.left + hole.width).toBeLessThanOrEqual(VIEWPORT.width);
    expect(hole.top + hole.height).toBeLessThanOrEqual(VIEWPORT.height);
  });

  it("ein vollständig weggescrolltes Ziel ergibt kein negatives Rechteck", () => {
    const hole = spotlightRect({ top: -500, left: -500, width: 100, height: 100 }, VIEWPORT);
    expect(hole.width).toBeGreaterThanOrEqual(0);
    expect(hole.height).toBeGreaterThanOrEqual(0);
  });
});

describe("cardPlacement", () => {
  const hole = { top: 100, left: 500, width: 200, height: 40 };

  it("setzt die Karte unter das Loch, wenn Platz ist", () => {
    const p = cardPlacement(hole, VIEWPORT, 180);
    expect(p.side).toBe("below");
    expect(p.top).toBeGreaterThan(hole.top + hole.height);
  });

  it("weicht nach oben aus, wenn unten kein Platz mehr ist", () => {
    const low = { top: 700, left: 500, width: 200, height: 40 };
    const p = cardPlacement(low, VIEWPORT, 300);
    expect(p.side).toBe("above");
    expect(p.top + 300).toBeLessThanOrEqual(low.top);
  });

  it("zentriert horizontal am Loch", () => {
    const p = cardPlacement(hole, VIEWPORT, 180);
    expect(p.left + p.width / 2).toBeCloseTo(hole.left + hole.width / 2, 0);
  });

  it("bleibt bei einem Ziel ganz rechts vollständig sichtbar", () => {
    const p = cardPlacement({ top: 100, left: 1150, width: 40, height: 40 }, VIEWPORT, 180);
    expect(p.left).toBeGreaterThanOrEqual(0);
    expect(p.left + p.width).toBeLessThanOrEqual(VIEWPORT.width);
  });

  it("bleibt bei einem Ziel ganz links vollständig sichtbar", () => {
    const p = cardPlacement({ top: 100, left: 0, width: 40, height: 40 }, VIEWPORT, 180);
    expect(p.left).toBeGreaterThanOrEqual(0);
  });

  it("schrumpft auf schmalen Viewports statt überzulaufen", () => {
    const narrow = { width: 320, height: 640 };
    const p = cardPlacement({ top: 50, left: 10, width: 100, height: 30 }, narrow, 200);
    expect(p.width).toBeLessThanOrEqual(narrow.width);
    expect(p.left + p.width).toBeLessThanOrEqual(narrow.width);
  });
});

describe("centeredCard", () => {
  it("liegt mittig im Viewport", () => {
    const p = centeredCard(VIEWPORT, 200);
    expect(p.left + p.width / 2).toBeCloseTo(VIEWPORT.width / 2, 0);
    expect(p.top + 100).toBeCloseTo(VIEWPORT.height / 2, 0);
  });

  it("bleibt auch auf sehr kleinen Viewports im Bild", () => {
    const tiny = { width: 280, height: 400 };
    const p = centeredCard(tiny, 500);
    expect(p.top).toBeGreaterThanOrEqual(0);
    expect(p.left).toBeGreaterThanOrEqual(0);
    expect(p.left + p.width).toBeLessThanOrEqual(tiny.width);
  });
});
