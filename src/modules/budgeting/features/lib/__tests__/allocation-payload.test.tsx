import { describe, it, expect } from "vitest";
import {
  numOr0,
  encodeSaveBudgetAllocationPayload,
  encodeSaveBudgetPoolPayload,
  encodeSaveArtBudgetPayload,
} from "@/modules/budgeting/features/lib/allocation-payload";

/** Read back the `payload` JSON the encoder placed in the FormData envelope. */
function decode(fd: FormData): unknown {
  const raw = fd.get("payload");
  expect(typeof raw).toBe("string");
  return JSON.parse(raw as string);
}

describe("numOr0", () => {
  it("coerces numeric strings and floors empty/NaN to 0", () => {
    expect(numOr0("42")).toBe(42);
    expect(numOr0("3.5")).toBe(3.5);
    expect(numOr0("")).toBe(0);
    expect(numOr0("abc")).toBe(0);
  });
});

describe("allocation-payload encoders — typed args → payload JSON envelope", () => {
  it("encodeSaveBudgetAllocationPayload round-trips every field", () => {
    const fd = encodeSaveBudgetAllocationPayload({
      epicId: "11111111-1111-1111-1111-111111111111",
      priority: 3,
      hypothesisBudget: null,
      allocations: { "2026-H1": 100, "2026-H2": 200 },
    });
    expect(decode(fd)).toEqual({
      epicId: "11111111-1111-1111-1111-111111111111",
      priority: 3,
      hypothesisBudget: null,
      allocations: { "2026-H1": 100, "2026-H2": 200 },
    });
  });

  it("keeps a non-null hypothesisBudget", () => {
    const fd = encodeSaveBudgetAllocationPayload({
      epicId: "22222222-2222-2222-2222-222222222222",
      priority: 0,
      hypothesisBudget: 75,
      allocations: {},
    });
    expect(decode(fd)).toEqual({
      epicId: "22222222-2222-2222-2222-222222222222",
      priority: 0,
      hypothesisBudget: 75,
      allocations: {},
    });
  });

  it("encodeSaveBudgetPoolPayload wraps byPeriod", () => {
    const fd = encodeSaveBudgetPoolPayload({ byPeriod: { "2026-H1": 60000 } });
    expect(decode(fd)).toEqual({ byPeriod: { "2026-H1": 60000 } });
  });

  it("encodeSaveArtBudgetPayload wraps artId + byPeriod", () => {
    const fd = encodeSaveArtBudgetPayload({
      artId: "33333333-3333-3333-3333-333333333333",
      byPeriod: { "2026-H2": 12000 },
    });
    expect(decode(fd)).toEqual({
      artId: "33333333-3333-3333-3333-333333333333",
      byPeriod: { "2026-H2": 12000 },
    });
  });
});
