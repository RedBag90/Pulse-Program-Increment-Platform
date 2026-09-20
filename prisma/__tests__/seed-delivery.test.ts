import { describe, it, expect } from "vitest";
import {
  JOB_SIZE_SCALE,
  PLACEHOLDER_JOB_SIZE,
  assertJobSizes,
  assertPiQuotas,
  deliveryPis,
  jobSizeFor,
  piQuotas,
  planFeature,
  type DeliveredFeature,
  type DeliveryPi,
} from "../seed-delivery";
import { deriveJobSizeRate } from "@/modules/budgeting/domain/art-throughput";

/**
 * **Die Lieferseite, geprüft ohne Datenbank.**
 *
 * Dieselbe Bauart wie `seed-large-rounds.test.ts`: die Regel ist rein, also
 * lässt sich hier feststellen, was am fertigen Mandanten nur mit Mühe zu sehen
 * wäre — und vor allem **bevor** ein Seed-Lauf die Datenbank anfasst.
 *
 * Die drei Befunde, die diese Tests festhalten, stammen aus einer Messung am
 * Bestand: die Hälfte aller Job Sizes war über das Produkt nicht erzeugbar,
 * sechs von zehn abgeschlossenen PIs waren leer, und die übrigen lieferten
 * exakt 100 %.
 */

const D = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);

/** Zehn PIs à 70 Tage, acht davon abgeschlossen — wie im Large-Seed. */
const PIS: (DeliveryPi & { name: string })[] = Array.from({ length: 10 }, (_, k) => {
  const start = new Date(D("2024-06-01").getTime() + k * 70 * 86_400_000);
  return {
    id: `pi${k + 1}`,
    name: `PI ${k + 1}`,
    start,
    end: new Date(start.getTime() + 69 * 86_400_000),
    status: k < 8 ? ("completed" as const) : k === 8 ? ("active" as const) : ("planned" as const),
  };
});
const COMPLETED = PIS.filter((p) => p.status === "completed");
/** „Jetzt" liegt zwei Drittel im laufenden PI — so, wie ein Seed läuft. */
const NOW = new Date(PIS[8]!.start.getTime() + 45 * 86_400_000);
const ACTIVE = PIS.find((p) => p.status === "active")!;
const PLANNED = PIS.filter((p) => p.status === "planned");

describe("jobSizeFor", () => {
  it("liefert ausschliesslich Fibonacci-Werte", () => {
    const erlaubt = new Set<number>(JOB_SIZE_SCALE);
    const werte = new Set<number>();
    for (let i = 0; i < 200; i++) for (let f = 0; f < 6; f++) werte.add(jobSizeFor(i, f));
    expect([...werte].filter((w) => !erlaubt.has(w))).toEqual([]);
  });

  it("der Platzhalter 3 bleibt selten — er ist ein Vorbehalt, keine Schätzung", () => {
    let platzhalter = 0;
    let gesamt = 0;
    for (let i = 0; i < 200; i++)
      for (let f = 0; f < 6; f++) {
        gesamt++;
        if (jobSizeFor(i, f) === PLACEHOLDER_JOB_SIZE) platzhalter++;
      }
    const anteil = platzhalter / gesamt;
    expect(anteil).toBeGreaterThan(0.03);
    expect(anteil).toBeLessThan(0.15);
  });

  it("ist deterministisch — ein zweiter Lauf ergibt denselben Mandanten", () => {
    expect(jobSizeFor(7, 2)).toBe(jobSizeFor(7, 2));
  });
});

describe("deliveryPis", () => {
  it("nimmt die abgeschlossenen PIs, die das Umsetzungsfenster beruehren", () => {
    const treffer = deliveryPis(COMPLETED, PIS[2]!.start, PIS[4]!.end);
    expect(treffer.map((p) => p.id)).toEqual(["pi3", "pi4", "pi5"]);
  });

  it("ohne Umsetzungsfenster gilt das juengste abgeschlossene PI", () => {
    expect(deliveryPis(COMPLETED, null, null).map((p) => p.id)).toEqual(["pi8"]);
  });

  it("beruehrt das Fenster keines PI, faellt es ebenfalls auf das juengste", () => {
    const treffer = deliveryPis(COMPLETED, D("2019-01-01"), D("2019-06-01"));
    expect(treffer.map((p) => p.id)).toEqual(["pi8"]);
  });
});

