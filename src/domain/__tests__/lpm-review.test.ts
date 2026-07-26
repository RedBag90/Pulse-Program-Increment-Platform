import { describe, it, expect } from "vitest";
import {
  kpiPlanned,
  measurementValueAt,
  kpiRealizedAt,
  piIndexForDate,
  epicTerminabweichungPis,
  realisierungsfaktor,
  epicFeatureCounts,
  computeLpmReview,
  type LpmKpiInput,
  type LpmEpicInput,
  type LpmPi,
} from "@/domain/lpm-review";

// 4 PIs, je ~90 Tage, ab 2026-01-01.
const pis: LpmPi[] = [
  { id: "pi1", label: "PI 1", startMs: Date.parse("2026-01-01"), endMs: Date.parse("2026-03-31") },
  { id: "pi2", label: "PI 2", startMs: Date.parse("2026-04-01"), endMs: Date.parse("2026-06-30") },
  { id: "pi3", label: "PI 3", startMs: Date.parse("2026-07-01"), endMs: Date.parse("2026-09-30") },
  { id: "pi4", label: "PI 4", startMs: Date.parse("2026-10-01"), endMs: Date.parse("2026-12-31") },
];

const kpi = (over: Partial<LpmKpiInput> = {}): LpmKpiInput => ({
  baseline: 0,
  target: 100,
  valuePerUnit: 1000,
  benefitKind: "one_time",
  recurringInterval: "yearly",
  measurements: [],
  ...over,
});

describe("kpiPlanned — Planned-€ (recurring annualisiert)", () => {
  it("one_time = |target−baseline| × valuePerUnit", () => {
    expect(kpiPlanned(kpi())).toBe(100_000);
  });
  it("recurring monthly ×12", () => {
    expect(kpiPlanned(kpi({ benefitKind: "recurring", recurringInterval: "monthly" }))).toBe(
      1_200_000,
    );
  });
  it("recurring yearly ×1", () => {
    expect(kpiPlanned(kpi({ benefitKind: "recurring", recurringInterval: "yearly" }))).toBe(
      100_000,
    );
  });
  it("0 wenn unbewertet (kein valuePerUnit/baseline/target)", () => {
    expect(kpiPlanned(kpi({ valuePerUnit: null }))).toBe(0);
    expect(kpiPlanned(kpi({ baseline: null }))).toBe(0);
  });
});

describe("measurementValueAt — letzter Messwert ≤ Stichtag", () => {
  const ms = [
    { atMs: Date.parse("2026-02-01"), value: 20 },
    { atMs: Date.parse("2026-05-01"), value: 60 },
    { atMs: Date.parse("2026-08-01"), value: 90 },
  ];
  it("wählt den jüngsten Punkt ≤ cutoff", () => {
    expect(measurementValueAt(ms, Date.parse("2026-06-30"), 0)).toBe(60);
    expect(measurementValueAt(ms, Date.parse("2026-08-15"), 0)).toBe(90);
  });
  it("fällt auf baseline zurück, wenn kein Punkt ≤ cutoff", () => {
    expect(measurementValueAt(ms, Date.parse("2026-01-15"), 5)).toBe(5);
  });
});

describe("kpiRealizedAt — Achievement(≤cutoff) × Planned", () => {
  it("60 % Achievement → 60 % des Planned-€", () => {
    const k = kpi({ measurements: [{ atMs: Date.parse("2026-05-01"), value: 60 }] });
    expect(kpiRealizedAt(k, Date.parse("2026-06-30"))).toBe(60_000);
  });
  it("clamped auf 100 % bei Übererfüllung", () => {
    const k = kpi({ measurements: [{ atMs: Date.parse("2026-05-01"), value: 150 }] });
    expect(kpiRealizedAt(k, Date.parse("2026-06-30"))).toBe(100_000);
  });
  it("0 vor dem ersten Messpunkt (baseline)", () => {
    const k = kpi({ measurements: [{ atMs: Date.parse("2026-05-01"), value: 60 }] });
    expect(kpiRealizedAt(k, Date.parse("2026-01-01"))).toBe(0);
  });
});

