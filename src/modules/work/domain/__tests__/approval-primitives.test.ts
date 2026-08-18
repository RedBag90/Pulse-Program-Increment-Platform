import { describe, it, expect } from "vitest";
import { isErr, isOk } from "@/modules/core/kernel/domain/errors";
import {
  decisionStatus,
  assertAssignedApprover,
  rollup,
  quorumReached,
  quorumRejected,
  pendingCount,
  isQuorum,
  type ApprovalStatus,
} from "@/modules/work/domain/approval-primitives";
import { assertAssignedApprover as reexported } from "@/modules/work/domain/epic-approval";

function rows(...statuses: ApprovalStatus[]) {
  return statuses.map((status) => ({ status }));
}

describe("decisionStatus", () => {
  it("bildet die Entscheidung auf den Zeilenstatus ab", () => {
    expect(decisionStatus("approve")).toBe("approved");
    expect(decisionStatus("reject")).toBe("rejected");
  });
});

describe("assertAssignedApprover", () => {
  it("lässt den zugewiesenen Approver durch", () => {
    expect(isOk(assertAssignedApprover({ approverUserId: "u1" }, "u1"))).toBe(true);
  });

  it("weist jeden anderen ab — auch bei unbesetzter Zeile", () => {
    expect(isErr(assertAssignedApprover({ approverUserId: "u1" }, "u2"))).toBe(true);
    expect(isErr(assertAssignedApprover({ approverUserId: null }, "u2"))).toBe(true);
  });

  it("ist dieselbe Funktion, die epic-approval.ts re-exportiert", () => {
    // Beide Achsen müssen denselben Guard benutzen, nicht zwei Kopien.
    expect(reexported).toBe(assertAssignedApprover);
  });
});

describe("rollup", () => {
  it("leer ⇒ unassigned, Ablehnung dominiert, sonst erst bei Vollständigkeit approved", () => {
    expect(rollup([])).toBe("unassigned");
    expect(rollup(rows("approved", "rejected"))).toBe("rejected");
    expect(rollup(rows("approved", "approved"))).toBe("approved");
    expect(rollup(rows("approved", "pending"))).toBe("pending");
  });
});

describe("quorumReached", () => {
  it("'all' verlangt jede Zustimmung, 'any' eine", () => {
    expect(quorumReached(rows("approved", "pending"), "all")).toBe(false);
    expect(quorumReached(rows("approved", "approved"), "all")).toBe(true);
    expect(quorumReached(rows("approved", "pending"), "any")).toBe(true);
    expect(quorumReached(rows("pending", "pending"), "any")).toBe(false);
  });

  it("eine leere Menge ist NIE erreicht — kein Durchrutschen per vacuous truth", () => {
    // `[].every(...)` wäre true. Ein Antrag ohne Abnehmer gehört in den
    // required=false-Pfad, nicht durch dieses Schlupfloch.
    expect(quorumReached([], "all")).toBe(false);
    expect(quorumReached([], "any")).toBe(false);
  });
});

describe("quorumRejected / pendingCount", () => {
  it("eine Ablehnung genügt, unabhängig vom Quorum", () => {
    expect(quorumRejected(rows("approved", "rejected"))).toBe(true);
    expect(quorumRejected(rows("approved", "pending"))).toBe(false);
  });

  it("zählt die offenen Zeilen", () => {
    expect(pendingCount(rows("approved", "pending", "pending"))).toBe(2);
    expect(pendingCount([])).toBe(0);
  });
});

describe("isQuorum", () => {
  it("erkennt nur die beiden gültigen Werte", () => {
    expect(isQuorum("all")).toBe(true);
    expect(isQuorum("any")).toBe(true);
    expect(isQuorum("majority")).toBe(false);
  });
});
