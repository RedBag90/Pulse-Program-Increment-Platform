import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { filesUnder } from "@/test/helpers/visual-language";

/**
 * **Sprungziele auf die Wertstrom-Geldfläche zeigen auf Reiter, die es gibt.**
 *
 * Der Fehler, den dieser Wächter festhält, ist stumm: ein `?tab=` mit einem
 * Schlüssel, den die Seite nicht kennt, übersetzt `resolveTab` in den
 * Landeplatz. Nichts bricht, nichts wird rot — der Klick kommt nur woanders an,
 * als er sollte. Genau das ist beim Schnitt nach Prozess sechsmal passiert:
 * Kette, Inbox, Redirect, Struktur-Hinweis, Kachel-Ergebnis und die Matrix
 * zeigten alle noch auf `?tab=betrieb`, `?tab=budget` und `&art=`.
 *
 * Gemessen wird am Quelltext statt an einer Konstanten, weil die Adressen in
 * Template-Strings über fünf Module verstreut stehen. Dieselbe Haltung wie bei
 * den Reiternamen: wer eine neue Adresse baut, wird gemessen, ohne sich
 * eintragen zu müssen.
 *
 * **Was er nicht sieht:** eine Adresse, die ihren Reiter erst zur Laufzeit
 * einsetzt — der Redirect baut ihn über `URLSearchParams`, die Kette über eine
 * Variable. Für diese beiden stehen die fertigen Zeichenketten in ihren eigenen
 * Tests. Ein Wächter, der nur die halbe Menge sieht, sagt das besser, als so zu
 * tun, als sähe er alles.
 */

/** Die vier festen Reiter; die ART-Reiter tragen ihre Id im Schlüssel. */
const BEKANNTE_REITER = ["einrichten", "halbjahr", "nachsehen", "kpi"];

/** Eine Adresse auf die Fläche, bis zum Ende ihres Template-Strings. */
const ADRESSE = /\/budgeting\/value-streams\/[^`"'\s]*/g;

export interface Fehlziel {
  adresse: string;
  grund: string;
}

/**
 * Prüft **eine** Adresse. Ausgelagert, damit der Selbsttest unten den Melder
 * selbst messen kann: ein Wächter, dessen Muster bricht, meldet sonst „grün".
 */
export function fehlziel(adresse: string): Fehlziel | null {
  // Der alte Parameter. Er hiess einmal „welche Zeile ist aufgeklappt"; seit
  // jedes ART einen Reiter hat, gibt es keine Zeile mehr zum Aufklappen.
  if (/[?&]art=/.test(adresse)) {
    return { adresse, grund: "`art=` ist entfallen — der ART steckt im Reiter (`tab=art:<id>`)" };
  }
  const m = /[?&]tab=([^&`"'\s]*)/.exec(adresse);
  if (m == null) return null;
  const key = m[1] ?? "";
  // Ein interpolierter Schlüssel ist die Seite selbst oder ein ART-Reiter —
  // beides baut sie aus ihren eigenen Konstanten.
  if (key.includes("${") || key.startsWith("art:")) return null;
  if (BEKANNTE_REITER.includes(key)) return null;
  return { adresse, grund: `„${key}" ist kein Reiter dieser Fläche` };
}

describe("fehlziel — der Melder selbst", () => {
  it("lässt die vier festen Reiter und die ART-Reiter durch", () => {
    for (const k of [...BEKANNTE_REITER, "art:a1", "art:${artId}"]) {
      expect(fehlziel(`/budgeting/value-streams/vs1?tab=${k}&cycle=2026-H2`)).toBeNull();
    }
  });

  it("lässt eine Adresse ohne Reiter durch — sie landet absichtlich auf dem Landeplatz", () => {
    expect(fehlziel("/budgeting/value-streams/vs1")).toBeNull();
  });

  it("meldet die drei alten Schlüssel", () => {
    for (const k of ["betrieb", "budget", "verteilen"]) {
      expect(fehlziel(`/budgeting/value-streams/vs1?tab=${k}`)?.grund).toContain("kein Reiter");
    }
  });

  it("meldet `art=`, auch neben einem gültigen Reiter", () => {
    expect(fehlziel("/budgeting/value-streams/vs1?tab=nachsehen&art=a1")?.grund).toContain("art=");
  });
});

describe("Sprungziele auf die Wertstrom-Geldfläche", () => {
  it("zeigen auf Reiter, die es gibt", () => {
    const funde: string[] = [];
    for (const datei of filesUnder(join(process.cwd(), "src"))) {
      const src = readFileSync(datei, "utf8");
      for (const m of src.matchAll(ADRESSE)) {
        const treffer = fehlziel(m[0]);
        if (treffer == null) continue;
        const zeile = src.slice(0, m.index ?? 0).split("\n").length;
        const rel = datei.replace(/^.*\/src\//, "src/");
        funde.push(`  · ${rel}:${zeile}  ${treffer.adresse} — ${treffer.grund}`);
      }
    }
    expect(funde, `Sprungziele auf Reiter, die es nicht gibt:\n${funde.join("\n")}`).toEqual([]);
  });
});
