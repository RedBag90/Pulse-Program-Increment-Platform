import { describe, it, expect } from "vitest";
import { checkGroupCut, type CutGroup, type CutMember } from "@/modules/budgeting/domain/group-cut";

const mkMembers = (groupId: string, size: number, submitters = 0): CutMember[] =>
  Array.from({ length: size }, (_, i) => ({
    groupId,
    userId: `${groupId}-${i}`,
    isSubmitter: i < submitters,
  }));

// Nordwerk-Schnitt 6.3: 3 Gruppen × 6 Personen, Sprecher benannt.
const NORDWERK_GROUPS: CutGroup[] = [
  { id: "A", name: "A", spokespersonId: "A-0" },
  { id: "B", name: "B", spokespersonId: "B-0" },
  { id: "C", name: "C", spokespersonId: "C-0" },
];
const NORDWERK_MEMBERS: CutMember[] = [
  ...mkMembers("A", 6, 2),
  ...mkMembers("B", 6, 2),
  ...mkMembers("C", 6, 3),
];

describe("checkGroupCut", () => {
  it("sauberer Nordwerk-Schnitt liefert keine Warnungen", () => {
    expect(checkGroupCut(NORDWERK_GROUPS, NORDWERK_MEMBERS)).toEqual([]);
  });

  it("< 3 Gruppen wird gewarnt", () => {
    const codes = checkGroupCut(NORDWERK_GROUPS.slice(0, 2), NORDWERK_MEMBERS).map((w) => w.code);
    expect(codes).toContain("too_few_groups");
  });

  it("fehlender Sprecher + falsche Größe werden gewarnt", () => {
    const groups: CutGroup[] = [
      { id: "A", name: "A", spokespersonId: null },
      { id: "B", name: "B", spokespersonId: "B-0" },
      { id: "C", name: "C", spokespersonId: "C-0" },
    ];
    const members = [
      ...mkMembers("A", 2), // 2 < 4
      ...mkMembers("B", 4),
      ...mkMembers("C", 4),
    ];
    const codes = checkGroupCut(groups, members).map((w) => w.code);
    expect(codes).toContain("no_spokesperson");
    expect(codes).toContain("group_size");
  });
});
