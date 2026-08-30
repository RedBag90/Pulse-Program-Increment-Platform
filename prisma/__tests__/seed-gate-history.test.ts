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
  parties: { mgmt: "pm", businessOwner: "bo", irtOwner: "rte" },
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
    expect(stepsUpTo("L2")).toEqual(["L1", "L2"]);
    expect(stepsUpTo("L5")).toEqual(["L1", "L2", "L3.1", "L3.2", "L4", "L4.2", "L5"]);
  });
});

describe("buildGateHistory — der glatte Weg", () => {
  it("legt je gegangenem Schritt genau einen abgenommenen Antrag an", () => {
    const r = buildGateHistory(base({ moves: plain("L5") }));
    expect(r.transitions).toHaveLength(7);
    expect(r.transitions.every((t) => t.kind === "forward" && t.status === "approved")).toBe(true);
    expect(r.transitions.map((t) => `${t.fromGate}→${t.toGate}`)).toEqual([
      "L0→L1",
      "L1→L2",
      "L2→L3.1",
      "L3.1→L3.2",
      "L3.2→L4",
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

  it("zieht die Baselines an L1 und L3.1", () => {
    const bis2 = buildGateHistory(base({ moves: plain("L2") }));
    expect(bis2.stamps.baselineBenefitHypothesis).toBeTruthy();
    expect(bis2.stamps.baselineBusinessCase).toBeUndefined();

    const bis31 = buildGateHistory(base({ moves: plain("L3.1") }));
    expect(bis31.stamps.baselineBusinessCase).toBeTruthy();
  });

  it("spiegelt das L4.2-Ist-Datum in die Timeline", () => {
    const r = buildGateHistory(base({ moves: plain("L4.2") }));
    const actuals = (r.stamps.timeline as { actuals?: Record<string, string> }).actuals ?? {};
    expect(actuals.implementation).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("unterscheidet L3.1 von L3.2 allein am Investitions-Stempel", () => {
    const l31 = buildGateHistory(base({ moves: plain("L3.1") }));
    expect(l31.finalStep).toBe("L3.1");
    expect(l31.stamps.stageGate).toBe("L3");
    expect(l31.stamps.approvedAt).toBeUndefined();

    const l32 = buildGateHistory(base({ moves: plain("L3.2") }));
    expect(l32.finalStep).toBe("L3.2");
    expect(l32.stamps.stageGate).toBe("L3");
    expect(l32.stamps.approvedAt).toBeInstanceOf(Date);
  });

  it("hängt an jeden Antrag den Kriterien-Schnappschuss", () => {
    const r = buildGateHistory(base({ moves: plain("L2") }));
    const keys = (r.transitions[0]!.readiness as { key: string }[]).map((c) => c.key);
    expect(keys).toEqual(["hypothesis_drafted", "owner_nominated"]);
  });
});

describe("buildGateHistory — die Abnehmer", () => {
  it("besetzt L3.1 mit den fünf Parteien und L3.2 mit VMO und Finance", () => {
    const r = buildGateHistory(base({ moves: plain("L3.2") }));
    const rolesOf = (i: number) =>
      r.approvals.filter((a) => a.transitionId === r.transitions[i]!.id).map((a) => a.role);
    expect(rolesOf(2)).toEqual([
      "epic.party.mgmt",
      "epic.party.business_owner",
      "epic.party.irt_owner",
      "epic.party.finance",
      "epic.party.lace_vmo",
    ]);
    expect(rolesOf(3)).toEqual(["value_stream.vmo", "value_stream.finance_approver"]);
  });

  it("lässt den Business Owner weg, wenn der Sitz unbesetzt ist", () => {
    const r = buildGateHistory(
      base({ parties: { mgmt: "pm", businessOwner: null, irtOwner: "rte" }, moves: plain("L3.1") }),
    );
    const roles = r.approvals
      .filter((a) => a.transitionId === r.transitions[2]!.id)
      .map((a) => a.role);
    expect(roles).not.toContain("epic.party.business_owner");
    expect(roles).toHaveLength(4);
  });

  it("dedupliziert dieselbe Person — der Unique-Index lässt sie nur einmal zu", () => {
    // VMO und Finance-Approver sind derselbe Mensch: L3.2 braucht dann eine Zeile.
    const r = buildGateHistory(base({ valueStreamFinanceApproverId: "vmo", moves: plain("L3.2") }));
    const rows = r.approvals.filter((a) => a.transitionId === r.transitions[3]!.id);
    expect(rows).toHaveLength(1);
  });
});

describe("buildGateHistory — die unbequemen Zustände", () => {
  it("eine Ablehnung lässt das Epic stehen und setzt keinen Stempel", () => {
    const r = buildGateHistory(
      base({
        moves: [
          ...plain("L2"),
          {
            kind: "rejected",
            to: "L3.1",
            requestedAt: d(50),
            decidedAt: d(45),
            reason: "Kosten unvollständig.",
          },
        ],
      }),
    );
    expect(r.finalStep).toBe("L2");
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
          ...plain("L3.1"),
          { kind: "revert", to: "L2", at: d(60), reason: "Nutzenrechnung trägt nicht." },
          { kind: "advance", to: "L3.1", requestedAt: d(30), decidedAt: d(25) },
        ],
      }),
    );
    expect(r.finalStep).toBe("L3.1");
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
          ...plain("L2"),
          {
            kind: "open",
            to: "L3.1",
            requestedAt: d(20),
            decidedRoles: ["epic.party.mgmt", "epic.party.finance"],
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
        moves: plain("L3.1"),
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
    expect(() => assertGateHistory(r, "ok")).not.toThrow();
  });

  it("schlägt an, wenn zwei Anträge offen sind", () => {
    const r = buildGateHistory(
      base({
        moves: [
          ...plain("L2"),
          { kind: "open", to: "L3.1", requestedAt: d(30) },
          { kind: "open", to: "L3.1", requestedAt: d(20) },
        ],
      }),
    );
    expect(() => assertGateHistory(r, "zwei offen")).toThrow(/offene Anträge/);
  });

  it("schlägt an, wenn der offene Antrag nicht vom aktuellen Schritt ausgeht", () => {
    const r = buildGateHistory(base({ moves: plain("L2") }));
    // Von Hand verbogen: genau der Fall, den der Demo-Seed vorher erzeugt hat.
    r.transitions.push({ ...r.transitions[0]!, id: "x", status: "pending", fromGate: "L4" });
    expect(() => assertGateHistory(r, "falsches fromGate")).toThrow(/nicht entscheidbar/);
  });

  it("schlägt an, wenn eine Person denselben Antrag zweimal abnimmt", () => {
    const r = buildGateHistory(base({ moves: plain("L1") }));
    r.approvals.push({ ...r.approvals[0]!, id: "dup" });
    expect(() => assertGateHistory(r, "doppelt")).toThrow(/zweimal ab/);
  });
});
