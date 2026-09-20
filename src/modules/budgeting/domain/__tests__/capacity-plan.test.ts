import { describe, it, expect } from "vitest";
import {
  buildCapacityPlan,
  capacityInPoints,
  emptyPointCell,
  sumCapacityPlans,
  type PointCell,
} from "@/modules/budgeting/domain/capacity-plan";
import type { JobSizeRate } from "@/modules/budgeting/domain/art-throughput";
import { CAPACITY_BUCKETS } from "@/modules/work/domain/portfolio-guardrails";

/**
 * Die Rechnung hinter Guardrail 2. Zwei Dinge stehen hier im Mittelpunkt, weil
 * sie beim Lesen der Flaeche leicht als Fehler durchgehen wuerden:
 *
 *  - **Ohne Satz gibt es keine Kapazitaet.** Nicht 0, sondern `null` — die
 *    geplanten Punkte stehen trotzdem da. Eine Guardrail, die ohne Grundlage
 *    eine Ampel zeigt, ist schlimmer als eine, die schweigt.
 *  - **Die Summe addiert Punkte, nie Prozente.** Ein ART ohne Satz traegt seine
 *    Last bei, aber keine Kapazitaet.
 */

const rate = (r: number | null, source?: JobSizeRate["source"]): JobSizeRate => ({
  source: source ?? (r == null ? "none" : "empirical"),
  rate: r,
  cycles: [],
  budgetSum: 0,
  jobSizeSum: 0,
  featureCount: 0,
  standaloneJobSizeSum: 0,
  standaloneFeatureCount: 0,
  caveats: r == null ? ["Kein abgeschlossener Zyklus."] : [],
});

const cell = (jobSize: number, count = 1): PointCell => ({ count, jobSize });

const byBucket = (b: number, e: number, m: number) => ({
  business: cell(b),
  enabler: cell(e),
  maintenance: cell(m),
});

const ZIELE = { business: 70, enabler: 20, maintenance: 10 };

describe("capacityInPoints", () => {
  it("teilt das Budget durch den Satz", () => {
    expect(capacityInPoints(420_000, rate(1_750))).toBe(240);
  });

  it("ohne Satz gibt es keine Zahl — und keine 0", () => {
    expect(capacityInPoints(420_000, rate(null))).toBeNull();
  });

  it("ein Satz von 0 zaehlt als kein Satz, statt durch Null zu teilen", () => {
    expect(capacityInPoints(420_000, rate(0))).toBeNull();
  });

  /**
   * **Der Test, der die 90 Punkte verhindert.**
   *
   * `deriveJobSizeRate` faellt auf `Tenant.costPerJobSizePoint` zurueck, wenn im
   * Fenster nichts fertig wurde. Gemessen liegt dieser Rueckfall bei 1.500 €,
   * die empirischen Saetze derselben Mandanten bei 9.000–11.000 €. Ohne diese
   * Sperre bekaeme ein ART, das ein Jahr lang nichts abgeschlossen hat,
   * 135.000 ÷ 1.500 = 90 Punkte — mehr als die 19 des ARTs daneben, das
   * tatsaechlich liefert.
   */
  it("der mandantenweite Rueckfall ergibt keine Kapazitaet", () => {
    expect(capacityInPoints(135_000, rate(1_500, "tenantDefault"))).toBeNull();
  });

  it("und ohne jeden Satz erst recht nicht", () => {
    expect(capacityInPoints(135_000, rate(null, "none"))).toBeNull();
  });
});

describe("buildCapacityPlan", () => {
  it("teilt die Kapazitaet nach den Zielen auf", () => {
    const plan = buildCapacityPlan({
      budget: 420_000,
      capacity: 240,
      targets: ZIELE,
      plannedByBucket: byBucket(150, 60, 20),
      unclassified: emptyPointCell(),
    });
    expect(plan.rows.map((r) => r.available)).toEqual([168, 48, 24]);
    expect(plan.rows.reduce((s, r) => s + (r.available ?? 0), 0)).toBeCloseTo(240);
  });

  it("die Abweichung ist Geplant minus Verfuegbar — positiv heisst ueberplant", () => {
    const plan = buildCapacityPlan({
      budget: 420_000,
      capacity: 240,
      targets: ZIELE,
      plannedByBucket: byBucket(150, 60, 20),
      unclassified: emptyPointCell(),
    });
    expect(plan.rows[0]!.delta).toBeCloseTo(-18);
    expect(plan.rows[1]!.delta).toBeCloseTo(12);
  });

  it("ohne Kapazitaet bleiben Verfuegbar und Abweichung leer, die Last nicht", () => {
    const plan = buildCapacityPlan({
      budget: 0,
      capacity: null,
      targets: ZIELE,
      plannedByBucket: byBucket(92, 41, 18),
      unclassified: emptyPointCell(),
    });
    expect(plan.rows.every((r) => r.available === null && r.delta === null)).toBe(true);
    expect(plan.rows.map((r) => r.planned.jobSize)).toEqual([92, 41, 18]);
  });

  it("Features ohne Arbeitstyp stehen daneben und zaehlen trotzdem mit", () => {
    const plan = buildCapacityPlan({
      budget: 100,
      capacity: 100,
      targets: ZIELE,
      plannedByBucket: byBucket(10, 10, 10),
      unclassified: cell(7, 2),
    });
    expect(plan.rows.every((r) => r.planned.jobSize !== 7)).toBe(true);
    expect(plan.unclassified.jobSize).toBe(7);
    expect(plan.totalPlanned.jobSize).toBe(37);
    expect(plan.totalPlanned.count).toBe(5);
  });

  it("ein Ziel-Set, das nicht auf 100 summiert, zeichnet die Punkte nicht ueber", () => {
    // Die Validierung verhindert das beim Speichern; ein Bestands-JSON kann es
    // trotzdem tragen. Dann gilt das Verhaeltnis, nicht die rohe Prozentzahl.
    const plan = buildCapacityPlan({
      budget: 100,
      capacity: 100,
      targets: { business: 40, enabler: 40, maintenance: 0 },
      plannedByBucket: byBucket(0, 0, 0),
      unclassified: emptyPointCell(),
    });
    expect(plan.rows.reduce((s, r) => s + (r.available ?? 0), 0)).toBeCloseTo(100);
  });
});

