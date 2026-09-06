/**
 * Farbmischung für Zeichnungen — **Tönungen statt Deckkraft**.
 *
 * Der Horizont-Trichter baute seine Würfel bis September 2026 aus *einem* Ton
 * bei Deckkraft 0,55 / 0,8 / 1,0 und legte den Betriebssockel als reines
 * Schwarz darüber. Beides sind Behelfe mit sichtbaren Kosten: über Weiß wäscht
 * die helle Fläche aus statt beleuchtet zu wirken, und Schwarz über einer Farbe
 * wird schmutzig, nicht dunkler.
 *
 * Mit einer echten Mischung entstehen stattdessen Tönungen **desselben**
 * Farbtons — heller zur Lichtquelle, dunkler im Sockel.
 *
 * Rein, kein I/O, kein DOM: deshalb hier und nicht in der Komponente.
 */

const clamp255 = (n: number) => Math.max(0, Math.min(255, Math.round(n)));

/**
 * `#rgb` und `#rrggbb` → `[r, g, b]`.
 *
 * Wirft nicht: eine unlesbare Farbe ergibt Schwarz. Ein Zeichenfehler im
 * Farbwert soll die Zeichnung nicht abstürzen lassen — er soll auffallen.
 */
function toRgb(hex: string): [number, number, number] {
  const h = hex.trim().replace(/^#/, "");
  const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return [0, 0, 0];
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

const toHex = (rgb: readonly [number, number, number]) =>
  `#${rgb.map((c) => clamp255(c).toString(16).padStart(2, "0")).join("")}`;

/**
 * Mischt zwei Farben linear: `t = 0` liefert `a`, `t = 1` liefert `b`.
 *
 * Bewusst im sRGB-Raum, nicht perzeptuell. Für kleine Schritte — aufhellen,
 * abdunkeln, einen Hauch über den Hintergrund legen — reicht das, und das
 * Ergebnis ist ohne Bibliothek nachrechenbar. `t` wird auf `0..1` geklemmt.
 */
export function mixHex(a: string, b: string, t: number): string {
  const k = Math.max(0, Math.min(1, t));
  const [ar, ag, ab] = toRgb(a);
  const [br, bg, bb] = toRgb(b);
  return toHex([ar + (br - ar) * k, ag + (bg - ag) * k, ab + (bb - ab) * k]);
}

/** Heller: der Ton, um `amount` gegen Weiß gemischt. */
export const lighten = (hex: string, amount: number) => mixHex(hex, "#ffffff", amount);

/** Dunkler: der Ton, um `amount` gegen Schwarz gemischt. */
export const darken = (hex: string, amount: number) => mixHex(hex, "#000000", amount);
