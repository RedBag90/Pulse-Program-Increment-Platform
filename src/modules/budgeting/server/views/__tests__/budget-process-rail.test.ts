import { describe, it, expect } from "vitest";
import {
  buildBudgetProcessRail,
  type ProcessStep,
} from "@/modules/budgeting/server/views/budget-process-rail";

const base = {
  roundStatus: null,
  stagedCount: 0,
  allocatedTotal: 0,
  latestIsCurrentCycle: false,
} as const;

function get(steps: ProcessStep[], key: string): ProcessStep {
  const s = steps.find((x) => x.key === key);
  if (!s) throw new Error(`step ${key} missing`);
  return s;
}

describe("buildBudgetProcessRail", () => {
  it("sechs Schritte mit Deep-Links", () => {
    const steps = buildBudgetProcessRail(base);
    expect(steps).toHaveLength(6);
    expect(steps.map((s) => s.key)).toEqual([
      "einreichung",
      "rahmen",
      "erfassung",
      "entscheidung",
      "detail",
      "protokoll",
    ]);
    expect(get(steps, "detail").href).toBe("/budgeting/round");
    expect(get(steps, "protokoll").href).toBe("/budgeting");
    expect(get(steps, "rahmen").href).toBe("/budgeting/rounds");
  });

  it("ohne Runde: Erfassung/Entscheidung/Detail/Protokoll blockiert", () => {
    const steps = buildBudgetProcessRail(base);
    expect(get(steps, "einreichung")).toMatchObject({ done: false, blocked: false });
    expect(get(steps, "rahmen")).toMatchObject({ done: false, blocked: false });
    expect(get(steps, "erfassung").blocked).toBe(true); // keine Runde
    expect(get(steps, "entscheidung").blocked).toBe(true);
    expect(get(steps, "detail").blocked).toBe(true); // nicht geschlossen, nichts zugeteilt
    expect(get(steps, "protokoll").blocked).toBe(true);
  });

  it("vorgemerkte Epics erledigen die Einreichung", () => {
    const steps = buildBudgetProcessRail({ ...base, stagedCount: 4 });
    expect(get(steps, "einreichung").done).toBe(true);
  });

  it("draft: Rahmen aktiv (nicht erledigt), Erfassung entblockt aber offen", () => {
    const steps = buildBudgetProcessRail({ ...base, roundStatus: "draft" });
    expect(get(steps, "rahmen").done).toBe(false);
    expect(get(steps, "erfassung").blocked).toBe(false);
    expect(get(steps, "entscheidung").blocked).toBe(true); // erst ab running
  });

  it("running: Rahmen erledigt, Erfassung offen, Entscheidung entblockt", () => {
    const steps = buildBudgetProcessRail({ ...base, roundStatus: "running" });
    expect(get(steps, "rahmen").done).toBe(true);
    expect(get(steps, "erfassung").done).toBe(false);
    expect(get(steps, "entscheidung").blocked).toBe(false);
  });

  it("decided: Erfassung erledigt, Entscheidung offen", () => {
    const steps = buildBudgetProcessRail({ ...base, roundStatus: "decided" });
    expect(get(steps, "erfassung").done).toBe(true);
    expect(get(steps, "entscheidung").done).toBe(false);
  });

  it("closed: Entscheidung erledigt, Detail entblockt", () => {
    const steps = buildBudgetProcessRail({ ...base, roundStatus: "closed" });
    expect(get(steps, "entscheidung").done).toBe(true);
    expect(get(steps, "detail")).toMatchObject({ done: false, blocked: false });
    expect(get(steps, "protokoll").blocked).toBe(false);
  });

  it("Zuteilungen erledigen Detail und entblocken es auch ohne Schließen", () => {
    const steps = buildBudgetProcessRail({ ...base, allocatedTotal: 40_000 });
    expect(get(steps, "detail")).toMatchObject({ done: true, blocked: false });
    expect(get(steps, "protokoll").blocked).toBe(false);
  });

  it("aktuelle Revision erledigt das Protokoll", () => {
    const steps = buildBudgetProcessRail({
      roundStatus: "closed",
      stagedCount: 3,
      allocatedTotal: 40_000,
      latestIsCurrentCycle: true,
    });
    expect(get(steps, "protokoll").done).toBe(true);
  });
});
