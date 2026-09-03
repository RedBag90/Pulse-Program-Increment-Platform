import { describe, it, expect } from "vitest";
import {
  resolveGatePolicy,
  expandApprovers,
  DEFAULT_GATE_POLICIES,
  allowsAdHocApprovers,
  type ApproverContext,
  type GateApproverRuleRow,
} from "@/modules/work/domain/gate-policy";

const VS = "vs-1";
const FINANCE = "user-finance";
const VMO = "user-vmo";
const OWNER = "user-owner";

function rule(over: Partial<GateApproverRuleRow> = {}): GateApproverRuleRow {
  return {
    valueStreamId: null,
    toGate: "L3.1",
    required: true,
    quorum: "all",
    approverUserIds: [],
    approverRoles: [],
    ...over,
  };
}

function ctx(over: Partial<ApproverContext> = {}): ApproverContext {
  return {
    valueStreamFinanceApproverId: FINANCE,
    valueStreamVmoId: VMO,
    epicOwnerId: OWNER,
    ...over,
  };
}

describe("resolveGatePolicy — Präzedenz", () => {
  it("ohne Regel-Zeile gilt der Code-Default", () => {
    const p = resolveGatePolicy("L3.1", [], VS);
    expect(p.source).toBe("code_default");
    expect(p).toMatchObject(DEFAULT_GATE_POLICIES["L3.1"]);
  });

  it("die Tenant-Zeile (valueStreamId=null) schlägt den Code-Default", () => {
    const p = resolveGatePolicy("L3.1", [rule({ approverUserIds: ["u-tenant"] })], VS);
    expect(p.source).toBe("tenant");
    expect(p.approverUserIds).toEqual(["u-tenant"]);
  });

  it("die Wertstrom-Zeile schlägt die Tenant-Zeile", () => {
    const rows = [
      rule({ approverUserIds: ["u-tenant"] }),
      rule({ valueStreamId: VS, approverUserIds: ["u-vs"] }),
    ];
    const p = resolveGatePolicy("L3.1", rows, VS);
    expect(p.source).toBe("value_stream");
    expect(p.approverUserIds).toEqual(["u-vs"]);
  });

  it("die Wertstrom-Zeile eines FREMDEN Wertstroms greift nicht", () => {
    const rows = [rule({ valueStreamId: "vs-other", approverUserIds: ["u-other"] })];
    expect(resolveGatePolicy("L3.1", rows, VS).source).toBe("code_default");
  });

  it("ein Epic ohne Wertstrom bekommt die Tenant-Zeile, nie eine VS-Zeile", () => {
    const rows = [
      rule({ valueStreamId: VS, approverUserIds: ["u-vs"] }),
      rule({ approverUserIds: ["u-tenant"] }),
    ];
    expect(resolveGatePolicy("L3.1", rows, null).approverUserIds).toEqual(["u-tenant"]);
  });

  it("Regeln anderer Gates werden ignoriert", () => {
    const rows = [rule({ toGate: "L4", valueStreamId: VS, approverUserIds: ["u-l4"] })];
    expect(resolveGatePolicy("L3.1", rows, VS).source).toBe("code_default");
  });

  it("required und quorum kommen aus der gewinnenden Zeile", () => {
    const p = resolveGatePolicy("L3.1", [rule({ required: false, quorum: "any" })], VS);
    expect(p.required).toBe(false);
    expect(p.quorum).toBe("any");
  });

  it("ein unbekanntes Quorum in der DB fällt auf einstimmig zurück", () => {
    // Die Spalte ist ein String — diese Funktion darf sich nicht darauf
    // verlassen, dass nur Gültiges drinsteht.
    expect(resolveGatePolicy("L3.1", [rule({ quorum: "majority" })], VS).quorum).toBe("all");
  });

  it("unbekannte Rollen-Platzhalter werden verworfen statt durchgereicht", () => {
    const p = resolveGatePolicy(
      "L3.1",
      [rule({ approverRoles: ["value_stream.vmo", "sonstwas"] })],
      VS,
    );
    expect(p.approverRoles).toEqual(["value_stream.vmo"]);
  });
});

