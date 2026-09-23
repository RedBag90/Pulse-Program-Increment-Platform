import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, within } from "@testing-library/react";
import { GoalSetupStepper } from "@/modules/core/goals/features/components/goal-setup-stepper";
import { goalSetupSteps, type GoalSetupNode } from "@/modules/core/goals/domain/goal-setup";

/**
 * **Die Einrichtungs-Liste im Schema der Tor-Kachel.**
 *
 * Sie hatte keinen Test — fünf Kacheln nebeneinander, von denen nur die aktive
 * einen Weg trug. Geprüft wird jetzt, was das neue Schema zusichert: jede
 * offene Zeile führt irgendwohin, jede erledigte tritt zurück, und die Auskunft
 * „wo fange ich an" steht genau einmal da.
 */

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/modules/core/goals/features/actions/ziele-setup", () => ({
  dismissZieleSetupAction: vi.fn(),
}));

function node(over: Partial<GoalSetupNode> = {}): GoalSetupNode {
  return {
    id: "g1",
    period: null,
    periodStart: null,
    periodEnd: null,
    ownerId: null,
    target: null,
    latestCheckin: null,
    status: null,
    children: [],
    ...over,
  };
}

/** Die Leiste zu einem Tenant, dessen Ziele so aussehen. */
function leiste(themes: GoalSetupNode[]) {
  return render(<GoalSetupStepper steps={goalSetupSteps(themes).steps} />);
}

/** Zeilen als Paare: Titel und ob sie einen Link trägt. */
const zeilen = (): { text: string; link: string | null }[] =>
  screen.getAllByRole("listitem").map((li) => ({
    text: li.textContent ?? "",
    link: within(li).queryByRole("link")?.textContent?.trim() ?? null,
  }));

describe("GoalSetupStepper — der Kopf", () => {
  it("nennt die Liste als das, was sie ist", () => {
    leiste([]);
    expect(screen.getByRole("heading", { name: /To-dos für den Einstieg/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Anleitung ausblenden" })).toBeTruthy();
  });
});

describe("GoalSetupStepper — die Zeilen", () => {
  // Ein Ziel mit Zeitraum, ohne Owner, mit Zielwert: „Messgröße" ist erledigt,
  // obwohl „Owner" davor offen steht. Genau der Fall, den die alte
  // Reihenfolge-Ableitung verschluckt hat.
  const GEMISCHT = [node({ period: "2026-Q1", target: 100 })];

  it("führt alle fünf Schritte untereinander", () => {
    leiste(GEMISCHT);
    expect(zeilen()).toHaveLength(5);
  });

  it("gibt jeder offenen Zeile einen Weg — und keiner erledigten", () => {
    leiste(GEMISCHT);
    const [create, period, owner, metric, checkin] = zeilen();

    expect(create!.link).toBeNull();
    expect(period!.link).toBeNull();
    expect(owner!.link).toBe("Ziel öffnen");
    expect(metric!.link).toBeNull();
    expect(checkin!.link).toBe("Ziel öffnen");
  });

  it("erklärt nur, was noch aussteht", () => {
    // Ein Einrichtungs-Leitfaden erklärt den Weg nach vorn. Fünf Erklärtexte,
    // von denen drei Vergangenes beschreiben, wären eine Textwand.
    leiste(GEMISCHT);
    const [, period, owner] = zeilen();

    expect(period!.text).not.toContain("Ordne dem Ziel einen Zeitraum zu");
    expect(owner!.text).toContain("Weise dem Ziel einen Verantwortlichen");
  });

  it("markiert genau einen Schritt als den nächsten", () => {
    leiste(GEMISCHT);
    const marken = screen.getAllByText("Nächster Schritt");
    expect(marken).toHaveLength(1);
    // Der erste offene: „Owner zuweisen" — nicht „Messgröße", die dahinter
    // steht und schon erledigt ist.
    expect(marken[0]!.closest("li")?.textContent).toContain("Owner zuweisen");
  });

  it("hakt eine erledigte Zeile ab und lässt sie zurücktreten", () => {
    const { container } = leiste(GEMISCHT);
    const erledigt = Array.from(container.querySelectorAll("li"))
      .filter((li) => li.querySelector(".text-success") !== null)
      .map((li) => li.textContent ?? "");

    expect(erledigt.some((t) => t.includes("Zeitraum festlegen"))).toBe(true);
    expect(erledigt.some((t) => t.includes("Messgröße"))).toBe(true);
    expect(erledigt.some((t) => t.includes("Owner zuweisen"))).toBe(false);
  });

  it("schickt den Anlegen-Schritt zum Anlegen, nicht zu einem Ziel", () => {
    leiste([]);
    const [create] = zeilen();
    expect(create!.link).toBe("Ziel anlegen");
    expect(screen.getByRole("link", { name: /Ziel anlegen/ }).getAttribute("href")).toContain(
      "new=1",
    );
  });
});
