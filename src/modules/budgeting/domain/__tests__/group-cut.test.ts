import { describe, it, expect } from "vitest";
import { checkGroupCut, type CutGroup, type CutMember } from "@/modules/budgeting/domain/group-cut";

const mkMembers = (groupId: string, teams: (string | null)[], submitters = 0): CutMember[] =>
  teams.map((team, i) => ({
    groupId,
    userId: `${groupId}-${i}`,
    team,
    isSubmitter: i < submitters,
  }));

// Nordwerk-Schnitt 6.3: 3 Gruppen × 6 Personen, heterogen, Sprecher benannt.
const NORDWERK_GROUPS: CutGroup[] = [
  { id: "A", name: "A", spokespersonId: "A-0" },
  { id: "B", name: "B", spokespersonId: "B-0" },
  { id: "C", name: "C", spokespersonId: "C-0" },
];
const NORDWERK_MEMBERS: CutMember[] = [
  ...mkMembers("A", ["einr", "einr2", "vertrieb", "finanzen", "it", "produkt"], 2),
  ...mkMembers("B", ["einr", "einr2", "vertrieb", "finanzen", "it", "hr"], 2),
  ...mkMembers("C", ["einr", "einr2", "einr3", "finanzen", "it", "produkt"], 3),
];

describe("checkGroupCut", () => {
  it("sauberer Nordwerk-Schnitt liefert keine Warnungen", () => {
    expect(checkGroupCut(NORDWERK_GROUPS, NORDWERK_MEMBERS)).toEqual([]);
  });

  it("< 3 Gruppen wird gewarnt", () => {
    const codes = checkGroupCut(NORDWERK_GROUPS.slice(0, 2), NORDWERK_MEMBERS).map((w) => w.code);
    expect(codes).toContain("too_few_groups");
  });

  it("Team-Dopplung in einer Gruppe wird gewarnt", () => {
    const groups: CutGroup[] = [
      { id: "A", name: "A", spokespersonId: "A-0" },
      { id: "B", name: "B", spokespersonId: "B-0" },
      { id: "C", name: "C", spokespersonId: "C-0" },
    ];
    const members = [
      ...mkMembers("A", ["x", "x", "y", "z"]), // zwei aus Team x
      ...mkMembers("B", ["a", "b", "c", "d"]),
      ...mkMembers("C", ["e", "f", "g", "h"]),
    ];
    const w = checkGroupCut(groups, members);
    expect(w.some((x) => x.code === "team_clash" && x.groupId === "A")).toBe(true);
  });

  it("fehlender Sprecher + falsche Größe werden gewarnt", () => {
    const groups: CutGroup[] = [
      { id: "A", name: "A", spokespersonId: null },
      { id: "B", name: "B", spokespersonId: "B-0" },
      { id: "C", name: "C", spokespersonId: "C-0" },
    ];
    const members = [
      ...mkMembers("A", ["a", "b"]), // 2 < 4
      ...mkMembers("B", ["c", "d", "e", "f"]),
      ...mkMembers("C", ["g", "h", "i", "j"]),
    ];
    const codes = checkGroupCut(groups, members).map((w) => w.code);
    expect(codes).toContain("no_spokesperson");
    expect(codes).toContain("group_size");
  });
});
