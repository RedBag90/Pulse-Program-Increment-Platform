import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { filesUnder } from "@/test/helpers/visual-language";

/**
 * **Die Geldflächen behalten ihre Gliederung.**
 *
 * Der Anlass, wörtlich: „Die Visualisierung ist für mich zu fragmentiert …
 * Im Moment wirkt das alles wie eine einzige Seite ohne Abschnitte. Ich muss
 * schon sehr doll hinsehen und den Inhalt der Seite kennen, damit ich finde,
 * was ich suche."
 *
 * Gezählt wurde damals auf **einem** Bildschirm: acht Container-Stile, fünf
 * Flächentöne, sieben Überschriften-Stile in vier Größen — und zwölf von
 * dreizehn Abschnitten ganz ohne Container.
 *
 * **Warum es diesen Test überhaupt braucht:** `visual-language` war die ganze
 * Zeit grün. Er prüft Farbe, Radius und Fokus-Ring — Hierarchie kann er nicht
 * sehen. Grün hiess dort nicht gegliedert.
 *
 * Eng auf die Flächen gefiltert, die umgebaut wurden. Die Kachel
 * (`features/components/period/`) hat denselben Befund und ist **nicht**
 * aufgeräumt — sie hier mitzuprüfen hiesse, einen roten Test zu hinterlassen,
 * der etwas Wahres sagt und niemandem hilft.
 */

const ROOTS = [
  "src/modules/budgeting/features/components/art-budget",
  "src/modules/budgeting/features/components/rtb",
];

/** Blockkommentare raus — sonst meldet der Wächter seine eigene Begründung. */
function withoutComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
}

function scan(check: (src: string, file: string) => string[]): string[] {
  const out: string[] = [];
  for (const root of ROOTS) {
    for (const file of filesUnder(join(process.cwd(), root))) {
      if (!/\.tsx$/.test(file) || file.includes("__tests__")) continue;
      out.push(
        ...check(withoutComments(readFileSync(file, "utf8")), relative(process.cwd(), file)),
      );
    }
  }
  return out;
}

const at = (src: string, index: number) => src.slice(0, index).split("\n").length;

describe("Die Geldflächen behalten ihre Gliederung", () => {
  /**
   * `--muted` und `--background` liegen rund **2 % Helligkeit** auseinander. Ein
   * `bg-muted/20` sieht nach Absicht aus und trägt keine — es gab davon vier
   * Stufen nebeneinander. Tiefe kommt aus der Karte (`shadow-card`), Kopf- und
   * Summenflächen aus `bg-surface-frame`, „gewählt" aus `bg-primary/5`.
   *
   * `hover:bg-muted` ohne Alpha bleibt erlaubt: das ist ein Bedienelement unter
   * dem Zeiger, keine Fläche.
   */
  it("tönt keine Fläche mit einer Alpha-Stufe von bg-muted", () => {
    const treffer = scan((src, file) =>
      [...src.matchAll(/\bbg-muted\/\d+\b/g)].map(
        (m) => `${file}:${at(src, m.index ?? 0)}  „${m[0]}" — Ton ohne Unterschied`,
      ),
    );
    expect(
      treffer,
      `${treffer.length} getönte Fläche(n):\n  · ${treffer.join("\n  · ")}\n\n` +
        "Tiefe trägt die Karte, nicht ein 2-%-Grau. Kopf/Summe: bg-surface-frame. Gewählt: bg-primary/5.",
    ).toEqual([]);
  });

  /**
   * Die Größenleiter stand auf dem Kopf: die Seitenabschnitte trugen 14 px, der
   * aufgeklappte Kasten **darin** 18 px. Das Untergeordnete war optisch das
   * Wichtigste — deshalb verlor man beim Aufklappen den Halt.
   *
   * Es gibt jetzt zwei Stufen: der Abschnitt ist eine `SectionCard` (ihr Titel
   * ist ein `SectionLabel`), der Unterabschnitt ein `<h3 className="text-sm
   * font-medium">`. Eine Überschrift, die größer ist als das, konkurriert mit
   * dem Kartentitel.
   */
  it("setzt keine Überschrift größer als text-sm", () => {
    const treffer = scan((src, file) =>
      [...src.matchAll(/<h[1-6]\s+className="([^"]*)"/g)]
        .filter((m) => /\btext-(base|lg|xl|2xl|3xl)\b/.test(m[1] ?? ""))
        .map((m) => `${file}:${at(src, m.index ?? 0)}  „${m[1]}"`),
    );
    expect(
      treffer,
      `${treffer.length} zu große Überschrift(en):\n  · ${treffer.join("\n  · ")}\n\n` +
        "Abschnitt = SectionCard (SectionLabel). Unterabschnitt = h3.text-sm font-medium.",
    ).toEqual([]);
  });

  /**
   * Der Selbsttest des Wächters: fände er gar keine Dateien, wäre er still grün
   * und niemand merkte es.
   */
  it("hat überhaupt etwas zu prüfen", () => {
    const dateien = scan((_src, file) => [file]);
    // Heute sind es sieben; die Schwelle fängt „Ordner umbenannt, Wächter still".
    expect(dateien.length).toBeGreaterThanOrEqual(6);
  });
});
