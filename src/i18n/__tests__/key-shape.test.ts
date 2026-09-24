import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import de from "../../../messages/de.json";

/**
 * **Ein Schlüssel steht genau einmal im Namensraum.**
 *
 * `useTranslations("auth")` setzt „auth." vor jeden Schlüssel. Wer in einer
 * solchen Datei `t("auth.page.willkommen")` schreibt, fragt nach
 * `auth.auth.page.willkommen` — und bekommt nichts. `next-intl` wirft dabei
 * **nicht**: es schreibt den Schlüssel als Text auf den Bildschirm.
 *
 * Genau das ist passiert, und zwar siebenmal, als die Umstellung von Zug 3
 * voll qualifizierte Schlüssel in Dateien schrieb, die schon einen Namensraum
 * hatten. Gefunden hat es kein Test, sondern der erste Aufruf der
 * Anmeldeseite im laufenden Server — die Vitest-Attrappe deckt Server-Seiten
 * nicht ab, und der Wächter über die Oberfläche prüft Quelltext, keine
 * Ausgabe.
 *
 * Deshalb dieser Test. Er ist billig und schliesst die Lücke an der Stelle, an
 * der sie entsteht: im Quelltext, nicht im Browser.
 */

const SRC = join(process.cwd(), "src");

/** Die obersten Ebenen des Katalogs — mehr braucht die Prüfung nicht. */
const NAMENSRAEUME = new Set(Object.keys(de as Record<string, unknown>));

function dateien(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const pfad = join(dir, name);
    if (statSync(pfad).isDirectory()) {
      return name === "generated" || name === "__tests__" ? [] : dateien(pfad);
    }
    return name.endsWith(".ts") || name.endsWith(".tsx") ? [pfad] : [];
  });
}

const NS_UEBERSETZER = /(?:useTranslations|getTranslations)\(\s*"(\w+)"/;
const AUFRUF = /\bt(?:\.rich)?\(\s*"([a-zA-Z][\w]*)\.([\w.]+)"/g;

describe("Schlüssel-Form", () => {
  it("kombiniert nirgends einen Namensraum-Übersetzer mit einem voll qualifizierten Schlüssel", () => {
    const fehler: string[] = [];

    for (const pfad of dateien(SRC)) {
      const quelle = readFileSync(pfad, "utf8");
      const ns = NS_UEBERSETZER.exec(quelle)?.[1];
      if (!ns) continue;

      for (const m of quelle.matchAll(AUFRUF)) {
        if (!NAMENSRAEUME.has(m[1]!)) continue;
        fehler.push(
          `${pfad.replace(SRC, "src")}: useTranslations("${ns}") + t("${m[1]}.${m[2]}")` +
            ` ⇒ gesucht wird "${ns}.${m[1]}.${m[2]}"`,
        );
      }
    }

    expect(fehler, fehler.length === 0 ? "" : `\n${fehler.join("\n")}\n`).toEqual([]);
  });
});