describe("DEFAULT_GATE_POLICIES", () => {
  it("alle fünf Vorwärts-Gates verlangen eine Abnahme, einstimmig", () => {
    for (const gate of ["L1", "L2", "L3.1", "L3.2", "L4", "L4.2", "L5"] as const) {
      expect(DEFAULT_GATE_POLICIES[gate].required).toBe(true);
      expect(DEFAULT_GATE_POLICIES[gate].quorum).toBe("all");
      expect(DEFAULT_GATE_POLICIES[gate].approverRoles.length).toBeGreaterThan(0);
    }
  });

  it("L3.2 (Investitionsentscheidung) und L5 (Impact) ziehen Finance hinzu", () => {
    // Der Eintritt in L3 ist nur „BC freigegeben" — Finance zeichnet erst die
    // Geldentscheidung mit, also den Schritt L3 → L3.2.
    expect(DEFAULT_GATE_POLICIES["L3.2"].approverRoles).toContain("value_stream.finance_approver");
    expect(DEFAULT_GATE_POLICIES.L5.approverRoles).toContain("value_stream.finance_approver");
    expect(DEFAULT_GATE_POLICIES["L3.1"].approverRoles).not.toContain(
      "value_stream.finance_approver",
    );
  });
});

describe("expandApprovers — Platzhalter-Auflösung", () => {
  it("löst die Wertstrom-Platzhalter auf, wie es der Business Case schon tut", () => {
    const p = resolveGatePolicy("L3.2", [], VS); // Code-Default: vmo + finance
    expect(expandApprovers(p, ctx())).toEqual([
      { userId: VMO, role: "value_stream.vmo", source: "value_stream" },
      { userId: FINANCE, role: "value_stream.finance_approver", source: "value_stream" },
    ]);
  });

  it("löst den Epic-Owner-Platzhalter mit eigener Herkunft auf", () => {
    const p = resolveGatePolicy("L1", [rule({ toGate: "L1", approverRoles: ["epic.owner"] })], VS);
    expect(expandApprovers(p, ctx())).toEqual([
      { userId: OWNER, role: "epic.owner", source: "epic_owner" },
    ]);
  });

  it("direkt benannte Personen kommen vor den Platzhaltern", () => {
    const p = resolveGatePolicy(
      "L3.2",
      [rule({ toGate: "L3.2", approverUserIds: ["u-named"], approverRoles: ["value_stream.vmo"] })],
      VS,
    );
    expect(expandApprovers(p, ctx()).map((a) => a.userId)).toEqual(["u-named", VMO]);
  });

  it("dedupliziert: wer zweimal getroffen wird, nimmt einmal ab", () => {
    // Dieselbe Person ist VMO *und* Finance-Approver — sie darf sich nicht
    // selbst blockieren, indem sie zwei Zeilen bekommt.
    const p = resolveGatePolicy("L3.2", [], VS);
    const both = ctx({ valueStreamFinanceApproverId: VMO });
    const resolved = expandApprovers(p, both);
    expect(resolved).toHaveLength(1);
    expect(resolved[0]).toMatchObject({ userId: VMO, role: "value_stream.vmo" });
  });

  it("ein Platzhalter ins Leere fällt still weg", () => {
    const p = resolveGatePolicy("L3.2", [], VS);
    const resolved = expandApprovers(p, ctx({ valueStreamVmoId: null }));
    expect(resolved.map((a) => a.userId)).toEqual([FINANCE]);
  });

  it("gar nichts auflösbar ⇒ leere Menge (der Aufrufer entscheidet, was das heisst)", () => {
    const p = resolveGatePolicy("L3.2", [], VS);
    expect(
      expandApprovers(p, {
        valueStreamFinanceApproverId: null,
        valueStreamVmoId: null,
        epicOwnerId: null,
      }),
    ).toEqual([]);
  });

  it("an L3.2 wird ein Override ignoriert — dort gilt die Wertstrom-Regel", () => {
    expect(allowsAdHocApprovers("L3.2")).toBe(false);
    const p = resolveGatePolicy("L3.2", [], VS);
    const withOverride = expandApprovers(p, ctx(), [{ userId: "u-adhoc" }]);
    expect(withOverride.map((a) => a.userId)).toEqual([VMO, FINANCE]);
  });

  it("an L3.1 ersetzt der Override die Policy — und führt die Rolle mit", () => {
    expect(allowsAdHocApprovers("L3.1")).toBe(true);
    const p = resolveGatePolicy("L3.1", [], VS);
    const withOverride = expandApprovers(p, ctx(), [
      { userId: "u-bo", role: "epic.party.business_owner" },
      { userId: "u-mgmt", role: "epic.party.mgmt" },
    ]);
    expect(withOverride).toEqual([
      { userId: "u-bo", role: "epic.party.business_owner", source: "manual" },
      { userId: "u-mgmt", role: "epic.party.mgmt", source: "manual" },
    ]);
  });

  it("ein leerer Override wird auch an L3.1 ignoriert", () => {
    const p = resolveGatePolicy("L3.1", [], VS);
    expect(expandApprovers(p, ctx(), []).map((a) => a.userId)).toEqual([FINANCE, VMO]);
  });

  it("L3.1 besetzt im Code-Default die fünf Parteien plus den Produkt-Manager", () => {
    const p = resolveGatePolicy("L3.1", [], VS);
    expect(p.approverRoles).toEqual([
      "epic.party.mgmt",
      "epic.party.business_owner",
      "epic.party.finance",
      "epic.party.irt_owner",
      "epic.party.lace_vmo",
      "solution.product_manager",
    ]);
    // MGMT, Business Owner und IRT-Owner haben keine Wertstrom-Spalte: sie
    // fallen still weg und werden am Antrag benannt.
    expect(expandApprovers(p, ctx())).toEqual([
      { userId: FINANCE, role: "epic.party.finance", source: "value_stream" },
      { userId: VMO, role: "epic.party.lace_vmo", source: "value_stream" },
    ]);
  });

  it("ohne die Practice zeichnet an L3.1 der VMO allein", () => {
    const p = resolveGatePolicy("L3.1", [], VS, { multiPartyApproval: false });
    expect(p.approverRoles).toEqual(["value_stream.vmo"]);
  });
});

