import { describe, it, expect } from "vitest";
import { allEvents, eventsFor } from "@/modules/wiki/domain/events";
import type { MeetingKey } from "@/modules/work/features/portfolio/overview/meeting-header";

/**
 * **Die Meeting-Ansichten der Portfolio-Übersicht verlinken ins Wiki** — auf
 * `/wiki/termine#<key>`. Work darf das Wiki nicht importieren (ADR-0017), also
 * stehen die Schlüssel dort als Text. Hier, in der Composition Root, die beide
 * sehen darf, wird geprüft, dass es die Anker wirklich gibt.
 */
describe("Portfolio-Meetings ↔ Wiki-Termine", () => {
  it("jeder Meeting-Schlüssel ist ein Event der Portfolio-Ebene im Wiki", () => {
    const portfolio = eventsFor("de").levels.find((l) => l.key === "portfolio")!;
    const keys: MeetingKey[] = [
      "strategic-portfolio-review",
      "portfolio-sync",
      "participatory-budgeting",
    ];
    expect(portfolio.events.map((e) => e.key)).toEqual(keys);
    for (const k of keys) expect(allEvents(eventsFor("en")).map((e) => e.key)).toContain(k);
  });
});
