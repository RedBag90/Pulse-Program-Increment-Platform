import { describe, it, expect } from "vitest";
import {
  derivePbInfo,
  isPbEligible,
  pbSourceKind,
  resolveEpicClass,
  isEpicClass,
  provisionalEpicClass,
  intendedClassFrozen,
  classifyEpic,
  type PbSource,
} from "@/modules/work/domain/pb-submission";

const HYPOTHESIS = {
  current: {
    measuresHypothesis: "Self-Service-Portal",
    changeFromBaseline: "von manuell zu automatisiert",
    businessOutcomes: ["Ticketvolumen −30 %", "  "],
    leadingIndicators: ["Portal-Logins"],
    risks: ["Adoption unklar"],
  },
};

const BUSINESS_CASE = {
  current: {
    initiativeDescription: "Kundenportal ausbauen",
    businessOutcomeHypothesis: "NPS +10",
    inScope: "Login, Self-Service",
    outOfScope: "Native App",
    whatYouNeedToBelieve: "Adoption > 40 %",
    costSlices: [{ amount: 120000 }, { amount: 80000 }],
  },
};

const base: PbSource = {
  businessCase: null,
  benefitHypothesis: null,
  businessCaseApprovedAt: null,
  hypothesisApprovedAt: null,
};

describe("isPbEligible / pbSourceKind", () => {
  it("none when no artefact is approved", () => {
    expect(isPbEligible(base)).toBe(false);
    expect(pbSourceKind(base)).toBe("none");
  });

  it("approved LBC wins over an approved hypothesis", () => {
    const e = { businessCaseApprovedAt: new Date(), hypothesisApprovedAt: new Date() };
    expect(pbSourceKind(e)).toBe("lbc");
    expect(isPbEligible(e)).toBe(true);
  });

  it("eine freigegebene Hypothese allein reicht **nicht**", () => {
    // Bis September 2026 kam dieses Epic auf die PB-Liste und bekam einen
    // Pauschalbetrag — das Portfolio budgetierte damit die Erarbeitung des
    // Business Case. Es finanziert die Umsetzung.
    const e = { businessCaseApprovedAt: null, hypothesisApprovedAt: new Date() };
    expect(pbSourceKind(e)).toBe("none");
    expect(isPbEligible(e)).toBe(false);
  });
});

describe("derivePbInfo", () => {
  it("none → not ready, cost 0, no rows", () => {
    const info = derivePbInfo(base);
    expect(info).toEqual({ ready: false, source: "none", cost: 0, rows: [] });
  });

  it("approved LBC → cost from cost slices + LBC rows", () => {
    const info = derivePbInfo({
      ...base,
      businessCase: BUSINESS_CASE,
      businessCaseApprovedAt: new Date(),
    });
    expect(info.ready).toBe(true);
    expect(info.source).toBe("lbc");
    expect(info.cost).toBe(200000); // 120k + 80k
    expect(info.rows).toEqual([
      { label: "Beschreibung", value: "Kundenportal ausbauen" },
      { label: "Business-Outcome", value: "NPS +10" },
      { label: "In Scope", value: "Login, Self-Service" },
      { label: "Out of Scope", value: "Native App" },
      { label: "Annahmen", value: "Adoption > 40 %" },
    ]);
  });

  it("nur Hypothese → nicht budgeting-reif, kein Richtwert", () => {
    const info = derivePbInfo({
      ...base,
      benefitHypothesis: HYPOTHESIS,
      hypothesisApprovedAt: new Date(),
    });
    expect(info).toEqual({ ready: false, source: "none", cost: 0, rows: [] });
  });
});

describe("resolveEpicClass — entschieden schlägt erwartet", () => {
  it("nimmt die Entscheidung, wenn es eine gibt", () => {
    expect(resolveEpicClass("portfolio", "art")).toEqual({
      epicClass: "portfolio",
      classSource: "approved",
    });
  });

  it("nimmt die Erwartung, solange nichts entschieden ist", () => {
    // Die 123 Epics, die die Facette bisher nicht fand.
    expect(resolveEpicClass(null, "art")).toEqual({ epicClass: "art", classSource: "intended" });
  });

  it("bleibt ohne beides leer", () => {
    expect(resolveEpicClass(null, null)).toEqual({ epicClass: null, classSource: "none" });
  });

  it("ist eine Einbahnstraße: eine Erwartung überschreibt nie eine Entscheidung", () => {
    for (const decided of ["portfolio", "art"] as const) {
      for (const intended of ["portfolio", "art", null] as const) {
        expect(resolveEpicClass(decided, intended).epicClass).toBe(decided);
      }
    }
  });
});

describe("isEpicClass", () => {
  it("lässt nur die beiden echten Werte durch", () => {
    expect(isEpicClass("portfolio")).toBe(true);
    expect(isEpicClass("art")).toBe(true);
    expect(isEpicClass("Portfolio")).toBe(false);
    expect(isEpicClass(null)).toBe(false);
    expect(isEpicClass(undefined)).toBe(false);
  });
});