describe("planFeature", () => {
  const basis = {
    completedPis: COMPLETED,
    activePi: ACTIVE,
    plannedPis: PLANNED,
    now: NOW,
  };

  it("L2 ist geschnitten, aber nicht eingeplant", () => {
    const p = planFeature({
      ...basis,
      epicIdx: 1,
      featureIdx: 0,
      gate: "L2",
      implStart: null,
      implDone: null,
    });
    expect(p).toEqual({ status: "approved", pi: null, completedAt: null });
  });

  it("L3 steht im naechsten PI — finanziert, noch nicht gearbeitet", () => {
    const p = planFeature({
      ...basis,
      epicIdx: 1,
      featureIdx: 0,
      gate: "L3",
      implStart: null,
      implDone: null,
    });
    expect(p.status).toBe("approved");
    expect(PLANNED.map((x) => x.id)).toContain(p.pi?.id);
  });

  it("L5 liefert vollstaendig — alles andere widerspraeche der Reifegrad-Historie", () => {
    for (let f = 0; f < 5; f++) {
      const p = planFeature({
        ...basis,
        epicIdx: 3,
        featureIdx: f,
        gate: "L5",
        implStart: PIS[2]!.start,
        implDone: PIS[4]!.end,
      });
      expect(p.status).toBe("completed");
      expect(p.completedAt).not.toBeNull();
    }
  });

  it("das Abschlussdatum liegt im Fenster seines PI", () => {
    for (let i = 0; i < 40; i++) {
      const p = planFeature({
        ...basis,
        epicIdx: i,
        featureIdx: 0,
        gate: "L5",
        implStart: PIS[1]!.start,
        implDone: PIS[6]!.end,
      });
      expect(p.pi).not.toBeNull();
      expect(p.completedAt!.getTime()).toBeGreaterThanOrEqual(p.pi!.start.getTime());
      expect(p.completedAt!.getTime()).toBeLessThanOrEqual(p.pi!.end.getTime());
    }
  });

  it("L4 mischt: geliefert, Uebertrag, laufend — nicht alles auf einmal", () => {
    const lagen = new Set<string>();
    for (let f = 0; f < 10; f++) {
      const p = planFeature({
        ...basis,
        epicIdx: 2,
        featureIdx: f,
        gate: "L4",
        implStart: PIS[3]!.start,
        implDone: null,
      });
      lagen.add(`${p.status}:${p.pi?.status ?? "kein"}`);
    }
    // Der Uebertrag ist die Lage, die im Bestand fehlte: offen in einem
    // abgeschlossenen PI.
    expect([...lagen]).toContain("in_progress:completed");
    expect([...lagen]).toContain("completed:completed");
    expect([...lagen]).toContain("in_progress:active");
    // Die Lage, die im Bestand fehlte: im laufenden PI bereits geliefert.
    expect([...lagen]).toContain("completed:active");
  });

  it("kein Abschlussdatum liegt in der Zukunft", () => {
    for (let i = 0; i < 60; i++)
      for (let f = 0; f < 6; f++) {
        const p = planFeature({
          ...basis,
          epicIdx: i,
          featureIdx: f,
          gate: "L4",
          implStart: PIS[3]!.start,
          implDone: null,
        });
        if (p.completedAt) expect(p.completedAt.getTime()).toBeLessThanOrEqual(NOW.getTime());
      }
  });
});

/** Ein Mandant, wie ihn der Seed erzeugen würde — 60 Epics über 8 PIs. */
function mandant(): DeliveredFeature[] {
  const out: DeliveredFeature[] = [];
  const gates = ["L2", "L3", "L4", "L5", "L5", "L4"] as const;
  for (let i = 0; i < 60; i++) {
    const gate = gates[i % gates.length]!;
    // Umsetzung beginnt gestaffelt — so, wie der Rundenmotor die Epics reifen
    // lässt.
    const startPi = COMPLETED[i % COMPLETED.length]!;
    const count = 3 + (i % 4);
    for (let f = 0; f < count; f++) {
      const p = planFeature({
        completedPis: COMPLETED,
        activePi: ACTIVE,
        plannedPis: PLANNED,
        now: NOW,
        epicIdx: i,
        featureIdx: f,
        gate,
        implStart: gate === "L2" || gate === "L3" ? null : startPi.start,
        implDone: gate === "L5" ? startPi.end : null,
      });
      out.push({
        jobSize: jobSizeFor(i, f),
        status: p.status,
        piId: p.pi?.id ?? null,
        completedAt: p.completedAt,
      });
    }
  }
  return out;
}

