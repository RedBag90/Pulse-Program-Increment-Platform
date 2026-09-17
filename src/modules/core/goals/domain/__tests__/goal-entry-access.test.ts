import { describe, it, expect } from "vitest";
import {
  goalEntryEditDeniedReason,
  goalEntryDeleteDeniedReason,
  goalEntryPermissions,
} from "@/modules/core/goals/domain/goal-entry-access";

const VERFASSER = { authorId: "u1", actorId: "u1", mayManage: false };
const FREMDER = { authorId: "u1", actorId: "u2", mayManage: false };
const PFLEGE = { authorId: "u1", actorId: "u2", mayManage: true };

describe("goalEntryEditDeniedReason — niemandem Worte in den Mund legen", () => {
  it("lässt den Verfasser seinen eigenen Eintrag ändern", () => {
    expect(goalEntryEditDeniedReason(VERFASSER)).toBeNull();
  });

  it("lässt einen Fremden nicht ändern", () => {
    expect(goalEntryEditDeniedReason(FREMDER)).toContain("fremden Eintrag");
  });

  it("lässt auch die Ziel-Pflege nicht ändern — das ist der Punkt", () => {
    expect(goalEntryEditDeniedReason(PFLEGE)).not.toBeNull();
  });
});

describe("goalEntryDeleteDeniedReason — entfernen darf, wer pflegt", () => {
  it("lässt den Verfasser löschen", () => {
    expect(goalEntryDeleteDeniedReason(VERFASSER)).toBeNull();
  });

  it("lässt die Ziel-Pflege löschen", () => {
    expect(goalEntryDeleteDeniedReason(PFLEGE)).toBeNull();
  });

  it("lässt einen Fremden ohne Pflege-Recht nicht löschen", () => {
    expect(goalEntryDeleteDeniedReason(FREMDER)).toContain("target.manage");
  });
});

describe("goalEntryPermissions — was die Fläche zeigt", () => {
  it("zeigt dem Verfasser beides", () => {
    expect(goalEntryPermissions(VERFASSER)).toEqual({ mayEdit: true, mayDelete: true });
  });

  it("zeigt der Pflege nur das Löschen", () => {
    expect(goalEntryPermissions(PFLEGE)).toEqual({ mayEdit: false, mayDelete: true });
  });

  it("zeigt einem Fremden nichts", () => {
    expect(goalEntryPermissions(FREMDER)).toEqual({ mayEdit: false, mayDelete: false });
  });
});
