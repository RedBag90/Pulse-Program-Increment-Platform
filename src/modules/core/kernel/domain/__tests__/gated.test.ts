import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * **Die Konvention soll nicht wieder zu einem Kommentar werden.**
 *
 * „Ist die Fähigkeit aus, liefert der Erbauer `{ disabled: true }`" stand seit
 * September 2026 als Kommentar über den Scheiben in `epic-detail.ts` — und die
 * Einordnung wurde trotzdem daneben gebaut, als `X | null` in der Route. Der
 * Fehler, den der Kommentar verhindern sollte, trat ein zweites Mal ein:
 * gespeichert wurde, angezeigt nicht.
 *
 * Ein von Hand geschriebenes `| { disabled: true }` ist das Symptom. Wer die
 * Union selbst tippt, kann auch ihre Hälfte vergessen; wer `Gated<T>`
 * importiert, kann es nicht. Deshalb dieser Riegel — er verbietet nicht die
 * Idee, sondern ihre Kopie.
 */

const SRC = join(process.cwd(), "src");

/** Die Datei, die die Form definieren **darf**. */
const QUELLE = join("src", "modules", "core", "kernel", "domain", "gated.ts");

function dateien(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const pfad = join(dir, name);
    if (statSync(pfad).isDirectory()) {
      return name === "generated" || name === "__tests__" ? [] : dateien(pfad);
    }
    return name.endsWith(".ts") || name.endsWith(".tsx") ? [pfad] : [];
  });
}

/**
 * `{ disabled: true }` als Glied einer Typ-Union — der Strich darf **auf
 * beiden Seiten** stehen. Die erste Fassung dieses Musters verlangte ihn nur
 * davor und liess die einzeilige Schreibweise `A | B` durch; gefunden hat das
 * die Gegenprobe, nicht das Lesen.
 */
const DISABLED_TRUE = String.raw`\{\s*disabled:\s*true\s*\}`;
const HANDGESCHRIEBEN = new RegExp(`\\|\\s*${DISABLED_TRUE}|${DISABLED_TRUE}\\s*\\|`);

describe("Gated", () => {
  it("wird importiert, nicht nachgebaut", () => {
    const fehler: string[] = [];

    for (const pfad of dateien(SRC)) {
      const kurz = pfad.replace(process.cwd() + "/", "");
      if (kurz === QUELLE) continue;
      const quelle = readFileSync(pfad, "utf8");
      // Kommentare zählen nicht — über die Geschichte zu schreiben ist erlaubt.
      const ohneKommentare = quelle.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
      if (HANDGESCHRIEBEN.test(ohneKommentare)) {
        fehler.push(`${kurz}: schreibt \`| { disabled: true }\` selbst — nimm \`Gated<T>\``);
      }
    }

    expect(fehler, fehler.length === 0 ? "" : `\n${fehler.join("\n")}\n`).toEqual([]);
  });
});
