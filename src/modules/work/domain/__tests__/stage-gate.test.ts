import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  STAGE_GATES,
  STAGE_GATE_TRANSITIONS,
  isValidTransition,
  isApprovalTransition,
  subStageFor,
  GATE_STEPS,
  isValidStepTransition,
  gateOfStep,
  currentGateStep,
  BUDGET_DECIDED_STEP,
  hasBudgetDecision,
  BUDGET_DECISION_GATE,
  GATES_AFTER_BUDGET_DECISION,
  carriesDeliveryLoad,
  DELIVERY_LOAD_FIRST_STEP,
  DELIVERY_LOAD_LAST_STEP,
  type GateStep,
} from "@/modules/work/domain/stage-gate";

describe("STAGE_GATES", () => {
  it("lists the six gates L0–L5 in order", () => {
    expect(STAGE_GATES).toEqual(["L0", "L1", "L2", "L3", "L4", "L5"]);
  });
});

describe("isValidTransition", () => {
  it("allows a single step forward", () => {
    expect(isValidTransition("L0", "L1")).toBe(true);
    expect(isValidTransition("L2", "L3")).toBe(true);
    expect(isValidTransition("L4", "L5")).toBe(true);
  });

  it("allows a single step back", () => {
    expect(isValidTransition("L1", "L0")).toBe(true);
    expect(isValidTransition("L3", "L2")).toBe(true);
  });

  it("rejects skipping gates", () => {
    expect(isValidTransition("L0", "L2")).toBe(false);
    expect(isValidTransition("L0", "L3")).toBe(false);
    expect(isValidTransition("L1", "L4")).toBe(false);
  });

  it("rejects a no-op transition to the same gate", () => {
    expect(isValidTransition("L2", "L2")).toBe(false);
  });

  it("treats L5 as forward-terminal (only steps back to L4)", () => {
    expect(STAGE_GATE_TRANSITIONS.L5).toEqual(["L4"]);
    expect(isValidTransition("L5", "L4")).toBe(true);
  });
});

describe("isApprovalTransition", () => {
  it("ist genau der Schritt L3 → L3.2 (die Investitionsentscheidung)", () => {
    expect(isApprovalTransition("L3")).toBe(true);
  });

  it("ist für jeden anderen Schritt falsch — auch für den Eintritt L3.1", () => {
    // L3.1 ist nur „Business Case freigegeben"; das Geld folgt erst.
    expect(isApprovalTransition("L2")).toBe(false);
    expect(isApprovalTransition("L4")).toBe(false);
    expect(isApprovalTransition("L1")).toBe(false);
  });
});

describe("subStageFor", () => {
  const base = {
    approvedAt: null as Date | null,
    implementationCompletedAt: null as Date | null,
  };

  it("liefert null für alle Reifegrade ausser L4", () => {
    // **L3 hat seit dem Neuschnitt keinen Split mehr.** „BC freigegeben" und
    // „Budget alloziert" sind eigene Grade (L2 und L3) geworden — L4 ist das
    // letzte Gate, in dem ein Stempel zwei Schritte trennt.
    for (const g of ["L0", "L1", "L2", "L3", "L5"] as const) {
      expect(subStageFor({ ...base, stageGate: g })).toBeNull();
    }
  });

  it("L4 ohne Bestätigung → L4.1 (Umsetzung läuft)", () => {
    expect(subStageFor({ ...base, stageGate: "L4" })).toBe("L4.1");
  });

  it("L4 + abgenommene L4.2-Bestätigung → L4.2 (Umsetzung fertig)", () => {
    expect(
      subStageFor({
        ...base,
        stageGate: "L4",
        implementationCompletedAt: new Date("2026-07-01"),
      }),
    ).toBe("L4.2");
  });

  it("der Bestätigungs-Stempel wirkt nur innerhalb von L4", () => {
    expect(
      subStageFor({ ...base, stageGate: "L3", implementationCompletedAt: new Date("2026-07-01") }),
    ).toBeNull();
  });
});

