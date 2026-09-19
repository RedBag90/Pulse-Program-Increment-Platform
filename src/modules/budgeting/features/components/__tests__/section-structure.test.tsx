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

/**
 * **Verspricht dieser `<SectionCard …>` eine Arbeitsfläche, ohne eine zu sein?**
 *
 * Als benannte Funktion, damit der Detektor selbst geprüft werden kann — ohne
 * das wäre „keine Verstöße" von „Regex kaputt" nicht zu unterscheiden
 * (dasselbe Muster wie in `rsc-boundary.test.tsx`).
 */
/**
 * **Die Props eines Tags, vollständig.**
 *
 * Hier stand `/<SectionCard\b([\s\S]*?)>/` — und das war zu kurz gesprungen:
 * das erste `>` beendete den Fund, auch wenn es mitten in einem Prop-Wert
 * stand. Eine `description={<>…</>}` schnitt damit alle Props ab, die danach
 * kamen; eine Karte mit `action` galt als eine ohne. Der Fehler war still: der
 * Wächter meldete einen Verstoß, den es nicht gab, und hätte umgekehrt genauso
 * gut einen echten übersehen.
 *
 * Deshalb ein Durchlauf statt eines Musters: er zählt geschweifte Klammern und
 * überspringt Zeichenketten; das schliessende `>` ist das erste auf Tiefe 0.
 */
export function propsOfTag(src: string, start: number): string {
  let i = src.indexOf(" ", start);
  if (i < 0) return "";
  let depth = 0;
  let quote: string | null = null;
  for (; i < src.length; i++) {
    const c = src[i]!;
    if (quote != null) {
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      quote = c;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") depth--;
    else if (c === ">" && depth === 0) return src.slice(start, i);
  }
  return src.slice(start);
}

export function schieneOhneAufgabe(props: string): boolean {
  const istArbeit = /\bwork\b/.test(props) || /\bstep=/.test(props);
  const hatAufgabe = /\bstep=/.test(props) || /\baction=/.test(props);
  return istArbeit && !hatAufgabe;
}

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
   * **Die Akzentschiene ist ein Versprechen** (REQ-17 der Prozess-Spec): sie
   * sagt „hier tue ich etwas". Eine `SectionCard` mit `work`, aber ohne
   * Schrittnummer und ohne Aktion, verspricht eine Arbeitsfläche und hält
   * nichts — dann wäre die Schiene wieder Dekoration, und der Unterschied,
   * für den es sie gibt, verschwände zum zweiten Mal.
   *
   * `step` allein genügt: es macht die Karte implizit zur Arbeitsfläche und
   * benennt zugleich, wozu.
   */
  it("verspricht keine Arbeitsfläche ohne Aufgabe", () => {
    const treffer = scan((src, file) =>
      [...src.matchAll(/<SectionCard\b/g)]
        .filter((m) => schieneOhneAufgabe(propsOfTag(src, m.index ?? 0)))
        .map((m) => `${file}:${at(src, m.index ?? 0)}  <SectionCard work …>`),
    );
    expect(
      treffer,
      `${treffer.length} Schiene(n) ohne Aufgabe:\n  · ${treffer.join("\n  · ")}\n\n` +
        "Eine Arbeitsfläche trägt eine Schrittnummer (step) oder eine Aktion (action).",
    ).toEqual([]);
  });

  /**
   * Der Ausschnitt des Tags — der Teil, der zuletzt falsch war. Ohne diese
   * Fälle wäre der gemeldete Phantom-Verstoß nicht von einem echten zu
   * unterscheiden gewesen.
   */
  it("liest die Props bis zum schliessenden > der Tags, nicht bis zum ersten", () => {
    const mitFragment = `<SectionCard\n  work\n  description={<>a &gt; b</>}\n  action={<b />}\n>`;
    expect(propsOfTag(mitFragment, 0)).toContain("action=");
    expect(schieneOhneAufgabe(propsOfTag(mitFragment, 0))).toBe(false);

    // Ein `>` in einer Zeichenkette beendet das Tag ebenso wenig.
    const mitText = `<SectionCard work title="a > b" action={<b />}>`;
    expect(schieneOhneAufgabe(propsOfTag(mitText, 0))).toBe(false);

    // Und der echte Verstoß wird weiterhin gefunden.
    const ohne = `<SectionCard work title={x}>\n  <p>action={y}</p>\n</SectionCard>`;
    expect(schieneOhneAufgabe(propsOfTag(ohne, 0))).toBe(true);
  });

  /** Der Detektor selbst — sonst ist „grün" nicht von „Regex kaputt" zu trennen. */
  it("erkennt eine Schiene ohne Aufgabe und lässt die mit Aufgabe in Ruhe", () => {
    expect(schieneOhneAufgabe(' work title="X"')).toBe(true);
    expect(schieneOhneAufgabe("\n  work\n  title={x}\n")).toBe(true);
    expect(schieneOhneAufgabe(" step={4} title={x}")).toBe(false);
    expect(schieneOhneAufgabe(" work action={<button />} title={x}")).toBe(false);
    expect(schieneOhneAufgabe(" title={x}")).toBe(false);
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