/**
 * Der Produkt-Manager der Primär-Solution — der einzige Platzhalter, der nicht
 * an jedem Schritt gleich wirkt.
 */
describe("expandApprovers — Produkt-Manager der Solution", () => {
  const PM = "user-pm";
  const base = {
    valueStreamFinanceApproverId: null,
    valueStreamVmoId: null,
    epicOwnerId: null,
  };

  it("zeichnet an L3.1 bei jedem Epic seiner Solution mit", () => {
    const p = resolveGatePolicy("L3.1", [], VS);
    const out = expandApprovers(p, { ...base, solutionProductManagerId: PM, epicClass: null });
    expect(out).toEqual([{ userId: PM, role: "solution.product_manager", source: "solution" }]);
  });

  it("zeichnet an L4 nur bei einem ART-Epic mit", () => {
    const p = resolveGatePolicy("L4", [], VS);
    const asArt = expandApprovers(p, { ...base, solutionProductManagerId: PM, epicClass: "art" });
    expect(asArt.map((a) => a.userId)).toContain(PM);

    const asPortfolio = expandApprovers(p, {
      ...base,
      solutionProductManagerId: PM,
      epicClass: "portfolio",
    });
    expect(asPortfolio.map((a) => a.userId)).not.toContain(PM);
  });

  // „Ein Platzhalter, der ins Leere zeigt, fällt still weg" — ohne benannten
  // Produkt-Manager läuft der Antrag wie zuvor, statt zu blockieren.
  it("fällt still weg, wenn niemand benannt ist", () => {
    const p = resolveGatePolicy("L3.1", [], VS);
    expect(expandApprovers(p, { ...base, solutionProductManagerId: null })).toEqual([]);
  });
});
