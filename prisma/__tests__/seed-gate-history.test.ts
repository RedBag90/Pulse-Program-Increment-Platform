import { describe, it, expect } from "vitest";
import {
  addDays,
  assertGateHistory,
  buildGateHistory,
  gateRuleRows,
  stepsUpTo,
  straightPath,
  type GateHistoryInput,
  type GateMove,
} from "../seed-gate-history";

/**
 * Die Seeds leiten ihre Reifegrad-Historie aus der Domänenlogik der App ab.
 * Diese Tests halten fest, dass die Faltung dabei dasselbe herausbekommt, was
 * die App zur Laufzeit schriebe — sonst erzählen die Demo-Mandanten wieder eine
 * Geschichte, die das Produkt so nicht führt.
 */
const NOW = new Date("2026-08-30T00:00:00.000Z");
const d = (daysAgo: number): Date => addDays(NOW, -daysAgo);

const base = (over: Partial<GateHistoryInput> = {}): GateHistoryInput => ({
  tenantId: "t",
  epicId: "e",
  makeId: (sfx) => `test-${sfx}`,
  requestedBy: "owner",
  createdBy: "admin",
  ownerId: "owner",
  valueStreamId: "vs",
  valueStreamVmoId: "vmo",
  valueStreamFinanceApproverId: "fin",
  rules: gateRuleRows(null),
  parties: { architect: "pm", businessOwner: "bo", irtOwner: "rte" },
  benefitHypothesis: { measuresHypothesis: "x" },
  businessCase: { costSlices: [] },
  timeline: { estimates: {}, actuals: {} },
  childFeatureStats: { total: 2, started: 2, completed: 2 },
  budgetAllocationSum: 50_000,
  moves: [],
  ...over,
});

const plain = (target: Parameters<typeof stepsUpTo>[0]): GateMove[] =>
  straightPath(target, (s) => d(200 - stepsUpTo("L5").indexOf(s) * 25));

describe("stepsUpTo", () => {
  it("zählt die Schritte von L0 bis zum Ziel auf", () => {
    expect(stepsUpTo("L0")).toEqual([]);
    expect(stepsUpTo("L2")).toEqual(["L1", "analysis", "L2"]);
    expect(stepsUpTo("L5")).toEqual(["L1", "analysis", "L2", "L3", "L4", "L4.2", "L5"]);
  });
});

