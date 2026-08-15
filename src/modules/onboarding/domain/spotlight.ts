/**
 * Reine Geometrie des Tour-Overlays — bewusst ohne DOM und ohne React, damit
 * die fummeligen Randfälle (Element am Bildschirmrand, Karte passt nicht mehr
 * darunter) unit-testbar sind statt nur „sieht gut aus".
 *
 * Das Loch im Overlay wird nicht per SVG-Maske gestanzt, sondern per
 * `box-shadow: 0 0 0 9999px …` auf einem Rechteck über dem Ziel — deshalb
 * reicht hier ein Rect, und das Zielelement bleibt anklickbar.
 */

export interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface Viewport {
  width: number;
  height: number;
}

/** Luft zwischen Zielelement und Lochkante. */
export const SPOTLIGHT_PADDING = 8;
/** Abstand zwischen Loch und Karte. */
const CARD_GAP = 12;
const CARD_WIDTH = 360;
const EDGE = 16;

/**
 * Das Loch: das Zielrechteck, gepolstert und am Viewport geklemmt. Negative
 * Ränder (teilweise weggescrolltes Element) werden abgeschnitten, damit das
 * Loch nie über den sichtbaren Bereich hinauswächst.
 */
export function spotlightRect(target: Rect, viewport: Viewport, padding = SPOTLIGHT_PADDING): Rect {
  const top = Math.max(0, target.top - padding);
  const left = Math.max(0, target.left - padding);
  const right = Math.min(viewport.width, target.left + target.width + padding);
  const bottom = Math.min(viewport.height, target.top + target.height + padding);
  return {
    top,
    left,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}

export interface CardPlacement {
  top: number;
  left: number;
  width: number;
  /** Wo die Karte relativ zum Loch sitzt — die UI dreht daran ihren Pfeil. */
  side: "below" | "above";
}

/**
 * Platziert die Erklärkarte unter dem Loch, oder darüber, wenn unten nicht mehr
 * genug Platz ist. Horizontal am Loch ausgerichtet und am Viewport geklemmt, so
 * dass die Karte auch bei einem Ziel ganz rechts oder links vollständig sichtbar
 * bleibt.
 */
export function cardPlacement(
  hole: Rect,
  viewport: Viewport,
  cardHeight: number,
  cardWidth: number = CARD_WIDTH,
): CardPlacement {
  const width = Math.min(cardWidth, Math.max(0, viewport.width - 2 * EDGE));

  const below = hole.top + hole.height + CARD_GAP;
  const fitsBelow = below + cardHeight + EDGE <= viewport.height;
  const side: CardPlacement["side"] = fitsBelow ? "below" : "above";
  const top = fitsBelow
    ? below
    : Math.max(EDGE, hole.top - CARD_GAP - cardHeight);

  const desiredLeft = hole.left + hole.width / 2 - width / 2;
  const left = Math.min(Math.max(EDGE, desiredLeft), Math.max(EDGE, viewport.width - width - EDGE));

  return { top, left, width, side };
}

/** Zentrierte Karte — der Fallback, wenn ein Schritt keinen Anker hat oder er fehlt. */
export function centeredCard(
  viewport: Viewport,
  cardHeight: number,
  cardWidth: number = CARD_WIDTH,
): CardPlacement {
  const width = Math.min(cardWidth, Math.max(0, viewport.width - 2 * EDGE));
  return {
    top: Math.max(EDGE, viewport.height / 2 - cardHeight / 2),
    left: Math.max(EDGE, viewport.width / 2 - width / 2),
    width,
    side: "below",
  };
}
