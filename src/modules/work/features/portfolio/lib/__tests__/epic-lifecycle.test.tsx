import { describe, it, expect } from "vitest";
import {
  epicLifecycleSteps,
  lifecycleSpans,
  runningStepIndex,
  processColumn,
  LIFECYCLE_STEPS,
  type EpicLifecycleInput,
} from "@/modules/work/features/portfolio/lib/epic-lifecycle";
import { TIMELINE_ESTIMATE_PHASES } from "@/modules/work/domain/timeline";
import { STAGE_SHORT } from "@/components/detail/initiative-labels";

/**
 * Acht Prozessabschnitte, acht Tore. Der Abschnitt sagt, woran gearbeitet wird;
 * das Tor am Ende, was erreicht ist, wenn das Epic die Schwelle überschreitet.
 *
 * Vorher waren es neun gleichartige Schritte, zwei davon zwei Namen für dasselbe
 * Tor — und ein frisch angelegtes Epic zeigte einen Haken auf „L1 Detailing",
 * obwohl es im Funnel stand.
 */
function input(over: Partial<EpicLifecycleInput> = {}): EpicLifecycleInput {
  return {
    stageGate: "L0",
    subStage: null,
    impactRecognizedAt: null,
    selectedForDetailingAt: null,
    ...over,
  };
}

/** Schlüssel des laufenden Abschnitts, oder null. */
const running = (over: Partial<EpicLifecycleInput> = {}): string | null =>
  epicLifecycleSteps(input(over)).find((s) => s.status === "current")?.key ?? null;

/** Schlüssel aller erledigten Abschnitte. */
const done = (over: Partial<EpicLifecycleInput> = {}): string[] =>
  epicLifecycleSteps(input(over))
    .filter((s) => s.status === "done")
    .map((s) => s.key);

const D = (s: string) => new Date(s + "T00:00:00Z");

describe("LIFECYCLE_STEPS — Aufbau", () => {
  it("hat acht Abschnitte mit je einem Tor", () => {
    expect(LIFECYCLE_STEPS).toHaveLength(8);
    for (const s of LIFECYCLE_STEPS) {
      expect(s.label.length).toBeGreaterThan(0);
      expect(s.description.length).toBeGreaterThan(0);
      expect(s.milestone.label.length).toBeGreaterThan(0);
    }
  });

  it("nennt an jedem Tor, wer zeichnet", () => {
    // „VMO" ist drei Zeichen kurz — gefragt ist, dass jemand benannt **ist**.
    for (const s of LIFECYCLE_STEPS) expect(s.milestone.approver.trim()).not.toBe("");
  });

  it("hat genau ein Tor ohne Reifegrad-Wechsel", () => {
    // Die Erstsichtung — sie wird durch die Benennung des Owners erreicht, nicht
    // durch Antrag und Abnahme.
    const soft = LIFECYCLE_STEPS.filter((s) => s.milestone.step === null);
    expect(soft.map((s) => s.milestone.label)).toEqual(["Erstsichtung"]);
  });

  it("deckt sich Schlüssel für Schlüssel mit den Schätzfeldern", () => {
    // Das ist die Zusicherung, die die Datenwanderung überflüssig macht: acht
    // Abschnitte, acht Felder, dieselben Namen.
    expect(LIFECYCLE_STEPS.map((s) => s.key)).toEqual([...TIMELINE_ESTIMATE_PHASES]);
  });

  it("gibt jedem Reifegrad eines Abschnitts ein Kurzlabel", () => {
    for (const s of LIFECYCLE_STEPS) expect(STAGE_SHORT[s.gate]).toBeTruthy();
  });
});

describe("epicLifecycleSteps — welcher Abschnitt läuft", () => {
  it("L0 ohne Erstsichtung: das Epic wartet im Funnel", () => {
    expect(done()).toEqual([]);
    expect(running()).toBe("detailing");
  });

  it("L0 mit Erstsichtung: die Hypothese ist dran, ohne Reifegrad-Wechsel", () => {
    // Der Owner ist benannt — das Epic steht weiterhin auf L0.
    const over = { selectedForDetailingAt: D("2026-09-06") };
    expect(done(over)).toEqual(["detailing"]);
    expect(running(over)).toBe("hypothesis");
  });

  it("L1: die Analyse-Einplanung läuft", () => {
    expect(running({ stageGate: "L1" })).toBe("analyzing");
    expect(done({ stageGate: "L1" })).toEqual(["detailing", "hypothesis"]);
  });

  it("L2: der Business Case wird ausgearbeitet", () => {
    expect(running({ stageGate: "L2" })).toBe("business_case");
  });

  it("L3.1: das Budget wird zugeteilt", () => {
    expect(running({ stageGate: "L3", subStage: "L3.1" })).toBe("backlog");
  });

  it("L3.2: die Umsetzung wird gestartet", () => {
    expect(running({ stageGate: "L3", subStage: "L3.2" })).toBe("implementation_started");
  });

  it("L4.1: es wird umgesetzt", () => {
    expect(running({ stageGate: "L4", subStage: "L4.1" })).toBe("implementation");
  });

  it("L4.2: der Nutzen wird gemessen", () => {
    expect(running({ stageGate: "L4", subStage: "L4.2" })).toBe("done");
  });

  it("L5: nichts läuft mehr, alles erreicht", () => {
    const steps = epicLifecycleSteps(input({ stageGate: "L5" }));
    expect(steps.every((s) => s.status === "done" && s.milestoneStatus === "done")).toBe(true);
    expect(running({ stageGate: "L5" })).toBeNull();
  });

  it("bestätigter Impact schliesst kurz, egal bei welchem Reifegrad", () => {
    // Sonst entstuende ein Zwischenzustand, den es nicht geben kann.
    const over = { stageGate: "L4" as const, impactRecognizedAt: D("2027-01-15") };
    expect(done(over)).toHaveLength(8);
    expect(running(over)).toBeNull();
  });

  it("Abschnitt und sein Tor tragen denselben Zustand", () => {
    // Ein Abschnitt ist genau dann erledigt, wenn sein Tor erreicht ist.
    for (const g of ["L0", "L1", "L2", "L3", "L4"] as const) {
      for (const s of epicLifecycleSteps(input({ stageGate: g }))) {
        expect(s.milestoneStatus).toBe(s.status);
      }
    }
  });
});

