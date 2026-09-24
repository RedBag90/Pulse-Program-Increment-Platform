import { readFileSync } from "node:fs";

/**
 * **Der Wächter über die Fehlermeldungen.**
 *
 * `translated-surfaces.ts` nebenan prüft, was zwischen JSX-Marken steht. Eine
 * Fehlermeldung steht dort nie: sie entsteht in einem gewöhnlichen Objekt tief
 * in einem Service (`err({ kind: "conflict", reason: "…" })`) und erreicht den
 * Nutzer erst über `formatDomainError`. ADR-0024 nennt diese Lücke
 * ausdrücklich — „ein grüner Lauf heisst nicht, dass die Anwendung fertig
 * übersetzt ist". Dieser Wächter schliesst sie.
 *
 * Geprüft wird die Form, nicht die Bedeutung: ein `reason` oder `detail` an
 * einem `DomainError` muss wie ein Katalog-Pfad aussehen. Das ist eine
 * schwache Zusicherung — `catalogTranslate` im Test und die Katalog-Parität
 * prüfen, ob der Pfad auch existiert — aber es ist die einzige, die **an der
 * Fundstelle** greift, und damit die einzige, die einen neuen deutschen Satz
 * am Tag seiner Entstehung meldet.
 */

/** Die Fehlerarten, die einen geschriebenen Grund tragen. */
const MIT_GRUND = ["conflict", "forbidden", "hierarchy_violation", "tenant_mismatch"];

/**
 * `modul.fläche.ding` — mindestens zwei Punkte-getrennte Teile, kein
 * Leerzeichen. Ein deutscher Satz fällt hier durch, ein Schlüssel nicht.
 */
const SCHLUESSEL = /^[a-z][A-Za-z0-9]*(?:\.[A-Za-z0-9]+)+$/;

/**
 * Findet `kind: "<art>"` und danach das erste `reason:`/`detail:` im selben
 * Objekt. Der Abstand ist bewusst grosszügig (600 Zeichen): zwischen beiden
 * stehen oft `violatedConstraint` und mehrzeilige Einrückung.
 */
const FEHLER_RE = new RegExp(
  `kind:\\s*"(${MIT_GRUND.join("|")})"(?:\\s*as\\s+const)?[\\s\\S]{0,600}?\\b(reason|detail):\\s*([\`"])((?:[^\\\\]|\\\\.)*?)\\3`,
  "g",
);

export interface ErrorTextViolation {
  file: string;
  line: number;
  kind: string;
  field: string;
  text: string;
}

const zeileVon = (src: string, at: number): number => src.slice(0, at).split("\n").length;

/** Alle Gründe einer Datei, die ein Satz sind statt eines Schlüssels. */
export function untranslatedErrorReasons(path: string): ErrorTextViolation[] {
  const src = readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/\/\/[^\n]*/g, "");
  const rel = path.replace(/^.*\/src\//, "src/");
  const out: ErrorTextViolation[] = [];

  for (const m of src.matchAll(FEHLER_RE)) {
    const text = m[4]!;
    if (SCHLUESSEL.test(text)) continue;
    out.push({
      file: rel,
      line: zeileVon(src, m.index),
      kind: m[1]!,
      field: m[2]!,
      text,
    });
  }
  return out;
}

export function formatErrorTextViolations(v: ErrorTextViolation[]): string {
  return v.map((x) => `  · ${x.file}:${x.line}  ${x.kind}.${x.field} = „${x.text}"`).join("\n");
}
