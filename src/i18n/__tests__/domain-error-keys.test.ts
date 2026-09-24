import { describe, it, expect } from "vitest";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  untranslatedErrorReasons,
  formatErrorTextViolations,
} from "@/test/helpers/domain-error-keys";

/**
 * **Kein deutscher Satz in einem `DomainError` — projektweit.**
 *
 * Die Fehlermeldungen der Services waren der letzte Ort, an dem Text im Code
 * stand: 88 Sätze in 35 Dateien, unsichtbar für den JSX-Wächter, weil sie in
 * gewöhnlichen Objekten liegen. Sie erreichen den Nutzer trotzdem — über
 * `state.error` einer Server-Action und über das `detail` einer 409-Antwort.
 *
 * Was der Wächter prüft, ist die **Form**: `reason` und `detail` müssen wie
 * ein Katalog-Pfad aussehen. Ob der Pfad existiert, prüfen `catalogTranslate`
 * (wirft im Test) und die Katalog-Parität. Drei schwache Zusicherungen, die
 * zusammen tragen — und diese hier ist die einzige, die an der Fundstelle
 * greift.
 */

const SRC = join(process.cwd(), "src");
/**
 * `__tests__` bleibt aussen vor — wie beim JSX-Wächter nebenan. Eine
 * Test-Vorgabe (`reason: "boom"`) ist keine Oberfläche; sie prüft die
 * Mechanik, nicht den Satz. Wo ein Test *doch* den fertigen Text meint,
 * nimmt er einen echten Schlüssel und `catalogTranslate` — siehe
 * `domain-error-display.test.ts`.
 */
const UEBERSPRUNGEN = new Set(["generated", "test", "__tests__"]);

function dateien(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const pfad = join(dir, name);
    if (statSync(pfad).isDirectory()) return UEBERSPRUNGEN.has(name) ? [] : dateien(pfad);
    return name.endsWith(".ts") || name.endsWith(".tsx") ? [pfad] : [];
  });
}

describe("DomainError trägt Schlüssel, keine Sätze", () => {
  const alle = dateien(SRC);

  it("geht über den ganzen Baum", () => {
    expect(alle.length).toBeGreaterThan(600);
  });

  it("findet nirgends einen ausgeschriebenen Grund", () => {
    const violations = alle.flatMap((pfad) => untranslatedErrorReasons(pfad));
    expect(
      violations,
      violations.length === 0
        ? ""
        : `\n${violations.length} rohe Fehlertexte:\n${formatErrorTextViolations(violations)}\n`,
    ).toEqual([]);
  });
});