describe("piIndexForDate", () => {
  it("mappt Datum auf den PI, in dem es landet", () => {
    expect(piIndexForDate(pis, Date.parse("2026-02-15"))).toBe(0);
    expect(piIndexForDate(pis, Date.parse("2026-08-15"))).toBe(2);
  });
  it("nach dem letzten PI → letzter Index", () => {
    expect(piIndexForDate(pis, Date.parse("2027-06-01"))).toBe(3);
  });
  it("leere Liste → -1", () => {
    expect(piIndexForDate([], 0)).toBe(-1);
  });
});

describe("realisierungsfaktor", () => {
  it("1,0 bei ≤0 PI Verzug", () => {
    expect(realisierungsfaktor(0)).toBe(1);
    expect(realisierungsfaktor(-1)).toBe(1);
  });
  it("−0,1 je PI Verzug, geklemmt auf floor 0,4", () => {
    expect(realisierungsfaktor(2)).toBeCloseTo(0.8);
    expect(realisierungsfaktor(10)).toBe(0.4); // floor
  });
});

describe("epicTerminabweichungPis", () => {
  const epic = (over: Partial<LpmEpicInput> = {}): LpmEpicInput => ({
    id: "e",
    title: "E",
    valueStreamId: "vs",
    valueStreamName: "VS",
    kpis: [],
    features: [],
    plannedEndMs: null,
    ...over,
  });
  it("Ist-Ende 2 PIs nach Plan-Ende → +2", () => {
    const e = epic({
      plannedEndMs: Date.parse("2026-05-01"), // PI 2 (index 1)
      features: [{ status: "in_progress", piEndMs: Date.parse("2026-11-01"), completedAtMs: null }], // PI 4 (index 3)
    });
    expect(epicTerminabweichungPis(e, pis)).toBe(2);
  });
  it("0 wenn Plan-Ende oder Ist-Ende fehlt", () => {
    expect(epicTerminabweichungPis(epic({ plannedEndMs: null }), pis)).toBe(0);
    expect(
      epicTerminabweichungPis(epic({ plannedEndMs: Date.parse("2026-05-01"), features: [] }), pis),
    ).toBe(0);
  });
  it("nutzt completedAt statt PI-Ende, wenn alle Features fertig", () => {
    const e = epic({
      plannedEndMs: Date.parse("2026-02-01"), // PI 1 (index 0)
      features: [
        {
          status: "completed",
          piEndMs: Date.parse("2026-06-30"),
          completedAtMs: Date.parse("2026-08-15"),
        }, // PI 3
      ],
    });
    expect(epicTerminabweichungPis(e, pis)).toBe(2);
  });
});

describe("epicFeatureCounts — Plantreue/Performance-Zähler", () => {
  const asOf = Date.parse("2026-09-30"); // Ende PI 3
  const base: LpmEpicInput = {
    id: "e",
    title: "E",
    valueStreamId: "vs",
    valueStreamName: "VS",
    kpis: [],
    plannedEndMs: null,
    features: [
      // termingerecht (Plan PI1 Ende, geliefert davor)
      {
        status: "completed",
        piEndMs: Date.parse("2026-03-31"),
        completedAtMs: Date.parse("2026-03-01"),
      },
      // verspätet geliefert (Plan PI2 Ende, geliefert PI3)
      {
        status: "completed",
        piEndMs: Date.parse("2026-06-30"),
        completedAtMs: Date.parse("2026-08-01"),
      },
      // geplant bis Stichtag, offen
      { status: "in_progress", piEndMs: Date.parse("2026-09-30"), completedAtMs: null },
      // erst nach Stichtag geplant (zählt nicht)
      { status: "in_progress", piEndMs: Date.parse("2026-12-31"), completedAtMs: null },
    ],
  };
  it("plannedToDate zählt Features mit PI-Ende ≤ Stichtag", () => {
    expect(epicFeatureCounts(base, asOf).plannedToDate).toBe(3);
  });
  it("onTime nur termingerecht gelieferte (completedAt ≤ Plan-PI-Ende)", () => {
    expect(epicFeatureCounts(base, asOf).onTime).toBe(1);
  });
  it("doneToDate zählt alle bis Stichtag gelieferten", () => {
    expect(epicFeatureCounts(base, asOf).doneToDate).toBe(2);
  });
});