/**
 * **Der Hinweis, der nie erscheinen konnte.**
 *
 * Wer sein Vorhaben als ART-Epic führt, dessen Business Case aber über dem
 * Limit liegt, soll das beim Beantragen von L2 erfahren. Der Dialog dafür gab
 * es seit jeher — und er feuerte nie, weil er gegen die **entschiedene** Klasse
 * prüfte, und die entsteht erst durch genau diese Abnahme. Ein Zirkel.
 *
 * `provisionalEpicClass` bricht ihn: dieselbe Rechnung, ohne das Freigabe-Tor.
 */
describe("provisionalEpicClass — die Klasse, die der Entwurf ergäbe", () => {
  const SCHWELLE = 70000;

  it("nennt ein Epic über dem Limit Portfolio-Sache — **ohne** Freigabe", () => {
    // Genau der gemeldete Fall: 200.000 € im Entwurf, nichts freigegeben.
    expect(provisionalEpicClass({ businessCase: BUSINESS_CASE }, SCHWELLE)).toBe("portfolio");
    // Und die entschiedene Klasse gibt es hier noch nicht — das ist der Zirkel.
    expect(
      classifyEpic(
        { businessCase: BUSINESS_CASE, businessCaseApprovedAt: null, portfolioOverrideAt: null },
        SCHWELLE,
      ).epicClass,
    ).toBeNull();
  });

  it("nennt ein Epic unter dem Limit ART-Sache", () => {
    const klein = { current: { costSlices: [{ amount: 12000 }] } };
    expect(provisionalEpicClass({ businessCase: klein }, SCHWELLE)).toBe("art");
  });

  it("schweigt, solange keine Kosten eingetragen sind", () => {
    // „ART-Epic, weil 0 ≤ Limit" wäre eine Behauptung über einen leeren
    // Entwurf — und der Dialog, der daraus entstünde, eine Lüge.
    expect(provisionalEpicClass({ businessCase: null }, SCHWELLE)).toBeNull();
    expect(provisionalEpicClass({ businessCase: { current: {} } }, SCHWELLE)).toBeNull();
    expect(
      provisionalEpicClass({ businessCase: { current: { costSlices: [] } } }, SCHWELLE),
    ).toBeNull();
  });

  it("zählt Gleichstand als ART-Sache — wie die entschiedene Rechnung", () => {
    const genau = { current: { costSlices: [{ amount: SCHWELLE }] } };
    expect(provisionalEpicClass({ businessCase: genau }, SCHWELLE)).toBe("art");
  });

  it("stimmt mit der entschiedenen Klasse überein, sobald freigegeben ist", () => {
    // Die beiden dürfen nie auseinanderlaufen — es ist dieselbe Rechnung.
    const freigegeben = {
      businessCase: BUSINESS_CASE,
      businessCaseApprovedAt: new Date("2026-09-01"),
      portfolioOverrideAt: null,
    };
    expect(provisionalEpicClass(freigegeben, SCHWELLE)).toBe(
      classifyEpic(freigegeben, SCHWELLE).epicClass,
    );
  });
});

describe("intendedClassFrozen — bis L2 änderbar, danach Geschichte", () => {
  it("lässt die Erwartung vor der Freigabe zu", () => {
    expect(intendedClassFrozen({ businessCaseApprovedAt: null })).toBe(false);
  });

  it("friert sie mit der Freigabe ein", () => {
    expect(intendedClassFrozen({ businessCaseApprovedAt: new Date("2026-09-01") })).toBe(true);
  });
});

/**
 * **Die vorläufige Klasse darf nirgends Geld bewegen.**
 *
 * Sie sagt, was der *Entwurf* ergäbe — änderbar, unverbindlich, ohne Abnahme.
 * Im Budgeting zählt ausschliesslich die entschiedene Klasse; `period-detail`
 * hält das sogar ausdrücklich fest („Seit die Klasse zweistufig auflöst,
 * springt sonst die beim Anlegen hinterlegte Erwartung ein. Die zählt hier
 * ausdrücklich nicht.").
 *
 * Ein Import in `modules/budgeting/**` wäre genau dieser Rückfall, eine Ebene
 * weiter. Deshalb dieser Riegel — er kostet nichts und schliesst die Tür,
 * bevor jemand sie findet.
 */
describe("provisionalEpicClass — der Riegel", () => {
  it("wird im Budgeting nirgends benutzt", async () => {
    const { readdirSync, readFileSync, statSync } = await import("node:fs");
    const { join } = await import("node:path");

    const wurzel = join(process.cwd(), "src", "modules", "budgeting");
    const dateien = (dir: string): string[] =>
      readdirSync(dir).flatMap((name) => {
        const pfad = join(dir, name);
        if (statSync(pfad).isDirectory()) return dateien(pfad);
        return name.endsWith(".ts") || name.endsWith(".tsx") ? [pfad] : [];
      });

    const treffer = dateien(wurzel).filter((p) =>
      /\bprovisionalEpicClass\b/.test(readFileSync(p, "utf8")),
    );

    expect(
      treffer.map((p) => p.replace(process.cwd() + "/", "")),
      "Im Budgeting zählt die entschiedene Klasse, nicht der Entwurf.",
    ).toEqual([]);
  });
});