describe("Gate-Steps (analysis und L4.2 bewegen den Reifegrad nicht)", () => {
  const at = new Date("2026-07-01");

  it("die Leiter trägt acht Schritte auf sechs Reifegraden", () => {
    expect(GATE_STEPS).toEqual(["L0", "L1", "analysis", "L2", "L3", "L4", "L4.2", "L5"]);
  });

  it("erlaubt L1 ↔ analysis ↔ L2, aber nicht L1 → L2 direkt", () => {
    expect(isValidStepTransition("L1", "analysis")).toBe(true);
    expect(isValidStepTransition("analysis", "L2")).toBe(true);
    expect(isValidStepTransition("L2", "analysis")).toBe(true);
    expect(isValidStepTransition("L1", "L2")).toBe(false);
  });

  it("erlaubt L2 ↔ L3 ↔ L4, aber nicht L2 → L4 direkt", () => {
    expect(isValidStepTransition("L2", "L3")).toBe(true);
    expect(isValidStepTransition("L3", "L4")).toBe(true);
    expect(isValidStepTransition("L4", "L3")).toBe(true);
    expect(isValidStepTransition("L2", "L4")).toBe(false);
  });

  it("erlaubt L4 ↔ L4.2 ↔ L5, aber nicht L4 → L5 direkt", () => {
    expect(isValidStepTransition("L4", "L4.2")).toBe(true);
    expect(isValidStepTransition("L4.2", "L5")).toBe(true);
    expect(isValidStepTransition("L5", "L4.2")).toBe(true);
    expect(isValidStepTransition("L4", "L5")).toBe(false);
  });

  it("gateOfStep: die gradlosen Schritte leben in einem fremden Gate", () => {
    // Genau das ist die Aussage des Neuschnitts: „zur Analyse ausgewählt" ist
    // ein Tor, aber kein Reifegrad.
    expect(gateOfStep("analysis")).toBe("L1");
    expect(gateOfStep("L4.2")).toBe("L4");
    expect(gateOfStep("L2")).toBe("L2");
    expect(gateOfStep("L3")).toBe("L3");
  });

  it("currentGateStep: erst der jeweilige Stempel hebt auf den zweiten Schritt", () => {
    const none = { selectedForAnalyzingAt: null, implementationCompletedAt: null };
    expect(currentGateStep({ ...none, stageGate: "L1" })).toBe("L1");
    expect(currentGateStep({ ...none, stageGate: "L1", selectedForAnalyzingAt: at })).toBe(
      "analysis",
    );
    expect(currentGateStep({ ...none, stageGate: "L4" })).toBe("L4");
    expect(currentGateStep({ ...none, stageGate: "L4", implementationCompletedAt: at })).toBe(
      "L4.2",
    );
    // Die Stempel wirken nur in ihrem eigenen Gate.
    expect(currentGateStep({ ...none, stageGate: "L1", implementationCompletedAt: at })).toBe("L1");
    expect(currentGateStep({ ...none, stageGate: "L2", selectedForAnalyzingAt: at })).toBe("L2");
    // L3 traegt keinen zweiten Schritt mehr — „Budget alloziert" ist der Grad.
    expect(currentGateStep({ ...none, stageGate: "L3" })).toBe("L3");
  });
});

/**
 * **Die Schwelle der Wirtschaftlichkeits-Rechnung: L3.2 „Budget alloziert".**
 *
 * Sie ist heikel, weil sie *mitten* in einem Haupt-Gate liegt: L3.1 und L3.2
 * teilen sich `stage_gate = "L3"`, getrennt werden sie erst durch den Stempel
 * `approvedAt`. Wer nur die Gate-Liste abfragt, nimmt entweder beide oder
 * keinen — und rechnet dann mit Vorhaben, über die niemand entschieden hat.
 */
describe("hasBudgetDecision — ab wann ein Epic ins Portfolio-Dashboard zählt", () => {
  it("liegt auf L3.2, nicht auf L3.1", () => {
    expect(BUDGET_DECIDED_STEP).toBe("L3");
    expect(hasBudgetDecision("L2")).toBe(false);
    expect(hasBudgetDecision("L3")).toBe(true);
  });

  it("gilt für jeden späteren Schritt und für keinen früheren", () => {
    const schwelle = GATE_STEPS.indexOf(BUDGET_DECIDED_STEP);
    GATE_STEPS.forEach((step, i) => {
      expect(hasBudgetDecision(step), `Schritt ${step}`).toBe(i >= schwelle);
    });
  });

  it("die Gate-Zerlegung für Abfragen deckt die Schwelle vollständig ab", () => {
    // Das geteilte Gate ist ausdrücklich **nicht** in der Liste der Gates, die
    // ganz dahinterliegen — sonst käme L3.1 mit durch.
    expect(BUDGET_DECISION_GATE).toBe("L3");
    expect(GATES_AFTER_BUDGET_DECISION).toEqual(["L4", "L5"]);
    expect(GATES_AFTER_BUDGET_DECISION).not.toContain(BUDGET_DECISION_GATE);
  });
});

/**
 * **Das Lieferfenster L3.2–L4.2.**
 *
 * Es misst die Produktgröße im Horizont-Trichter, wenn es kein Geld gibt. Die
 * beiden Ränder sind die eigentliche Aussage: davor ist nichts beschlossen,
 * danach (L5) wird nichts mehr geliefert — ein Produkt soll zeigen, woran
 * gearbeitet wird, nicht was es je geliefert hat.
 */
