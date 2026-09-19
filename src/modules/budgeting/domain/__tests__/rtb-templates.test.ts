import { describe, it, expect } from "vitest";
import {
  RTB_TEMPLATES,
  templatesOfGroup,
  templateById,
} from "@/modules/budgeting/domain/rtb-templates";
import {
  rtbAssignmentGroup,
  RTB_ASSIGNMENT_GROUPS,
  RTB_ASSIGNMENT_GROUP_LABELS,
} from "@/modules/budgeting/domain/rtb-art-resolution";
import { isRtbInterval } from "@/modules/budgeting/domain/rtb-interval";
import { RTB_KINDS } from "@/modules/budgeting/domain/rtb-kind";

/**
 * Die Vorlagen sind eine Liste im Code — genau deshalb braucht es einen Test,
 * der sie gegen die Typen hält, die sie später füttern. Eine Vorlage mit einer
 * ungültigen Periode fällt sonst erst im Formular auf.
 */

describe("RTB_TEMPLATES", () => {
  it("trägt je Vorlage eine gültige Art und Periode", () => {
    for (const t of RTB_TEMPLATES) {
      expect(RTB_KINDS, t.id).toContain(t.kind);
      expect(isRtbInterval(t.interval), t.id).toBe(true);
    }
  });

  it("hat zu jeder Zurechnungsebene mindestens eine Vorlage", () => {
    for (const g of RTB_ASSIGNMENT_GROUPS) {
      expect(templatesOfGroup(g).length, RTB_ASSIGNMENT_GROUP_LABELS[g]).toBeGreaterThan(0);
    }
  });

  it("vergibt jede Kennung genau einmal", () => {
    const ids = RTB_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  /**
   * **Der Rahmen ist die einzige Grow-Vorlage** — und er gehört einem ART.
   * Ein `art_change` ohne ART wäre eine Position, die der Service ablehnt.
   */
  it("führt den ART-Rahmen als einzige Grow-Vorlage, auf ART-Ebene", () => {
    const grow = RTB_TEMPLATES.filter((t) => t.kind === "art_change");
    expect(grow.map((t) => t.id)).toEqual(["art-rahmen"]);
    expect(grow[0]?.group).toBe("art");
    // Je Halbjahr, weil genau so oft darüber entschieden wird.
    expect(grow[0]?.interval).toBe("half_yearly");
  });

  /**
   * Die Kapazitäts-Vorlagen führen in eine bekannte Falle (§2.6) — sie müssen
   * sie benennen. Ohne diesen Test verschwände der Hinweis beim nächsten
   * Aufräumen, und die Vorlage würde stumm irreführen.
   */
  it("gibt jeder Kapazitäts-Vorlage ihren Vorbehalt mit", () => {
    for (const id of ["team-kapazitaet", "art-rollen", "system-team"]) {
      expect(templateById(id)?.caveat, id).toBeTruthy();
    }
    expect(templateById("betrieb-support")?.caveat).toBeUndefined();
  });

  it("kennt keine Vorlage unter einer unbekannten Kennung", () => {
    expect(templateById("gibt-es-nicht")).toBeNull();
  });
});

describe("die Vorlage landet in ihrer eigenen Gruppe", () => {
  /**
   * Die Probe, die beides zusammenhält: füllt man eine Vorlage so aus, wie sie
   * es verlangt, ordnet `rtbAssignmentGroup` die Position genau der Gruppe zu,
   * unter der sie angeboten wurde.
   */
  it("stimmt für jede Vorlage mit rtbAssignmentGroup überein", () => {
    for (const t of RTB_TEMPLATES) {
      const position =
        t.group === "art"
          ? { artId: "a1", solutionId: null }
          : t.group === "solution"
            ? { artId: null, solutionId: "s1" }
            : { artId: null, solutionId: null };
      expect(rtbAssignmentGroup(position), t.id).toBe(t.group);
    }
  });
});
