import { describe, it, expect } from "vitest";
import { join } from "node:path";
import {
  visualViolations,
  filesUnder,
  formatVisualViolations,
} from "@/test/helpers/visual-language";

/**
 * **ADR-0021 gilt jetzt für `src/` — vollständig.**
 *
 * Dieser Test begann als Liste von fünf Dateien, weil ein projektweiter Test
 * am Tag seiner Entstehung rot gewesen wäre: 858 rohe Palettenwerte, 292
 * beliebige Schriftgrößen, 73 handgerollte Karten. Die Liste wuchs mit dem
 * Umbau — erst Dateien, dann Routen über ihren Importgraph, dann ganze
 * Verzeichnisse. Jetzt ist sie überflüssig: **es gibt nichts mehr
 * auszunehmen.**
 *
 * Der Weg dorthin hat die Regel zweimal geschärft und die Messung einmal
 * korrigiert:
 *
 * - **Regel**: der falsche Fokus-Ring (`ring-2 ring-ring`) zählt wie `focus:`;
 *   Seitenrahmen (`border-l-*`), gestrichelte Rahmen, Druckflächen und
 *   durchscheinendes Weiß sind **keine** Verstöße — sie tragen Bedeutung, die
 *   die Token nicht ausdrücken.
 * - **Messung**: eine Routenmessung ab `page.tsx` sieht die Navigation nicht,
 *   denn die lebt im `layout.tsx`. Ein Verzeichnis-Durchgang sieht sie — und
 *   fand außerdem sechs Dateien, die an **keinem** Importgraph hängen.
 *
 * Deshalb steht hier ein Durchgang, keine Liste. Wer eine neue Fläche baut,
 * wird von ihm gemessen, ohne sich eintragen zu müssen.
 */
const SRC = join(process.cwd(), "src");

/**
 * `src/test` ist ausgenommen: dort stehen die Regeln selbst, und ihre
 * Musterzeichenketten würden sich gegenseitig melden. `src/generated` ist
 * erzeugter Code.
 */
const NICHT_GERENDERT = ["src/test/", "src/generated/"];

describe("ADR-0021 — die visuelle Sprache über src/", () => {
  const files = filesUnder(SRC).filter(
    (f) => !NICHT_GERENDERT.some((p) => f.replace(/^.*\/src\//, "src/").startsWith(p)),
  );

  it("prüft den gesamten Quellbaum", () => {
    expect(files.length).toBeGreaterThan(500);
  });

  it("keine Datei bricht die Regel", () => {
    const violations = files.flatMap((f) => visualViolations(f));
    expect(
      violations,
      violations.length === 0
        ? ""
        : `\n${violations.length} Verstöße:\n${formatVisualViolations(violations)}\n`,
    ).toEqual([]);
  });
});
