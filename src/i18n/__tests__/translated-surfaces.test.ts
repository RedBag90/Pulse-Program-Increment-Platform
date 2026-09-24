import { describe, it, expect } from "vitest";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { untranslatedLiterals, formatTextViolations } from "@/test/helpers/translated-surfaces";

/**
 * **Kein sichtbarer Text im Code — projektweit.**
 *
 * Dieser Test begann im September 2026 als Liste von zwölf Dateien, mit der
 * Begründung, ein Wächter über alles wäre am Tag seiner Entstehung rot: 326
 * von 449 Dateien trugen deutsche Literale. Die Liste wuchs mit der
 * Umstellung auf 455 Einträge — und ist mit dem Abschluss von Zug 3
 * überflüssig geworden. Was hier steht, ist der Endzustand, den ADR-0024
 * angekündigt hat.
 *
 * **Was er prüft, und was nicht.** Geprüft wird, was ein Nutzer *liest*: Text
 * zwischen JSX-Marken und die Zeichenketten an den Eigenschaften, die auf dem
 * Bildschirm landen. Eine Konstanten-Tabelle in `domain/` sieht er nicht — die
 * `help`-Prosa der Gate-Kriterien und die Fehlermeldungen der Services stehen
 * in gewöhnlichen Objekten und fallen unter Zug 4 bzw. 5. Wer sie für
 * abgedeckt hielte, hätte einen grünen Lauf und eine halb übersetzte
 * Anwendung.
 *
 * **Zwei Ausnahmen, benannt.** `app/global-error.tsx` ersetzt das gesamte
 * Dokument und greift, wenn das Wurzel-Layout gescheitert ist — dort gibt es
 * keinen Provider und keinen Request. Die Datei trägt ihre zwei Sätze selbst
 * und liest die Sprache aus dem Pfad; ihr Docblock begründet das.
 *
 * `server/email/templates/invite.ts` ist bereits zweisprachig, und zwar mit
 * dem Muster, das ADR-0024 ausdrücklich als richtig benennt: **zwei
 * Funktionen, eine je Sprache**, statt eines Satzes mit Platzhaltern. Eine
 * E-Mail liest niemand im Browser; ihre Sprache steht beim Versand fest und
 * ändert sich danach nie. Sie in den Katalog zu zwingen wäre eine Änderung
 * ohne Gewinn — Zug 5 entscheidet, ob die übrigen Vorlagen diesem Muster
 * folgen oder dem Katalog.
 */

const SRC = join(process.cwd(), "src");

/** Was nie Oberfläche ist. */
const UEBERSPRUNGEN = new Set(["generated", "__tests__", "test"]);

/** Flächen mit eingebautem Text — jede einzeln begründet, siehe oben. */
const AUSNAHMEN = new Set(["app/global-error.tsx", "server/email/templates/invite.ts"]);

function dateien(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const pfad = join(dir, name);
    if (statSync(pfad).isDirectory()) return UEBERSPRUNGEN.has(name) ? [] : dateien(pfad);
    return name.endsWith(".tsx") || name.endsWith(".ts") ? [pfad] : [];
  });
}

describe("Kein roher Text in der Oberfläche", () => {
  const alle = dateien(SRC).filter(
    (p) => !AUSNAHMEN.has(p.replace(SRC + "/", "").replace(/^src\//, "")),
  );

  it("geht über den ganzen Baum, nicht über eine Liste", () => {
    // Schrumpft die Zahl drastisch, hat jemand den Durchgang eingeengt statt
    // eine Fläche zu übersetzen.
    expect(alle.length).toBeGreaterThan(600);
  });

  it("findet nirgends ein Literal, das ein Nutzer liest", () => {
    const violations = alle.flatMap((pfad) => untranslatedLiterals(pfad));
    expect(
      violations,
      violations.length === 0
        ? ""
        : `\n${violations.length} rohe Texte:\n${formatTextViolations(violations)}\n`,
    ).toEqual([]);
  });
});