describe("runningStepIndex", () => {
  it("zeigt auf den laufenden Abschnitt", () => {
    expect(runningStepIndex(input())).toBe(0);
    expect(runningStepIndex(input({ stageGate: "L2" }))).toBe(3);
  });

  it("ist null, wenn alles erreicht ist", () => {
    expect(runningStepIndex(input({ stageGate: "L5" }))).toBeNull();
  });
});

describe("lifecycleSpans — Dauern ohne ein neues Feld", () => {
  const created = D("2026-06-05");
  const now = D("2026-09-05");

  it("beginnt den ersten Abschnitt beim Anlegen", () => {
    const spans = lifecycleSpans({
      createdAt: created,
      gateActuals: [D("2026-06-12"), null, null, null, null, null, null, null],
      runningIndex: 1,
      now,
    });
    expect(spans[0]!.from).toEqual(created);
    expect(spans[0]!.days).toBe(7);
  });

  it("beginnt jeden weiteren Abschnitt am vorigen Tor", () => {
    const spans = lifecycleSpans({
      createdAt: created,
      gateActuals: [D("2026-06-12"), D("2026-07-03"), null, null, null, null, null, null],
      runningIndex: 2,
      now,
    });
    expect(spans[1]!.from).toEqual(D("2026-06-12"));
    expect(spans[1]!.days).toBe(21);
  });

  it("laesst den laufenden Abschnitt bis heute zaehlen", () => {
    const spans = lifecycleSpans({
      createdAt: created,
      gateActuals: [D("2026-06-12"), null, null, null, null, null, null, null],
      runningIndex: 1,
      now,
    });
    expect(spans[1]!.running).toBe(true);
    expect(spans[1]!.to).toBeNull(); // das Tor ist offen
    expect(spans[1]!.days).toBe(85); // 12.6. → 5.9.
  });

  it("laesst die Dauer entfallen, wenn ein Ist fehlt", () => {
    // Lieber keine Zahl als eine erfundene: ohne das Tor davor gibt es keinen
    // ehrlichen Anfang.
    const spans = lifecycleSpans({
      createdAt: created,
      gateActuals: [null, D("2026-07-03"), null, null, null, null, null, null],
      runningIndex: 2,
      now,
    });
    expect(spans[1]!.from).toBeNull();
    expect(spans[1]!.days).toBeNull();
  });

  it("gibt kuenftigen Abschnitten weder Dauer noch Lauf", () => {
    const spans = lifecycleSpans({
      createdAt: created,
      gateActuals: [D("2026-06-12"), null, null, null, null, null, null, null],
      runningIndex: 1,
      now,
    });
    expect(spans[5]!.days).toBeNull();
    expect(spans[5]!.running).toBe(false);
  });

  it("liefert je Abschnitt einen Eintrag", () => {
    const spans = lifecycleSpans({
      createdAt: created,
      gateActuals: LIFECYCLE_STEPS.map(() => null),
      runningIndex: 0,
      now,
    });
    expect(spans).toHaveLength(LIFECYCLE_STEPS.length);
  });
});

describe("processColumn — das Kanban zeigt den Prozess", () => {
  const at = (d: string | null) => ({ selectedForDetailingAt: d ? D(d) : null });

  it("laesst ein ungesichtetes Epic im Funnel", () => {
    expect(processColumn({ stageGate: "L0", ...at(null) })).toBe("L0");
  });

  it("rueckt ein gesichtetes Epic in die Hypothese-Spalte", () => {
    // Der Reifegrad bleibt L0 — gearbeitet wird aber schon an der Hypothese,
    // und genau das soll die Spalte zeigen.
    expect(processColumn({ stageGate: "L0", ...at("2026-09-06") })).toBe("L1");
  });

  it("laesst alle uebrigen Reifegrade unveraendert", () => {
    for (const g of ["L1", "L2", "L3", "L4", "L5"]) {
      expect(processColumn({ stageGate: g, ...at(null) })).toBe(g);
      expect(processColumn({ stageGate: g, ...at("2026-09-06") })).toBe(g);
    }
  });
});
