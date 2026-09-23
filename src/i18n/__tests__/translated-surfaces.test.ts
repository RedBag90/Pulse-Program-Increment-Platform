import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { untranslatedLiterals, formatTextViolations } from "@/test/helpers/translated-surfaces";

/**
 * **Die Flächen, die bereits übersetzt sind, bleiben es.**
 *
 * Nach dem Vorbild des ADR-0021-Wächters nebenan: eine Liste, die mit dem
 * Umbau wächst, statt eines projektweiten Tests, der am ersten Tag rot wäre —
 * 326 von 449 Dateien tragen heute deutsche Literale.
 *
 * **Wer eine Fläche übersetzt, trägt sie hier ein.** Ab dann kann niemand mehr
 * einen rohen String hineinschreiben, ohne dass der Lauf rot wird. Am Ende der
 * Umstellung steht hier ein Verzeichnis-Durchgang statt einer Liste, und diese
 * Datei sieht aus wie `visual-language.test.tsx` heute.
 */

const SRC = join(process.cwd(), "src");

/**
 * Bereits übersetzte Flächen — der Rahmen der Anwendung.
 *
 * Navigation, Anmeldung und Fehlerseiten waren die einzigen Flächen, die von
 * Anfang an aus dem Katalog lasen. Sie sind der Anfang der Liste.
 */
const UEBERSETZT = [
  "components/nav/sidebar.tsx",
  "components/nav/topbar.tsx",
  "components/nav/mobile-nav.tsx",
  "components/nav/top-nav-mega-panel.tsx",
  "components/nav/top-nav-mega-triggers.tsx",
  "features/auth/components/sign-in-form.tsx",
  "features/auth/components/sign-up-form.tsx",
  "features/auth/components/forgot-password-form.tsx",
  "features/auth/components/reset-password-form.tsx",
  "app/[locale]/not-found.tsx",
  "app/[locale]/error.tsx",
  "app/[locale]/(dashboard)/error.tsx",
];

describe("Übersetzte Flächen bleiben übersetzt", () => {
  it("führt eine Liste, die mit der Umstellung wächst", () => {
    // Schrumpft sie je, ist eine Fläche zurückgefallen.
    expect(UEBERSETZT.length).toBeGreaterThanOrEqual(12);
  });

  it("trägt in keiner davon einen rohen Text", () => {
    const violations = UEBERSETZT.flatMap((rel) => untranslatedLiterals(join(SRC, rel)));
    expect(
      violations,
      violations.length === 0
        ? ""
        : `\n${violations.length} rohe Texte:\n${formatTextViolations(violations)}\n`,
    ).toEqual([]);
  });
});
