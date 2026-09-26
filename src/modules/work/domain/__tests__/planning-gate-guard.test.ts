import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * **Ein Tor, das nur eine von drei Türen kennt, ist eine Fassade.**
 *
 * „Features erst ab L3 einplanen" wurde im September 2026 in `setFeaturePi`
 * eingebaut — der Operation, die dafür gedacht ist. Daneben standen aber drei
 * weitere Wege, die `piId` an einem Feature setzen, und keiner davon las auch
 * nur den Elter:
 *
 *  - `createFeature` nimmt `piId` beim Anlegen entgegen.
 *  - `updateFeature` schreibt es, **ohne** es zu auditieren — und
 *    `PATCH /api/v1/features/[id]` geht genau dort hindurch.
 *  - Die beiden REST-Routen liegen auf diesen zwei Diensten.
 *
 * Dieser Riegel zählt die Schreibstellen. Kommt eine vierte dazu, fällt er —
 * und wer sie baut, muss sich das Tor ansehen, statt es zu übersehen.
 *
 * **Was er nicht kann:** prüfen, ob die neue Stelle das Tor *richtig* aufruft.
 * Das leistet nur ein Test gegen die Datenbank. Er hält die Frage offen, statt
 * sie zu beantworten — und das ist mehr, als vorher da war.
 */

const repo = process.cwd();

/**
 * `piId` als **geschriebenes** Feld eines Prisma-`data`-Objekts.
 *
 * Ein Schreibzugriff weist einen Wert zu (`piId: null`, `piId: x`, `{ piId }`);
 * ein Lesezugriff nennt eine Bedingung (`piId: { not: null }`) oder eine
 * Auswahl (`piId: true`). Beide Lesarten sind ausgenommen.
 *
 * Zwei Fallen, beide auf dem Weg hierher aufgelaufen:
 *
 *  - **Ohne `g`.** Mit dem Flag merkt sich ein Regex seine Position zwischen
 *    `.test()`-Aufrufen — der Riegel meldete Dateien, in denen `piId` nur in
 *    einem `select` steht.
 *  - **Der Ausschluss steht im Vorausblick, nicht hinter `\\s*`.** So
 *    geschrieben konnte die Leerzeichen-Gruppe zurückspringen und `true`
 *    gerade nicht mehr sehen. Beides gefunden hat die Fehlermeldung, nicht
 *    das Lesen.
 */
const SCHREIBT_PI = /(?:^|[{,\s])piId(?!\s*:\s*(?:true\b|\{))[,:}\s]/m;

describe("das Planungs-Tor", () => {
  it("kennt genau die Dienste, die ein PI setzen", () => {
    // Wer hier auftaucht, muss `featurePlanningBlockedKey` fragen.
    const src = readFileSync(join(repo, "src/modules/work/server/services/feature.ts"), "utf8");
    const torAufrufe = [...src.matchAll(/featurePlanningBlockedKey\(/g)].length;

    // `setFeaturePi`, `createFeature`, `updateFeature` — drei, nicht weniger.
    expect(torAufrufe).toBe(3);
  });

  it("wird von keiner anderen Datei am Dienst vorbei geschrieben", () => {
    // `initiative.update`/`create` mit `piId` ausserhalb von `feature.ts` wäre
    // ein vierter Weg. Die beiden Rückwärts-Reparaturen (PI gelöscht, ART von
    // der Timeline gelöst) **entfernen** nur — sie setzen `piId: null` und
    // stehen deshalb ausdrücklich hier.
    const ERLAUBT = new Set([
      "src/modules/work/server/services/feature.ts",
      "src/modules/drumbeat/server/services/pi.ts",
      "src/modules/drumbeat/server/services/timeline.ts",
    ]);

    const dateien = (dir: string): string[] =>
      readdirSync(dir).flatMap((name) => {
        const pfad = join(dir, name);
        if (statSync(pfad).isDirectory()) {
          return name === "generated" || name === "__tests__" ? [] : dateien(pfad);
        }
        return name.endsWith(".ts") ? [pfad] : [];
      });

    const funde: string[] = [];
    for (const pfad of dateien(join(repo, "src", "modules"))) {
      const rel = pfad.replace(repo + "/", "");
      if (ERLAUBT.has(rel) || !rel.includes("/server/services/")) continue;
      const src = readFileSync(pfad, "utf8");
      if (!/initiative\.(update|updateMany|create)\(/.test(src)) continue;
      if (SCHREIBT_PI.test(src)) funde.push(rel);
    }

    expect(
      funde,
      funde.length === 0
        ? ""
        : `\nSchreibt am Planungs-Tor vorbei ein PI:\n  · ${funde.join("\n  · ")}\n`,
    ).toEqual([]);
  });
});