describe("computeLpmReview — Aggregation + Wasserfall + Burn-up", () => {
  const asOfMs = Date.parse("2026-09-30");
  const mkEpic = (
    id: string,
    vs: string,
    plannedEndMs: number,
    feat: LpmEpicInput["features"],
  ): LpmEpicInput => ({
    id,
    title: id,
    valueStreamId: vs,
    valueStreamName: vs,
    kpis: [kpi({ measurements: [{ atMs: Date.parse("2026-08-01"), value: 50 }] })], // 100k plan, 50% real
    features: feat,
    plannedEndMs,
  });

  const epics: LpmEpicInput[] = [
    // pünktlich (kein Verzug) → Forecast = Plan
    mkEpic("A", "VS-1", Date.parse("2026-06-30"), [
      {
        status: "completed",
        piEndMs: Date.parse("2026-03-31"),
        completedAtMs: Date.parse("2026-03-01"),
      },
    ]),
    // verspätet (+2 PI) → Forecast reduziert
    mkEpic("B", "VS-2", Date.parse("2026-03-31"), [
      { status: "in_progress", piEndMs: Date.parse("2026-09-30"), completedAtMs: null },
    ]),
  ];

  const model = computeLpmReview({ epics, pis, config: { asOfMs } });

  it("Portfolio-Benefit Plan = Σ Epic-Plan", () => {
    expect(model.portfolio.benefitPlan).toBe(200_000);
  });

  it("Forecast < Plan bei Verzug; Delta negativ", () => {
    // A: 100k×1.0 = 100k; B: +2PI → Faktor 0.8 → 80k. Σ = 180k.
    expect(model.portfolio.benefitForecast).toBeCloseTo(180_000);
    expect(model.portfolio.benefitDelta).toBeCloseTo(-20_000);
    expect(model.portfolio.benefitDeltaRatio).toBeCloseTo(-0.1);
  });

  it("Wasserfall: Start Plan, ein Verlustbalken (VS-2), Ende Forecast", () => {
    expect(model.waterfall[0]).toEqual({ kind: "start", label: "Benefit Plan", value: 200_000 });
    const losses = model.waterfall.filter((s) => s.kind === "loss");
    expect(losses).toHaveLength(1);
    expect(losses[0]!.value).toBeCloseTo(-20_000);
    expect(model.waterfall[model.waterfall.length - 1]).toEqual({
      kind: "end",
      label: "Benefit Forecast",
      value: model.portfolio.benefitForecast,
    });
  });

  it("Value Streams nach Benefit sortiert, je mit Ampel", () => {
    expect(model.valueStreams.map((v) => v.id)).toEqual(["VS-1", "VS-2"]);
    expect(model.valueStreams.every((v) => ["green", "amber", "rose"].includes(v.ampel))).toBe(
      true,
    );
  });

  it("Burn-up: ein Punkt je PI; realizedCum null nach Stichtag; Plan monoton steigend", () => {
    expect(model.burnup).toHaveLength(4);
    expect(model.burnup[3]!.realizedCum).toBeNull(); // PI 4 > Stichtag (PI 3)
    expect(model.burnup[2]!.realizedCum).not.toBeNull();
    const plan = model.burnup.map((p) => p.plannedCum);
    expect(plan[3]).toBeGreaterThanOrEqual(plan[0]!);
    // Forecast-Tail ab Stichtag gesetzt.
    expect(model.burnup[3]!.forecastCum).not.toBeNull();
  });

  it("Epic-Zeilen tragen Entscheidung + Ampel", () => {
    const b = model.epics.find((r) => r.id === "B")!;
    expect(b.terminabweichungPis).toBe(2);
    expect(["Pivot / Stop?", "Scope prüfen", "Keine"]).toContain(b.entscheidung);
  });

  it("Epic ohne Liefer-Signal → neutral (nicht rot), zählt nicht als kritisch", () => {
    const noFeatures: LpmEpicInput = {
      id: "N",
      title: "N",
      valueStreamId: "VS-3",
      valueStreamName: "VS-3",
      kpis: [kpi()],
      features: [],
      plannedEndMs: null,
    };
    const m = computeLpmReview({ epics: [noFeatures], pis, config: { asOfMs } });
    expect(m.epics[0]!.ampel).toBe("neutral");
    expect(m.epics[0]!.entscheidung).toBe("Keine");
    expect(m.portfolio.ampel).toBe("neutral");
    expect(m.portfolio.epicsCritical).toBe(0);
  });
});
