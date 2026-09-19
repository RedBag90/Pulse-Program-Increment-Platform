import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * **Der Scroll-Rahmen der Anwendung muss positioniert sein.**
 *
 * Tailwinds `.sr-only` setzt `position: absolute`. Ein absolut positioniertes
 * Element hängt an seinem nächsten **positionierten** Vorfahren — gibt es
 * keinen, ist das der Dokument-Block. Dann beschneidet weder das
 * `overflow-y-auto` des Rahmens noch das `overflow-hidden` darüber: die Marke
 * landet an ihrer statischen Stelle tief im gescrollten Inhalt und verlängert
 * **das Dokument**.
 *
 * Das Ergebnis ist ein zweiter, unsichtbarer Rollbalken über dem echten. Im
 * Browser gemessen: `/structure/rollen` trug 26 solcher Marken und **1431 px**
 * Phantom-Weg, `/structure` 224 px. Wer scrollte, bewegte mal den Inhalt und
 * mal die ganze Seite.
 *
 * `relative` am `<main>` macht es zum umschließenden Block — die Marken werden
 * wieder mitgescrollt statt die Seite zu strecken. Eine Zeile für jede Fläche;
 * genau deshalb steht hier ein Wächter und kein Kommentar.
 */
const LAYOUT = join(process.cwd(), "src/app/[locale]/(dashboard)/layout.tsx");

/** Die Klassen des `<main>`-Elements einer Layout-Quelle. */
export function mainClasses(source: string): string | null {
  const m = /<main\s+className=\{?"([^"]*)"/.exec(source);
  return m ? m[1]! : null;
}

describe("der Melder selbst", () => {
  it("liest die Klassen des main-Elements", () => {
    expect(mainClasses('<main className="a b c">x</main>')).toBe("a b c");
    expect(mainClasses("<section>kein main</section>")).toBeNull();
  });
});

describe("das Dashboard-Layout", () => {
  const source = readFileSync(LAYOUT, "utf8");
  const classes = mainClasses(source);

  it("hat ein <main> mit Klassen", () => {
    expect(classes).not.toBeNull();
  });

  it("scrollt in sich — und ist dabei positioniert", () => {
    expect(classes).toContain("overflow-y-auto");
    expect(
      classes,
      "\nOhne `relative` entkommen `sr-only`-Marken dem Beschnitt und erzeugen\n" +
        "einen zweiten Rollbalken über dem echten. Siehe Kopf dieser Datei.\n",
    ).toContain("relative");
  });
});
