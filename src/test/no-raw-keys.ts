import { expect } from "vitest";
import de from "../../messages/de.json";

/**
 * **Ein Katalog-Schlüssel gehört nie in den Bildschirm.**
 *
 * Im September 2026 standen auf dem Delivery-Board die Bahnen als
 * `DRUMBEAT.FEATURESTATUS.INPROGRESS` — in Grossbuchstaben, weil die
 * Beschriftung `uppercase` gesetzt ist. Insgesamt sieben Flächen taten das,
 * und **kein** Wächter hat eine davon gesehen:
 *
 *  - `key-shape.test.ts` sucht den Schlüsselbezug im Quelltext. Hier stand der
 *    Schlüssel in einem Feld namens `label` und wurde 245 Zeilen später als
 *    `{lane.label}` gezeichnet — dazwischen eine Variablenbindung, die kein
 *    Regex verfolgt. Zwei der sieben benannten die Karte beim Import sogar um
 *    (`FEATURE_STATUS_KEYS as STATUS_LABEL`); dort ist das Wort `_KEYS` aus
 *    dem Quelltext verschwunden, und **kein** Quelltext-Wächter kann sie je
 *    finden.
 *  - `translated-surfaces.test.ts` sucht rohe **Literale**. Ein
 *    Schlüssel-Bezug sieht für ihn aus wie eine gelungene Umstellung.
 *  - Die strenge `t()`-Attrappe wirft bei einem **falschen** Schlüssel. Sie ist
 *    blind gegen einen **richtigen**, der nie durch `t()` geht.
 *
 * Deshalb prüft dieser Wächter die andere Seite: nicht den Quelltext, sondern
 * das Ergebnis. Er läuft nach **jedem** Client-Test mit, über das, was dieser
 * Test ohnehin gerendert hat — und erwischt damit auch die Umbenennungen.
 *
 * **Was als Schlüssel gilt.** Eine Zeichenkette ohne Leerzeichen, mit
 * mindestens drei punktgetrennten Gliedern, deren erstes ein echter
 * Katalog-Namensraum ist (`work.`, `drumbeat.`, `budgeting.` …). Damit fallen
 * Dateinamen, Versionen und Fliesstext mit Punkten nicht darunter — es muss
 * wie ein Schlüssel aussehen **und** einer sein können.
 */

const NAMENSRAEUME = new Set(Object.keys(de as Record<string, unknown>));

/** `wort.wort.wort` — kleingeschrieben, ohne Leerzeichen, mindestens drei Glieder. */
const SCHLUESSELFORM = /^[a-z][A-Za-z0-9]*(?:\.[A-Za-z0-9]+){2,}$/;

/** Alle sichtbaren Textstücke — Textknoten plus die Attribute, die ein Nutzer liest. */
function textstuecke(wurzel: ParentNode): string[] {
  const out: string[] = [];
  const lauf = document.createTreeWalker(wurzel as Node, NodeFilter.SHOW_TEXT);
  for (let n = lauf.nextNode(); n != null; n = lauf.nextNode()) {
    const s = n.textContent?.trim();
    if (s) out.push(s);
  }
  for (const el of (wurzel as Element).querySelectorAll?.("[aria-label],[title],[placeholder]") ??
    []) {
    for (const attr of ["aria-label", "title", "placeholder"]) {
      const v = el.getAttribute(attr)?.trim();
      if (v) out.push(v);
    }
  }
  return out;
}

/** Findet rohe Katalog-Schlüssel im gerenderten Baum. */
export function rawKeysIn(wurzel: ParentNode): string[] {
  return [
    ...new Set(
      textstuecke(wurzel).filter(
        (s) => SCHLUESSELFORM.test(s) && NAMENSRAEUME.has(s.slice(0, s.indexOf("."))),
      ),
    ),
  ];
}

/** Die Zusicherung, die nach jedem Client-Test läuft. */
export function expectNoRawKeys(wurzel: ParentNode = document.body): void {
  const funde = rawKeysIn(wurzel);
  expect(
    funde,
    funde.length === 0
      ? ""
      : `\nRohe Katalog-Schlüssel im gerenderten Baum — es fehlt ein t(…):\n  · ${funde.join("\n  · ")}\n`,
  ).toEqual([]);
}
