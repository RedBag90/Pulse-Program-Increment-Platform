import { readFileSync } from "node:fs";
import ts from "typescript";

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
 *
 * Beim Umbau des Ziele- und des Portfolio-Moduls kamen acht weitere Formen
 * dazu, die der Wächter sonst bis zum Schluss als offene Stellen gemeldet
 * hätte: Typzeilen in mehrzeiligen Generics (`void,` · `| null,` · `[st, 0]))
 * as Record`), Kurzschluss- und Bedingungs-Ausdrücke (`0 && todayFrac`,
 * `0.05 ? "text-destructive"`), ein Konstruktoraufruf (`new Map`), ein
 * schliessendes Klammerpaar mit Komma (`),`) und ein blosser
 * Eigenschaftszugriff (`a.at`).
 *
 * Zwei Merkmale tragen dabei am weitesten: das doppelte Anführungszeichen —
 * deutscher wie englischer Oberflächentext benutzt „…" bzw. “…”, nie `"` —
 * und die Klammer unmittelbar hinter einem Wortzeichen (`formatEUR(`), die in
 * Oberflächentext nie ohne Leerzeichen davor steht.
 */
const CODE =
  /[;=<"]|^[(,)[|]|=>|&&|\|\||\),|,\s*$|\w\(|\?\s*\(|^\d+\s*,|^new\b|^&|^(?:ReturnType|Awaited|Parameters|Promise|Array|Set|Map|VariantProps|ComponentProps|Result|TKey)\b|^(?:void|string|number|boolean|Record|Partial|readonly|null|undefined)\b|^\w+\.\w+$/;

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
  kind: "jsx-text" | "jsx-string" | "prop";
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
  if (path.endsWith(".tsx")) {
    out.push(...jsxLiterals(src, rel));
    return out;
  }
  for (const m of src.matchAll(JSX_TEXT_RE)) {
    const text = m[1]!.trim();
    if (!ERLAUBT.test(text) && !CODE.test(text)) {
      out.push({ file: rel, line: zeileVon(src, m.index), text, kind: "jsx-text" });
    }
  }
  return out;
}

const BUCHSTABEN = /[A-Za-zÄÖÜäöüß]{2,}/;

/**
 * **JSX-Text über den Parser, nicht über eine Regex.**
 *
 * Bis September 2026 las `JSX_TEXT_RE` nur Text **zwischen zwei Marken**
 * (`>…<`). Ein Satz, der an einen Ausdruck grenzt, fiel durch:
 *
 *     Angelegt wurde dieses Epic als{" "}
 *     <strong>{t(…)}</strong>. Der Business Case beziffert die Umsetzung auf{" "}
 *
 * stand so im Klassifikations-Dialog und erschien auf der englischen
 * Oberfläche deutsch — neben rund zwanzig Stellen derselben Form. Die Regex
 * auf `}…{` zu erweitern hätte jedes `} else {` gemeldet; der Parser weiss,
 * was JSX ist.
 *
 * Gemeldet werden zwei Formen:
 *  - jeder `JsxText`-Knoten mit einer Buchstabenfolge — gleich, woran er grenzt;
 *  - Zeichenketten, die als **Kind** gerendert werden: `{"über"}`,
 *    `{x ? "über" : "unter"}`, `{ok && "Gespeichert"}`. Ein Satz, der aus
 *    solchen Bruchstücken zusammengesetzt wird, ist genauso unübersetzt.
 *
 * Attribute prüft weiterhin `PROP_RE` — dort steht auch Code (`className`,
 * `href`), den nur die Liste `USER_PROPS` vom Text trennt.
 */
function jsxLiterals(src: string, rel: string): TextViolation[] {
  const sf = ts.createSourceFile(rel, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const out: TextViolation[] = [];
  const melde = (node: ts.Node, raw: string, kind: TextViolation["kind"]) => {
    const text = raw.replace(/\s+/g, " ").trim();
    if (text === "" || !BUCHSTABEN.test(text) || ERLAUBT.test(text)) return;
    const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
    out.push({ file: rel, line, text, kind });
  };

  /** Die Zeichenketten, die ein Kind-Ausdruck am Ende rendern kann. */
  const gerendert = (e: ts.Expression): void => {
    if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) {
      melde(e, e.text, "jsx-string");
    } else if (ts.isTemplateExpression(e)) {
      melde(
        e,
        [e.head.text, ...e.templateSpans.map((s) => s.literal.text)].join(" "),
        "jsx-string",
      );
    } else if (ts.isParenthesizedExpression(e)) {
      gerendert(e.expression);
    } else if (ts.isConditionalExpression(e)) {
      gerendert(e.whenTrue);
      gerendert(e.whenFalse);
    } else if (
      ts.isBinaryExpression(e) &&
      [
        ts.SyntaxKind.AmpersandAmpersandToken,
        ts.SyntaxKind.BarBarToken,
        ts.SyntaxKind.QuestionQuestionToken,
      ].includes(e.operatorToken.kind)
    ) {
      gerendert(e.right);
      if (e.operatorToken.kind !== ts.SyntaxKind.AmpersandAmpersandToken) gerendert(e.left);
    }
  };

  const besuche = (node: ts.Node): void => {
    if (ts.isJsxText(node)) {
      melde(node, node.text, "jsx-text");
    } else if (
      ts.isJsxExpression(node) &&
      node.expression != null &&
      (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))
    ) {
      gerendert(node.expression);
    }
    ts.forEachChild(node, besuche);
  };
  besuche(sf);
  return out;
}

export function formatTextViolations(v: TextViolation[]): string {
  return v.map((x) => `  · ${x.file}:${x.line}  „${x.text}"  (${x.kind})`).join("\n");
}