describe("carriesDeliveryLoad — das Lieferfenster", () => {
  it("liegt zwischen L3.2 und L4.2", () => {
    expect(DELIVERY_LOAD_FIRST_STEP).toBe("L3");
    expect(DELIVERY_LOAD_LAST_STEP).toBe("L4.2");
  });

  it("gilt genau für L3.2, L4.1 und L4.2", () => {
    // `L4` ist der gespeicherte Wert des Schritts, der als L4.1 angezeigt wird.
    const drin: GateStep[] = ["L3", "L4", "L4.2"];
    for (const step of GATE_STEPS) {
      expect(carriesDeliveryLoad(step), `Schritt ${step}`).toBe(drin.includes(step));
    }
  });

  it("schließt L3.1 unten und L5 oben aus — beide Ränder sind Aussagen", () => {
    expect(carriesDeliveryLoad("L2")).toBe(false);
    expect(carriesDeliveryLoad("L5")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Das alte Vokabular
// ---------------------------------------------------------------------------

/**
 * **`"L3.1"` und `"L3.2"` sind keine Werte mehr.**
 *
 * Der Reifegrad-Neuschnitt hat sie im September 2026 durch `L2` und `L3`
 * ersetzt — aber vier Stellen sprachen weiter die alte Sprache, und keine
 * davon meldete sich:
 *
 *  - `seed-offsite.ts` **schrieb** `toGate: "L3.1"`, und die Epic-Liste stürzte
 *    darüber ab (`t("L3.1")` wirft);
 *  - drei Abfragen (`transformation.ts`, zweimal `portfolio-dashboard.ts`)
 *    **fragten** danach und lieferten still **0** — „Epics mit beantragter
 *    BC-Freigabe" zählte seit dem Umbau niemanden mehr.
 *
 * Ein Absturz ist laut; die drei Abfragen waren leise, und das ist schlimmer.
 * Genau diese vier hätte diese Prüfung bei der Umstellung gemeldet.
 *
 * **Was sie misst.** Nur den Wert selbst: ein Zeichenketten-Literal, das
 * *genau* `L3.1` oder `L3.2` ist. Prosa darüber ist ausdrücklich erlaubt — der
 * Bestand erklärt an vielen Stellen, was vor dem Neuschnitt galt, und ein
 * Wächter, der Geschichtsschreibung verbietet, nähme dem Code sein Gedächtnis.
 * Kommentare fallen deshalb vorher heraus.
 */
describe("Das alte Reifegrad-Vokabular lebt nicht mehr im Code", () => {
  /** Das Wanderungs-Skript muss beide Namen kennen — es ist der Übersetzer. */
  const UEBERSPRUNGEN = new Set(["generated", "scripts", "node_modules"]);

  /**
   * Eine einzige Ausnahme, und sie beweist die Regel: dieser Test hält fest,
   * dass ein **unbekannter** Schritt als Rohwert dasteht statt zu werfen. Dafür
   * braucht er einen Schritt, den es nicht gibt.
   */
  const AUSNAHMEN = new Set(["src/modules/work/domain/__tests__/gate-step-labels.test.ts"]);

  const ALTE_WERTE = /["'`]L3\.[12]["'`]/g;

  /** Längentreu ersetzt, damit die gemeldete Zeilennummer stimmt. */
  function ohneKommentare(src: string): string {
    return src
      .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
      .replace(/\/\/[^\n]*/g, (m) => " ".repeat(m.length));
  }

  function dateien(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const pfad = join(dir, name);
      if (statSync(pfad).isDirectory()) return UEBERSPRUNGEN.has(name) ? [] : dateien(pfad);
      return name.endsWith(".ts") || name.endsWith(".tsx") ? [pfad] : [];
    });
  }

  const alle = [
    ...dateien(join(process.cwd(), "src")),
    ...dateien(join(process.cwd(), "prisma")),
  ].map((p) => p.replace(process.cwd() + "/", ""));

  it("geht über den ganzen Baum, nicht über eine Liste", () => {
    expect(alle.length).toBeGreaterThan(600);
  });

  it("findet nirgends mehr ein L3.1 oder L3.2 als Wert", () => {
    const funde: string[] = [];
    for (const rel of alle) {
      if (AUSNAHMEN.has(rel)) continue;
      const src = ohneKommentare(readFileSync(join(process.cwd(), rel), "utf8"));
      for (const m of src.matchAll(ALTE_WERTE)) {
        const zeile = src.slice(0, m.index ?? 0).split("\n").length;
        funde.push(`  · ${rel}:${zeile}  ${m[0]}`);
      }
    }
    expect(funde.join("\n"), `Altes Reifegrad-Vokabular als Wert:\n${funde.join("\n")}`).toBe("");
  });
});
