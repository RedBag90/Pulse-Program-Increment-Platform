import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/**
 * Die Prüfung zu **ADR-0021** — „Die visuelle Sprache steht in Tokens, nicht in
 * Klassenketten".
 *
 * Eine Regel, die nur in einem Dokument steht, hält bis zum nächsten Feature.
 * Diese Helfer lesen Quelltext und melden, wo eine Datei die Regel bricht —
 * dieselbe Haltung wie `assertGateHistory` für den Reifegrad-Weg: laut
 * scheitern statt still driften.
 *
 * Sie sind bewusst **datei-, nicht projektweit** angelegt. Der Bestand hat 858
 * rohe Palettenwerte und 73 handgerollte Karten; ein Test, der alles auf
 * einmal einfordert, wäre am Tag seiner Entstehung rot. Stattdessen wächst die
 * Liste der geprüften Flächen mit dem Umbau — beginnend mit der Pilotseite.
 */

/**
 * Rohe Tailwind-Palette: helle Flächen und dunkle Schrift, die ein Thema kippen.
 *
 * `bg-white/<alpha>` ist ausgenommen: ein durchscheinendes Weiß ist ein
 * Schleier über dem, was darunter liegt (`auth-hero.tsx`), keine Fläche, die
 * ein dunkles Gegenstück bräuchte.
 */
const PALETTE =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";

const RISKY_COLOR = new RegExp(
  String.raw`\b(?:bg|border|ring|divide)-(?:${PALETTE})-(?:50|100|200)\b` +
    String.raw`|\btext-(?:${PALETTE})-(?:600|700|800|900)\b` +
    String.raw`|\bbg-white\b(?!/)`,
  "g",
);

/** Beliebige Schriftgrößen — die Skala hat `text-label` und `text-meta`. */
const ARBITRARY_TEXT = /\btext-\[[0-9.]+(?:px|rem|em)\]/g;

/**
 * Die handgerollte Karte, die `Card` ersetzen soll.
 *
 * Zwei Rahmen sind ausgenommen, weil sie **keine Kartenkante** sind, sondern
 * eine Aussage über den Inhalt — etwas, das die Elevation nicht ausdrücken
 * kann:
 *
 * - `border-dashed` — „noch nicht da" (Platzhalter-Knoten im Netzbild), „leer".
 * - `border-l-*` und die übrigen Seitenrahmen — eine Akzentschiene
 *   (`concept-callout.tsx`) oder eine Trennlinie, nie der Umriss.
 */
const HAND_CARD =
  /rounded-(?:sm|md|lg|xl|2xl)(?![^"'`]*\bborder-dashed\b)[^"'`]*\bborder\b(?!-[lrtbxy](?:\b|-))[^"'`]*\bbg-card\b/g;

/** Radien außerhalb der Drei-Stufen-Leiter (Fläche · Bedienelement · Pille). */
const OFF_LADDER_RADIUS = /\brounded-(?:xl|2xl|3xl|4xl)\b|\brounded(?=["'`\s])/g;

/** `focus:` statt `focus-visible:` — ein Ring, der beim Mausklick aufblitzt. */
const BARE_FOCUS = /\bfocus:(?:ring|outline|border)-/g;

/**
 * Der **falsche** Fokus-Ring. `focus:` war nur der eine Dialekt; der andere
 * schreibt `focus-visible:ring-2 focus-visible:ring-ring` — richtige Bedingung,
 * falsche Breite, volldeckende Farbe. Die Regel verlangt `ring-3` und eine
 * Farbe mit Alpha (`ring-ring/50`).
 *
 * `ring-destructive/20` bleibt unberührt: das ist der Ring eines ungültigen
 * Feldes, eine andere Rolle mit eigener Farbe.
 */
const WRONG_FOCUS_RING = /\bfocus-visible:ring-(?!3\b)\d+\b|\bfocus-visible:ring-ring(?![/\w-])/g;

export interface VisualViolation {
  file: string;
  line: number;
  token: string;
  rule: string;
}

function scan(
  file: string,
  src: string,
  re: RegExp,
  rule: string,
  skip?: (src: string, at: number) => boolean,
): VisualViolation[] {
  const out: VisualViolation[] = [];
  for (const m of src.matchAll(re)) {
    const at = m.index ?? 0;
    if (skip?.(src, at)) continue;
    out.push({ file, line: src.slice(0, at).split("\n").length, token: m[0], rule });
  }
  return out;
}

/**
 * Eine Rohfarbe zählt nur, wenn in derselben Klassenkette **kein**
 * `dark:`-Partner derselben Familie steht. Ein `bg-amber-100` neben
 * `dark:bg-amber-950` ist eine bewusste Achse (siehe `issue-badges.tsx`), kein
 * Verstoß.
 */
function hasDarkPartner(src: string, at: number, token: string): boolean {
  const family = token === "bg-white" ? null : token.split("-").slice(-2)[0];
  const ctx = src.slice(Math.max(0, at - 200), at + 200);
  if (isPrintSurface(ctx)) return true;
  return family
    ? new RegExp(String.raw`dark:[a-z-]+-${family}-\d`).test(ctx)
    : /dark:bg-/.test(ctx);
}

