import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { buildFeatureDetailModel } from "@/modules/drumbeat/server/views/feature-detail";

/**
 * **Ein Feature hat keinen Reifegrad.**
 *
 * `stage_gate` sitzt auf der geteilten `initiatives`-Tabelle und ist NOT NULL,
 * der Doc-Kommentar der Spalte sagt „(EPIC only)", und die Gate-Maschinerie
 * filtert durchgehend `level: EPIC`. Trotzdem stand der Wert bis September 2026
 * als Feld REIFEGRAD auf der Feature-Detailseite — gemessen trugen **alle 650**
 * Features L3, in 130 Faellen im Widerspruch zum Epic darueber.
 *
 * Moeglich war das, weil nur die eine Haelfte geprueft wurde: dass das Modell
 * durchreicht, was hereinkommt. Dass nichts es hereingibt, prueft niemand. Diese
 * Datei ist die fehlende zweite Haelfte — drei Riegel gegen dieselbe Rueckkehr:
 * das Render-Shape, der Anlagepfad, die Seeds.
 */

const repo = process.cwd();
const read = (rel: string) => readFileSync(join(repo, rel), "utf8");

/**
 * Ein **geschriebener** Reifegrad: `stageGate: "L3"`. Das grenzt gegen die
 * beiden harmlosen Formen ab, die in denselben Dateien vorkommen — `stageGate:
 * true` in einem Prisma-`select` und `stageGate: r.stageGate` beim Zuruecklesen.
 */
const GESETZTER_REIFEGRAD = /^[ \t]*stageGate:\s*"/gm;

describe("das Render-Shape des Features", () => {
  it("traegt keinen eigenen Reifegrad — nur den des Epics", () => {
    const model = buildFeatureDetailModel({
      id: "f1",
      title: "Feature",
      description: null,
      status: "approved",
      parentId: "e1",
      parentTitle: "Epic",
      parentStageGate: "L2",
      artId: null,
      artName: null,
      valueStreamId: null,
      valueStreamName: null,
      ownSolutionId: null,
      ownSolutionName: null,
      parentSolutionId: null,
      parentSolutionName: null,
      piId: null,
      piName: null,
      piStartDate: null,
      piEndDate: null,
      ownerId: null,
      ownerLabel: null,
      wsjfBusinessValue: null,
      wsjfTimeCriticality: null,
      wsjfRiskReduction: null,
      wsjfJobSize: null,
      wsjfComputed: null,
      featureType: null,
      acceptanceCriteria: [],
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
    });
    expect(Object.keys(model)).not.toContain("stageGate");
    // Der Reifegrad des Epics bleibt — daran haengt `featureStartBlockedReason`.
    expect(model.parent?.stageGate).toBe("L2");
  });
});

describe("der Anlagepfad", () => {
  it("schreibt an keinem Feature einen Reifegrad", () => {
    // `feature.ts` legt Features an (Vollformular, Schnellanlage, mit
    // Abhaengigkeit). Kaeme hier je ein `stageGate` dazu, waere der Wert
    // wieder da — diesmal aus dem Produkt statt aus dem Seed.
    const src = read("src/modules/work/server/services/feature.ts");
    expect([...src.matchAll(/^[ \t]*stageGate:/gm)].map((m) => m[0].trim())).toEqual([]);
  });
});

describe("die Seeds", () => {
  it("setzen den Reifegrad nur an Epics", () => {
    // Die Feature-Bloecke der Seeds trugen fuenf `stageGate: "L3"`-Literale.
    // Uebrig ist genau eines, und das steht an einem **Epic**
    // (`seed-offsite.ts`, Zeile mit dem Kommentar „L3 = Budget alloziert").
    const treffer = [
      "prisma/seed-demo.ts",
      "prisma/seed-large.ts",
      "prisma/seed-offsite.ts",
    ].flatMap((datei) => {
      const src = read(datei);
      return [...src.matchAll(GESETZTER_REIFEGRAD)].map((m) => {
        const bis = src.slice(0, m.index ?? 0);
        // Die naechsten Zeilen desselben Literals sagen, was da geschrieben
        // wird: ein Epic traegt `epicType`, ein Feature `featureType`.
        const rest = src.slice(m.index ?? 0, (m.index ?? 0) + 400);
        const art = /epicType:/.test(rest) ? "Epic" : "FEATURE";
        return `${datei}:${bis.split("\n").length} (${art})`;
      });
    });
    // Nicht-leer heisst: der Riegel greift ueberhaupt. Ohne diese Zeile wuerde
    // der Test auch dann gruen, wenn das Muster gar nichts mehr faende.
    expect(treffer.filter((t) => t.endsWith("(Epic)"))).not.toEqual([]);
    expect(treffer.filter((t) => t.endsWith("(FEATURE)"))).toEqual([]);
  });
});