describe("buildGateHistory — der glatte Weg", () => {
  it("legt je gegangenem Schritt genau einen abgenommenen Antrag an", () => {
    const r = buildGateHistory(base({ moves: plain("L5") }));
    expect(r.transitions).toHaveLength(7);
    expect(r.transitions.every((t) => t.kind === "forward" && t.status === "approved")).toBe(true);
    expect(r.transitions.map((t) => `${t.fromGate}→${t.toGate}`)).toEqual([
      "L0→L1",
      "L1→analysis",
      "analysis→L2",
      "L2→L3",
      "L3→L4",
      "L4→L4.2",
      "L4.2→L5",
    ]);
  });

  it("setzt die Stempel, die die App an diesen Schritten setzt", () => {
    const r = buildGateHistory(base({ moves: plain("L5") }));
    expect(r.finalStep).toBe("L5");
    expect(r.stamps.stageGate).toBe("L5");
    for (const f of [
      "selectedForDetailingAt",
      "hypothesisApprovedAt",
      "selectedForAnalyzingAt",
      "businessCaseApprovedAt",
      "approvedAt",
      "implementationStartedAt",
      "implementationCompletedAt",
      "impactRecognizedAt",
    ] as const) {
      expect(r.stamps[f], f).toBeInstanceOf(Date);
    }
  });

  it("zieht die Baselines an L1 und L2", () => {
    // Bis zur Analyse-Entscheidung gibt es nur die Hypothese-Baseline; die des
    // Business Case entsteht mit seiner Freigabe (L2).
    const bisAnalyse = buildGateHistory(base({ moves: plain("analysis") }));
    expect(bisAnalyse.stamps.baselineBenefitHypothesis).toBeTruthy();
    expect(bisAnalyse.stamps.baselineBusinessCase).toBeUndefined();

    const bisL2 = buildGateHistory(base({ moves: plain("L2") }));
    expect(bisL2.stamps.baselineBusinessCase).toBeTruthy();
  });

  it("spiegelt das L4.2-Ist-Datum in die Timeline", () => {
    const r = buildGateHistory(base({ moves: plain("L4.2") }));
    const actuals = (r.stamps.timeline as { actuals?: Record<string, string> }).actuals ?? {};
    expect(actuals.implementation).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("trennt die Business-Case-Freigabe von der Investitionsentscheidung", () => {
    // Sie sind seit dem Neuschnitt zwei Reifegrade, kein Stempel-Unterschied
    // innerhalb eines Grades mehr.
    const bc = buildGateHistory(base({ moves: plain("L2") }));
    expect(bc.finalStep).toBe("L2");
    expect(bc.stamps.stageGate).toBe("L2");
    expect(bc.stamps.approvedAt).toBeUndefined();

    const geld = buildGateHistory(base({ moves: plain("L3") }));
    expect(geld.finalStep).toBe("L3");
    expect(geld.stamps.stageGate).toBe("L3");
    expect(geld.stamps.approvedAt).toBeInstanceOf(Date);
  });

  it("hängt an jeden Antrag den Kriterien-Schnappschuss", () => {
    const r = buildGateHistory(base({ moves: plain("L2") }));
    const keys = (r.transitions[0]!.readiness as { key: string }[]).map((c) => c.key);
    expect(keys).toEqual(["hypothesis_drafted", "owner_nominated"]);
  });
});

describe("buildGateHistory — das Epic ohne Weg", () => {
  it("spricht den Reifegrad auch dann aus, wenn nichts passiert ist", () => {
    const r = buildGateHistory(base({ moves: [] }));
    expect(r.finalStep).toBe("L0");
    expect(r.stamps.stageGate).toBe("L0");
    expect(r.transitions).toHaveLength(0);
  });
});

describe("buildGateHistory — die Abnehmer", () => {
  it("besetzt L2 mit den fünf Parteien und L3 mit VMO und Finance", () => {
    const r = buildGateHistory(base({ moves: plain("L3") }));
    const rolesOf = (i: number) =>
      r.approvals.filter((a) => a.transitionId === r.transitions[i]!.id).map((a) => a.role);
    expect(rolesOf(2)).toEqual([
      "epic.party.architect",
      "epic.party.business_owner",
      "epic.party.irt_owner",
      "epic.party.finance",
      "epic.party.lace_vmo",
    ]);
    expect(rolesOf(3)).toEqual(["value_stream.vmo", "value_stream.finance_approver"]);
  });

  it("lässt den Business Owner weg, wenn der Sitz unbesetzt ist", () => {
    const r = buildGateHistory(
      base({
        parties: { architect: "pm", businessOwner: null, irtOwner: "rte" },
        moves: plain("L2"),
      }),
    );
    const roles = r.approvals
      .filter((a) => a.transitionId === r.transitions[2]!.id)
      .map((a) => a.role);
    expect(roles).not.toContain("epic.party.business_owner");
    expect(roles).toHaveLength(4);
  });

  it("dedupliziert dieselbe Person — der Unique-Index lässt sie nur einmal zu", () => {
    // VMO und Finance-Approver sind derselbe Mensch: L3 braucht dann eine Zeile.
    const r = buildGateHistory(base({ valueStreamFinanceApproverId: "vmo", moves: plain("L3") }));
    const rows = r.approvals.filter((a) => a.transitionId === r.transitions[3]!.id);
    expect(rows).toHaveLength(1);
  });
});

describe("buildGateHistory — die unbequemen Zustände", () => {
  it("eine Ablehnung lässt das Epic stehen und setzt keinen Stempel", () => {
    const r = buildGateHistory(
      base({
        moves: [
          ...plain("analysis"),
          {
            kind: "rejected",
            to: "L2",
            requestedAt: d(50),
            decidedAt: d(45),
            reason: "Kosten unvollständig.",
          },
        ],
      }),
    );
    expect(r.finalStep).toBe("analysis");
    expect(r.stamps.businessCaseApprovedAt).toBeUndefined();
    const rejected = r.transitions.at(-1)!;
    expect(rejected.status).toBe("rejected");
    expect(rejected.reason).toBe("Kosten unvollständig.");
    const rows = r.approvals.filter((a) => a.transitionId === rejected.id);
    expect(rows.filter((a) => a.status === "rejected")).toHaveLength(1);
  });

  it("eine Rückstufung räumt den Stempel ab — der zweite Anlauf setzt ihn neu", () => {
    const r = buildGateHistory(
      base({
        moves: [
          ...plain("L2"),
          { kind: "revert", to: "analysis", at: d(60), reason: "Nutzenrechnung trägt nicht." },
          { kind: "advance", to: "L2", requestedAt: d(30), decidedAt: d(25) },
        ],
      }),
    );
    expect(r.finalStep).toBe("L2");
    // Der Stempel steht wieder — und trägt das Datum des ZWEITEN Laufs.
    expect(r.stamps.businessCaseApprovedAt).toEqual(d(25));
    const revert = r.transitions.find((t) => t.kind === "revert")!;
    expect(revert.status).toBe("approved");
    expect(revert.reason).toBeTruthy();
    // Eine Korrektur trägt keine Abnahmen.
    expect(r.approvals.filter((a) => a.transitionId === revert.id)).toHaveLength(0);
  });

  it("ein offener Antrag bleibt der einzige und stempelt nichts", () => {
    const r = buildGateHistory(
      base({
        moves: [
          ...plain("analysis"),
          {
            kind: "open",
            to: "L2",
            requestedAt: d(20),
            decidedRoles: ["epic.party.architect", "epic.party.finance"],
            decidedAt: d(15),
          },
        ],
      }),
    );
    expect(r.transitions.filter((t) => t.status === "pending")).toHaveLength(1);
    const open = r.transitions.at(-1)!;
    expect(open.fromGate).toBe(r.finalStep);
    expect(open.resolvedAt).toBeNull();
    expect(r.stamps.businessCaseApprovedAt).toBeUndefined();
    const rows = r.approvals.filter((a) => a.transitionId === open.id);
    expect(rows.filter((a) => a.status === "approved")).toHaveLength(2);
    expect(rows.filter((a) => a.status === "pending")).toHaveLength(3);
  });

  it("ein zurückgezogener Antrag lässt alle Abnahmen offen", () => {
    const r = buildGateHistory(
      base({
        moves: [
          ...plain("L1"),
          { kind: "withdrawn", to: "L2", requestedAt: d(40), decidedAt: d(38) },
        ],
      }),
    );
    expect(r.finalStep).toBe("L1");
    const wd = r.transitions.at(-1)!;
    expect(wd.status).toBe("withdrawn");
    expect(wd.resolvedAt).toEqual(d(38));
    expect(
      r.approvals.filter((a) => a.transitionId === wd.id).every((a) => a.status === "pending"),
    ).toBe(true);
  });
});

describe("buildGateHistory — Ids", () => {
  it("holt jede Id beim Aufrufer — die Spalten sind @db.Uuid", () => {
    const seen: string[] = [];
    const r = buildGateHistory(
      base({
        makeId: (sfx) => {
          seen.push(sfx);
          return `id-${sfx}`;
        },
        moves: plain("L2"),
      }),
    );
    expect(r.transitions.map((t) => t.id)).toEqual(["id-0", "id-1", "id-2"]);
    // Antrags- und Abnahme-Suffixe kollidieren nicht.
    expect(new Set(seen).size).toBe(seen.length);
    expect(new Set(r.approvals.map((a) => a.id)).size).toBe(r.approvals.length);
  });
});

describe("assertGateHistory", () => {
  it("lässt eine saubere Historie durch", () => {
    const r = buildGateHistory(base({ moves: plain("L5") }));
    expect(() => assertGateHistory(r, "ok", NOW)).not.toThrow();
  });

  it("schlägt an, wenn zwei Anträge offen sind", () => {
    const r = buildGateHistory(
      base({
        moves: [
          ...plain("L2"),
          { kind: "open", to: "L2", requestedAt: d(30) },
          { kind: "open", to: "L2", requestedAt: d(20) },
        ],
      }),
    );
    expect(() => assertGateHistory(r, "zwei offen", NOW)).toThrow(/offene Anträge/);
  });

  it("schlägt an, wenn der offene Antrag nicht vom aktuellen Schritt ausgeht", () => {
    const r = buildGateHistory(base({ moves: plain("L2") }));
    // Von Hand verbogen: genau der Fall, den der Demo-Seed vorher erzeugt hat.
    r.transitions.push({ ...r.transitions[0]!, id: "x", status: "pending", fromGate: "L4" });
    expect(() => assertGateHistory(r, "falsches fromGate", NOW)).toThrow(/nicht entscheidbar/);
  });

  it("schlägt an, wenn ein Antrag in der Zukunft liegt", () => {
    const r = buildGateHistory(
      base({
        moves: [...plain("L2"), { kind: "open", to: "L2", requestedAt: addDays(NOW, 5) }],
      }),
    );
    expect(() => assertGateHistory(r, "Zukunft", NOW)).toThrow(/Zukunft/);
  });

  it("schlägt an, wenn eine Person denselben Antrag zweimal abnimmt", () => {
    const r = buildGateHistory(base({ moves: plain("L1") }));
    r.approvals.push({ ...r.approvals[0]!, id: "dup" });
    expect(() => assertGateHistory(r, "doppelt", NOW)).toThrow(/zweimal ab/);
  });
});
