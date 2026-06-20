import { describe, it, expect } from "vitest";
import { checkKpiBinding } from "../kpi-binding-invariant";

const KPI = "kpi-1";
const KR_A = "kr-a";
const KR_B = "kr-b";

describe("checkKpiBinding (Pyramid-Invariante)", () => {
  it("plant create, wenn KPI noch ungebunden und Ziel-KR gesetzt", () => {
    const r = checkKpiBinding({ kpiId: KPI, targetKeyResultId: KR_A, existing: null });
    expect(r).toEqual({ ok: true, value: { kind: "create", kpiId: KPI, keyResultId: KR_A } });
  });

  it("plant noop, wenn ungebunden bleibt", () => {
    const r = checkKpiBinding({ kpiId: KPI, targetKeyResultId: null, existing: null });
    expect(r).toEqual({ ok: true, value: { kind: "noop" } });
  });

  it("plant noop, wenn Bindung schon auf Ziel-KR steht", () => {
    const r = checkKpiBinding({
      kpiId: KPI,
      targetKeyResultId: KR_A,
      existing: { kpiId: KPI, keyResultId: KR_A },
    });
    expect(r).toEqual({ ok: true, value: { kind: "noop" } });
  });

  it("plant delete, wenn Bindung geloest werden soll", () => {
    const r = checkKpiBinding({
      kpiId: KPI,
      targetKeyResultId: null,
      existing: { kpiId: KPI, keyResultId: KR_A },
    });
    expect(r).toEqual({ ok: true, value: { kind: "delete", kpiId: KPI } });
  });

  it("plant rebind, wenn Ziel-KR wechselt", () => {
    const r = checkKpiBinding({
      kpiId: KPI,
      targetKeyResultId: KR_B,
      existing: { kpiId: KPI, keyResultId: KR_A },
    });
    expect(r).toEqual({
      ok: true,
      value: { kind: "rebind", kpiId: KPI, fromKeyResultId: KR_A, toKeyResultId: KR_B },
    });
  });

  it("verletzt Pyramide, wenn existing fuer eine andere KPI gemeldet wird", () => {
    const r = checkKpiBinding({
      kpiId: KPI,
      targetKeyResultId: KR_A,
      existing: { kpiId: "kpi-2", keyResultId: KR_B },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toEqual({
        kind: "pyramid_violated",
        kpiId: KPI,
        existingKeyResultId: KR_B,
      });
    }
  });

  it("Property: jeder erlaubte Plan hinterlaesst genau 0 oder 1 Bindung pro KPI", () => {
    const cases = [
      { existing: null, target: null, expected: 0 },
      { existing: null, target: KR_A, expected: 1 },
      { existing: { kpiId: KPI, keyResultId: KR_A }, target: null, expected: 0 },
      { existing: { kpiId: KPI, keyResultId: KR_A }, target: KR_A, expected: 1 },
      { existing: { kpiId: KPI, keyResultId: KR_A }, target: KR_B, expected: 1 },
    ];
    for (const c of cases) {
      const r = checkKpiBinding({
        kpiId: KPI,
        targetKeyResultId: c.target,
        existing: c.existing,
      });
      expect(r.ok).toBe(true);
      if (!r.ok) continue;
      const after =
        r.value.kind === "create" || r.value.kind === "rebind"
          ? 1
          : r.value.kind === "delete"
            ? 0
            : c.existing
              ? 1
              : 0;
      expect(after).toBe(c.expected);
    }
  });
});
