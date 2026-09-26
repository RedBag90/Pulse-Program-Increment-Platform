import { describe, it, expect } from "vitest";
import {
  resolveKpiSelection,
  type KpiValueStreamOption,
} from "@/modules/work/domain/budget-kpi-selection";

/**
 * **Die Auswahl der Budget-KPIs im Portfolio Sync** — was in der URL steht,
 * ist eine Bitte; was nicht sichtbar oder nicht passend ist, fällt zurück.
 */

const opt = (id: string, showTotals: boolean, arts: string[]): KpiValueStreamOption => ({
  id,
  name: id,
  showTotals,
  arts: arts.map((a) => ({ id: a, name: a })),
});

const OPTIONEN = [opt("vs1", true, ["a1", "a2"]), opt("vs2", false, ["b1", "b2"])];

describe("resolveKpiSelection", () => {
  it("ein gültiger Wertstrom gewinnt, sonst der erste", () => {
    expect(resolveKpiSelection(OPTIONEN, "vs2", undefined)?.valueStream.id).toBe("vs2");
    expect(resolveKpiSelection(OPTIONEN, "fremd", undefined)?.valueStream.id).toBe("vs1");
    expect(resolveKpiSelection(OPTIONEN, undefined, undefined)?.valueStream.id).toBe("vs1");
  });

  it('ein ART nur, wenn es zu diesem Wertstrom gehört — sonst „gesamt"', () => {
    expect(resolveKpiSelection(OPTIONEN, "vs1", "a2")?.artId).toBe("a2");
    expect(resolveKpiSelection(OPTIONEN, "vs1", "b1")?.artId).toBeNull();
  });

  it('ohne Wertstrom-Recht gibt es „gesamt" nicht — das erste sichtbare ART', () => {
    expect(resolveKpiSelection(OPTIONEN, "vs2", undefined)?.artId).toBe("b1");
    expect(resolveKpiSelection(OPTIONEN, "vs2", "b2")?.artId).toBe("b2");
  });

  it("ohne sichtbaren Wertstrom: null", () => {
    expect(resolveKpiSelection([], "vs1", "a1")).toBeNull();
  });
});