describe("sumCapacityPlans", () => {
  const mitSatz = buildCapacityPlan({
    budget: 200,
    capacity: 100,
    targets: ZIELE,
    plannedByBucket: byBucket(60, 20, 10),
    unclassified: emptyPointCell(),
  });
  const ohneSatz = buildCapacityPlan({
    budget: 0,
    capacity: null,
    targets: ZIELE,
    plannedByBucket: byBucket(30, 10, 5),
    unclassified: cell(4),
  });

  it("addiert Punkte, nicht Prozente", () => {
    const sum = sumCapacityPlans([mitSatz, mitSatz]);
    expect(sum.capacity).toBe(200);
    expect(sum.rows[0]!.planned.jobSize).toBe(120);
  });

  /**
   * **Das ausgewiesene Budget ist das umrechenbare.** Die Flaeche schreibt
   * „X € → Y Punkte"; stuende dort die Summe aller ARTs, waere der Satz
   * dazwischen falsch. Gemessen standen 345.600 € neben 19 Punkten, obwohl nur
   * 210.600 € dahinterlagen.
   */
  it("zaehlt nur das Budget der ARTs, die auch Punkte beitragen", () => {
    const mitBudget = buildCapacityPlan({
      budget: 210_600,
      capacity: 19,
      targets: ZIELE,
      plannedByBucket: byBucket(0, 0, 0),
      unclassified: emptyPointCell(),
    });
    const ohneRate = buildCapacityPlan({
      budget: 135_000,
      capacity: null,
      targets: ZIELE,
      plannedByBucket: byBucket(0, 13, 0),
      unclassified: emptyPointCell(),
    });
    const sum = sumCapacityPlans([mitBudget, ohneRate]);
    expect(sum.budget).toBe(210_600);
    // Die Last des ausgelassenen ARTs zaehlt trotzdem mit — nur seine
    // Kapazitaet nicht.
    expect(sum.rows[1]!.planned.jobSize).toBe(13);
  });

  it("ein ART ohne Satz bringt seine Last mit, aber keine Kapazitaet", () => {
    const sum = sumCapacityPlans([mitSatz, ohneSatz]);
    expect(sum.capacity).toBe(100);
    expect(sum.rows[0]!.planned.jobSize).toBe(90);
    // 90 geplant gegen 70 verfuegbar — die Luecke ist sichtbar und darf es sein.
    expect(sum.rows[0]!.delta).toBeCloseTo(20);
    expect(sum.unclassified.jobSize).toBe(4);
  });

  it("ohne einen einzigen Satz gibt es keine Kapazitaet", () => {
    const sum = sumCapacityPlans([ohneSatz, ohneSatz]);
    expect(sum.capacity).toBeNull();
    expect(sum.rows.every((r) => r.available === null)).toBe(true);
    expect(sum.rows[0]!.planned.jobSize).toBe(60);
  });

  it("die Anteile der Summe kommen aus den Punkten, nicht aus gemittelten Zielen", () => {
    const anders = buildCapacityPlan({
      budget: 200,
      capacity: 100,
      targets: { business: 10, enabler: 10, maintenance: 80 },
      plannedByBucket: byBucket(0, 0, 0),
      unclassified: emptyPointCell(),
    });
    const sum = sumCapacityPlans([mitSatz, anders]);
    // 70 + 10 = 80 von 200 Punkten → 40 %, nicht (70+10)/2 = 40 % zufaellig
    // gleich: der Weg zaehlt. Enabler: 20 + 10 = 30 von 200 → 15 %.
    expect(sum.rows[1]!.targetShare).toBeCloseTo(0.15);
    expect(CAPACITY_BUCKETS).toHaveLength(sum.rows.length);
  });
});