describe("der erzeugte Mandant", () => {
  const features = mandant();
  const quoten = piQuotas(features, PIS);

  it("haelt die Job-Size-Invariante", () => {
    expect(() => assertJobSizes(features, "Test")).not.toThrow();
  });

  it("kein abgeschlossenes PI bleibt leer", () => {
    const leer = quoten.filter((q) => q.status === "completed" && q.geplant === 0);
    expect(leer.map((q) => q.name)).toEqual([]);
  });

  it("nicht jedes abgeschlossene PI liefert 100 %", () => {
    const abgeschlossen = quoten.filter((q) => q.status === "completed");
    expect(abgeschlossen.some((q) => q.quote < 1)).toBe(true);
  });

  it("und der laufende PI steht nicht bei 0 %", () => {
    // Er traegt offene Arbeit — geliefert wird dort erst am Ende. Entscheidend
    // ist, dass er ueberhaupt Inhalt hat.
    const aktiv = quoten.find((q) => q.status === "active")!;
    expect(aktiv.geplant).toBeGreaterThan(0);
  });

  it("die Invarianten laufen sauber durch", () => {
    expect(() => assertPiQuotas(quoten, "Test")).not.toThrow();
  });

  /**
   * **Der Korridor.** Der Satz entsteht aus dem Budget zweier Halbjahre geteilt
   * durch die darin gelieferten Punkte. Er ist hier nachgerechnet mit
   * `deriveJobSizeRate` selbst — nicht mit einer zweiten Formel, die vom
   * Produkt abdriften könnte.
   */
  it("liefert genug Punkte, damit der €-Satz belastbar wird", () => {
    // Die letzten zwei abgeschlossenen PIs ≈ ein Halbjahres-Fenster je ART.
    const jePi = new Map<string, number>();
    for (const f of features) {
      if (f.status !== "completed" || f.piId == null) continue;
      jePi.set(f.piId, (jePi.get(f.piId) ?? 0) + f.jobSize);
    }
    const letzte = COMPLETED.slice(-2);
    const punkte = letzte.reduce((s, p) => s + (jePi.get(p.id) ?? 0), 0);

    const rate = deriveJobSizeRate({
      cycles: letzte.map((p, i) => ({
        cycleKey: `2026-H${i + 1}`,
        budget: 240_000,
        jobSize: jePi.get(p.id) ?? 0,
        featureCount: 0,
        standaloneJobSize: 0,
        standaloneFeatureCount: 0,
      })),
      tenantDefault: null,
      undatedFeatures: 0,
      placeholderJobSize: 0,
    });

    expect(rate.source).toBe("empirical");
    expect(punkte).toBeGreaterThan(0);
    // Ein Mandant dieser Grösse liefert je PI zweistellige Punktzahlen — das
    // ist die Grundlage, auf der die Guardrail überhaupt rechnen kann.
    expect(rate.jobSizeSum).toBe(punkte);
  });
});

describe("die Invarianten schlagen an, wenn sie sollen", () => {
  it("Job Size ausserhalb Fibonacci wirft", () => {
    expect(() =>
      assertJobSizes([{ jobSize: 7, status: "completed", piId: "x", completedAt: null }], "Test"),
    ).toThrow(/ausserhalb Fibonacci/);
  });

  it("ueberwiegend leere PIs werfen", () => {
    const leer = (n: number) => ({
      piId: `pi${n}`,
      name: `PI ${n}`,
      status: "completed" as const,
      geplant: 0,
      fertig: 0,
      quote: 0,
    });
    expect(() =>
      assertPiQuotas(
        [
          leer(1),
          leer(2),
          leer(3),
          { piId: "pi4", name: "PI 4", status: "completed", geplant: 10, fertig: 8, quote: 0.8 },
        ],
        "Test",
      ),
    ).toThrow(/tragen ueberhaupt ein Feature/);
  });

  it("ein einzelnes leeres PI ist kein Fehler — ein Programm faengt irgendwann an", () => {
    expect(() =>
      assertPiQuotas(
        [
          { piId: "pi1", name: "PI 1", status: "completed", geplant: 0, fertig: 0, quote: 0 },
          { piId: "pi2", name: "PI 2", status: "completed", geplant: 10, fertig: 8, quote: 0.8 },
          { piId: "pi3", name: "PI 3", status: "completed", geplant: 20, fertig: 20, quote: 1 },
        ],
        "Test",
      ),
    ).not.toThrow();
  });

  it("lauter perfekte PIs werfen", () => {
    expect(() =>
      assertPiQuotas(
        [
          { piId: "pi1", name: "PI 1", status: "completed", geplant: 10, fertig: 10, quote: 1 },
          { piId: "pi2", name: "PI 2", status: "completed", geplant: 20, fertig: 20, quote: 1 },
        ],
        "Test",
      ),
    ).toThrow(/100 %/);
  });
});