/**
 * **Papier hat kein Thema.**
 *
 * Eine Fläche, die zum Drucken gebaut ist (`print:`-Klassen in derselben
 * Kette), ist weiß mit schwarzer Schrift — und zwar in beiden Themen, weil sie
 * nicht auf dem Bildschirm gelesen wird. `ballot-sheets.tsx` ist der Fall: ein
 * Verteilbogen, der ausgedruckt und ausgefüllt wird.
 *
 * Das ist keine Aufweichung der Regel, sondern ihre Grenze: die Regel verlangt
 * Paare, **damit der Dunkelmodus stimmt**. Wo es keinen Dunkelmodus gibt, gibt
 * es nichts zu paaren.
 */
function isPrintSurface(ctx: string): boolean {
  return /\bprint:/.test(ctx);
}

/**
 * Blockkommentare zählen nicht. Eine Datei darf beschreiben, was sie früher
 * geschrieben hat („vorher stand hier `rounded-lg border bg-card`") — der
 * Wächter misst Klassen, die gerendert werden, nicht Prosa darüber. Ersetzt
 * wird längentreu, damit Zeilennummern stimmen bleiben.
 */
function withoutComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
}

/** Alle Verstöße einer Datei, nach Regel benannt. */
export function visualViolations(path: string): VisualViolation[] {
  const src = withoutComments(readFileSync(path, "utf8"));
  const rel = path.replace(/^.*\/src\//, "src/");
  return [
    ...scan(rel, src, RISKY_COLOR, "rohe Palette ohne dark:-Partner", (s, at) => {
      const m = s.slice(at).match(RISKY_COLOR);
      return m ? hasDarkPartner(s, at, m[0]) : true;
    }),
    ...scan(rel, src, ARBITRARY_TEXT, "beliebige Schriftgröße statt text-label/text-meta"),
    ...scan(rel, src, HAND_CARD, "handgerollte Karte statt Card"),
    ...scan(rel, src, OFF_LADDER_RADIUS, "Radius außerhalb der Drei-Stufen-Leiter"),
    ...scan(rel, src, BARE_FOCUS, "focus: statt focus-visible:"),
    ...scan(rel, src, WRONG_FOCUS_RING, "falscher Fokus-Ring — es gilt ring-3 ring-ring/50"),
  ];
}

/** Die Verstöße als lesbarer Block — für eine scheiternde Zusicherung. */
export function formatVisualViolations(violations: readonly VisualViolation[]): string {
  return violations.map((v) => `  · ${v.file}:${v.line}  „${v.token}" — ${v.rule}`).join("\n");
}

// ---------------------------------------------------------------------------
// Von der Datei zur Seite
// ---------------------------------------------------------------------------

/**
 * **Eine Dateiliste sagt nie, wann eine Seite fertig ist.**
 *
 * Der erste Rollout wurde nach Dateien gezählt — und `/portfolio/epics/[id]`
 * galt als umgebaut, während im Importgraph noch 115 Verstöße in 25 Dateien
 * standen: Dialoge und Formulare, die erst auf Klick erscheinen, die
 * Feature-Reiter aus einem anderen Modul, vier Bibliotheksbauteile.
 *
 * `routeViolations` misst deshalb die **Route**: ausgehend von ihrer
 * `page.tsx` wird jeder erreichbare Quelltext verfolgt und geprüft. Eine Seite
 * ist fertig, wenn nichts, was sie rendern kann, die Regel bricht.
 */
const IMPORT = /(?:from\s+|import\s*\(|require\()\s*["']([^"']+)["']/g;

/** `@/…` und relative Pfade auflösen; alles andere (Pakete) bleibt außen vor. */
function resolveImport(spec: string, from: string, srcRoot: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = join(srcRoot, spec.slice(2));
  else if (spec.startsWith(".")) base = resolve(dirname(from), spec);
  else return null;

  for (const candidate of [
    `${base}.tsx`,
    `${base}.ts`,
    join(base, "index.tsx"),
    join(base, "index.ts"),
    base,
  ]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/** Jede Quelldatei, die eine Seite über ihre Importe erreichen kann. */
export function routeGraph(pagePath: string, srcRoot: string): string[] {
  const seen = new Set<string>();
  const stack = [pagePath];
  while (stack.length > 0) {
    const file = stack.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    let src: string;
    try {
      src = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const m of src.matchAll(IMPORT)) {
      const spec = m[1];
      if (spec === undefined) continue;
      const target = resolveImport(spec, file, srcRoot);
      if (target !== null && !seen.has(target)) stack.push(target);
    }
  }
  return [...seen];
}

/**
 * Jede Quelldatei unter einem Verzeichnis.
 *
 * Für Bereiche, die **vollständig** umgestellt sind. Eine Dateiliste vergisst
 * die Datei, die morgen dazukommt; ein Verzeichnis nicht.
 */
export function filesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "__tests__") out.push(...filesUnder(full));
    } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out.sort();
}

/** Alle Verstöße einer Route — über ihren gesamten Importgraph. */
export function routeViolations(pagePath: string, srcRoot: string): VisualViolation[] {
  return routeGraph(pagePath, srcRoot).flatMap((file) => visualViolations(file));
}
