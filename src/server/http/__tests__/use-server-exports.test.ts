import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { filesUnder } from "@/test/helpers/visual-language";

/**
 * **Eine `"use server"`-Datei darf nur async-Funktionen exportieren.**
 *
 * Next wirft sonst zur Laufzeit:
 * „A 'use server' file can only export async functions, found object."
 *
 * Der Fehler ist für die gesamte Messlatte unsichtbar — `tsc` sieht einen
 * gültigen Export, ESLint auch, und die Testsuite importiert die Datei nie so,
 * wie der Server es tut. Er zeigt sich erst beim Öffnen der Seite, und dann als
 * weisser Bildschirm.
 *
 * Genau so ist er passiert: `GOAL_FILTER_KEYS`, ein Array mit vier Facetten-
 * namen, stand in `goals/features/actions/saved-filter.ts`. Es liegt jetzt in
 * der Domäne. Das Portfolio-Gegenstück entging dem nur zufällig — dort steht
 * die Liste im Service.
 *
 * Geprüft wird die **rechte Seite**: ein Literal (Array, Objekt, Zeichenkette,
 * Zahl) ist nie eine Funktion. Ein Aufruf wie `createServerAction({…})` und ein
 * Alias auf eine andere Action bleiben erlaubt — beides ergibt eine Funktion.
 */
const USE_SERVER = /^\s*["']use server["']/m;

/** `export const X = <Literal>` — das, was Next zur Laufzeit ablehnt. */
const LITERAL_EXPORT = /^export const (\w+)\s*(?::[^=]+)?=\s*([[{"'`]|\d)/gm;

describe("use-server-Dateien", () => {
  it("exportieren keine Werte, nur Funktionen", () => {
    const verstoesse: string[] = [];
    for (const datei of filesUnder(join(process.cwd(), "src"))) {
      const src = readFileSync(datei, "utf8");
      if (!USE_SERVER.test(src)) continue;
      for (const m of src.matchAll(LITERAL_EXPORT)) {
        const zeile = src.slice(0, m.index ?? 0).split("\n").length;
        const rel = datei.replace(/^.*\/src\//, "src/");
        verstoesse.push(`  · ${rel}:${zeile}  „export const ${m[1]}" ist kein Funktionswert`);
      }
    }
    expect(
      verstoesse,
      `In „use server"-Dateien exportierte Werte — Next lehnt sie zur Laufzeit ab:\n${verstoesse.join("\n")}`,
    ).toEqual([]);
  });
});
