import { describe, it, expect } from "vitest";
import { groupRisksByRoam } from "@/modules/work/server/views/portfolio-overview";
import type { OverviewRisk } from "@/modules/work/server/views/portfolio-overview";
import { ROAM_STATUSES, type RoamStatus } from "@/modules/core/kernel/domain/roam";

/**
 * Die Übersicht zeigt Risiken als **ROAM-Board**: eine Kachel je Disposition.
 *
 * Vorher stand dort eine einzige Liste, allein nach Exposure sortiert. Weil ein
 * gemindertes Risiko mit Exposure 12 über einem offenen mit Exposure 4
 * rangiert, füllte erledigte Arbeit den sichtbaren Kopf — bei 119 Einträgen sah
 * man fast nur „Mitigated". Getrennt nach Disposition ist die Exposure-Ordnung
 * innerhalb einer Kachel genau die richtige.
 */

const risk = (id: string, roamStatus: RoamStatus, score: number | null): OverviewRisk => ({
  id,
  riskNumber: Number(id.slice(1)),
  title: `Risiko ${id}`,
  band: score == null ? null : score >= 10 ? "high" : "medium",
  score,
  roamStatus,
  epic: null,
});

describe("groupRisksByRoam", () => {
  /**
   * Eine Kachel, die bei null Einträgen verschwindet, lässt die Fläche bei
   * kleinen Mandanten zerfallen — `Test Demo` hat genau **ein** Risiko.
   */
  it("führt alle fünf Dispositionen, auch die leeren", () => {
    const out = groupRisksByRoam([risk("r1", "open", 12)]);
    expect(Object.keys(out).sort()).toEqual([...ROAM_STATUSES].sort());
    expect(out.open).toHaveLength(1);
    for (const s of ROAM_STATUSES.filter((x) => x !== "open")) {
      expect(out[s]).toEqual([]);
    }
  });

  /** Die Eingabe ist vorsortiert; die Gruppierung darf die Ordnung nicht drehen. */
  it("erhält die Exposure-Ordnung innerhalb einer Kachel", () => {
    const out = groupRisksByRoam([
      risk("r1", "open", 16),
      risk("r2", "mitigated", 15),
      risk("r3", "open", 9),
      risk("r4", "open", null),
    ]);
    expect(out.open.map((r) => r.id)).toEqual(["r1", "r3", "r4"]);
    expect(out.mitigated.map((r) => r.id)).toEqual(["r2"]);
  });

  it("legt jedes Risiko in genau eine Kachel", () => {
    const risks = [
      risk("r1", "open", 12),
      risk("r2", "owned", 12),
      risk("r3", "resolved", 12),
      risk("r4", "accepted", 12),
      risk("r5", "mitigated", 12),
      risk("r6", "owned", 4),
    ];
    const out = groupRisksByRoam(risks);
    const total = ROAM_STATUSES.reduce((sum, s) => sum + out[s].length, 0);
    expect(total).toBe(risks.length);
    expect(out.owned.map((r) => r.id)).toEqual(["r2", "r6"]);
  });

  it("kommt mit einer leeren Eingabe zurecht", () => {
    const out = groupRisksByRoam([]);
    expect(ROAM_STATUSES.every((s) => out[s].length === 0)).toBe(true);
  });
});
