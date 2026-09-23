import { readFileSync } from "node:fs";

/**
 * **Der Wächter über die Übersetzung.**
 *
 * Das Konzept versprach „All user-facing strings in messages files — no inline
 * literals" (`pulse-technical-concept.md:1195`) und kündigte eine ESLint-Regel
 * an, die das durchsetzt (`pulse-implementation-concept.md:499`). Die Regel
 * wurde nie gebaut — und ohne Wächter war die Regel in 326 von 449 Dateien
 * gebrochen, ohne dass es jemandem auffiel.
 *
 * Sie steht hier als **Test** und nicht als ESLint-Regel, aus zwei Gründen:
 * `eslint-plugin-react` ist im Projekt gar nicht installiert, und das Repo hat
 * für genau diese Art Quelltext-Regel bereits ein Muster — den
 * ADR-0021-Wächter nebenan (`visual-language.ts`). Sein Docblock begründet auch
 * die Bauweise, die hier übernommen wird: **datei-, nicht projektweit**. Ein
 * Wächter über alles wäre am Tag seiner Entstehung rot; stattdessen wächst die
 * Liste der geprüften Flächen mit der Umstellung.
 *
 * Geprüft wird, was ein Nutzer **liest**: Text zwischen JSX-Marken und die
 * Zeichenketten an den Eigenschaften, die auf dem Bildschirm landen. Nicht
 * geprüft werden Klassennamen, Schlüssel, Routen und alles in geschweiften
 * Klammern — dort steht ohnehin schon ein Ausdruck.
 */

/** Eigenschaften, deren Zeichenkette sichtbar wird. */
const USER_PROPS = [
  "title",
  "subtitle",
  "label",
  "emptyLabel",
  "placeholder",
  "searchPlaceholder",
  "aria-label",
  "ariaLabel",
  "eyebrow",
  "hint",
  "body",
  "description",
  "helpText",
  "confirmLabel",
  "cancelLabel",
];

const PROP_RE = new RegExp(`\\b(${USER_PROPS.join("|")})=\\{?"([^"]{2,})"`, "g");

/**
 * Text zwischen zwei Marken: `>Speichern<`. Nur echte Buchstabenfolgen zählen —
 * `>{…}<`, `> · <` und Zahlen sind keine Sätze.
 */
const JSX_TEXT_RE = />\s*([^<>{}\n][^<>{}]*?[A-Za-zÄÖÜäöüß]{2,}[^<>{}]*?)\s*</g;

/**
 * **Was aussieht wie Text, aber Code ist.**
 *
 * Zwischen `>` und `<` steht nicht nur JSX: ein TypeScript-Generic schliesst
 * mit `>`, und was dahinter folgt, las die Regex als Satz —
 * `useActionState<State, FormData>(signIn, null);` meldete „(signIn, null);"
 * als unübersetzten Text. Diese Merkmale kommen in Oberflächentext nicht vor
 * und in Code ständig.
 */
const CODE = /[;=]|^[(,)]|=>/;

/**
 * Was literal stehenbleiben darf.
 *
 * Der Produktname ist keine Übersetzung, und Zeichen ohne Wortcharakter
 * (Gedankenstrich, Mittelpunkt, Einheiten) sind sprachneutral. **Fachbegriffe
 * stehen hier bewusst nicht**: „Epic" und „Value Stream" gehören genauso in den
 * Katalog, auch wenn beide Sprachen dasselbe Wort führen — sonst entscheidet
 * die Fundstelle darüber, ob ein Begriff übersetzbar ist.
 */
const ERLAUBT = /^(Pulse|[\s—·•·…|/\\+\-–%€$#*.,:;()[\]{}0-9]+)$/;

export interface TextViolation {
  file: string;
  line: number;
  text: string;
  kind: "jsx-text" | "prop";
}

const zeileVon = (src: string, at: number): number => src.slice(0, at).split("\n").length;

/** Kommentare raus — dort steht Prosa, die niemand liest ausser uns. */
function ohneKommentare(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/\/\/[^\n]*/g, "");
}

/** Alle sichtbaren Literale einer Datei, die nicht aus dem Katalog kommen. */
export function untranslatedLiterals(path: string): TextViolation[] {
  const src = ohneKommentare(readFileSync(path, "utf8"));
  const rel = path.replace(/^.*\/src\//, "src/");
  const out: TextViolation[] = [];

  for (const m of src.matchAll(PROP_RE)) {
    const text = m[2]!.trim();
    if (!ERLAUBT.test(text)) {
      out.push({ file: rel, line: zeileVon(src, m.index), text, kind: "prop" });
    }
  }
  for (const m of src.matchAll(JSX_TEXT_RE)) {
    const text = m[1]!.trim();
    if (!ERLAUBT.test(text) && !CODE.test(text)) {
      out.push({ file: rel, line: zeileVon(src, m.index), text, kind: "jsx-text" });
    }
  }
  return out;
}

export function formatTextViolations(v: TextViolation[]): string {
  return v.map((x) => `  · ${x.file}:${x.line}  „${x.text}"  (${x.kind})`).join("\n");
}
