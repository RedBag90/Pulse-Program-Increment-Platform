import { describe, it, expect } from "vitest";
import { ALL_ROLES } from "@/modules/core/kernel/domain/roles";
import { ALL_DUTIES } from "@/modules/core/org/domain/role-directory";
import { allEvents, eventsFor, seatKey, type EventCatalog } from "@/modules/wiki/domain/events";
import { GUIDES_DE } from "@/modules/wiki/domain/guides";

/**
 * **Welche Termine es braucht** — die Regeln, die die Seite trägt.
 *
 * Der Inhalt ist die Vorlage des Auftraggebers; geprüft wird, dass er
 * vollständig, in sich stimmig und in beiden Sprachen gleich gebaut ist.
 */

const DE = eventsFor("de");
const EN = eventsFor("en");

/** Die Struktur ohne Prosa — sie muss in beiden Sprachen gleich sein. */
function gerippe(c: EventCatalog) {
  return c.levels.map((l) => ({
    key: l.key,
    hasNote: l.note != null,
    events: l.events.map((e) => ({
      key: e.key,
      name: e.name,
      participants: e.participants.map((p) => [seatKey(p), p.part, p.prep.length]),
      seeAlso: e.seeAlso ?? [],
    })),
  }));
}

describe("Termine — Inhalt", () => {
  it("die acht Events der Vorlage, in ihrer Reihenfolge", () => {
    expect(allEvents(DE).map((e) => e.name)).toEqual([
      "Strategic Portfolio Review",
      "Portfolio Sync",
      "Participatory Budgeting",
      "PI Planning",
      "Management Review",
      "ART Sync: Coach Sync",
      "ART Sync: PO Sync",
      "System Demo",
    ]);
    expect(DE.levels.map((l) => l.key)).toEqual(["portfolio", "art"]);
  });

  it("Keys sind eindeutig und als Anker brauchbar", () => {
    const keys = [...DE.levels.map((l) => l.key), ...allEvents(DE).map((e) => e.key)];
    expect(new Set(keys).size).toBe(keys.length);
    for (const k of keys) expect(k).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("jedes Event hat genau eine leitende Rolle und keine Rolle doppelt", () => {
    for (const e of allEvents(DE)) {
      expect(
        e.participants.filter((p) => p.part === "lead"),
        e.key,
      ).toHaveLength(1);
      const rollen = e.participants.map(seatKey);
      expect(new Set(rollen).size, e.key).toBe(rollen.length);
    }
  });

  it("jede Rolle und jede Benennung gibt es in Pulse, und jede bringt etwas mit", () => {
    const benennungen = ALL_DUTIES.map((d) => d.key);
    for (const e of allEvents(DE)) {
      for (const p of e.participants) {
        const wer = `${e.key}: ${seatKey(p)}`;
        if ("role" in p) expect(ALL_ROLES, wer).toContain(p.role);
        else expect(benennungen, wer).toContain(p.duty);
        expect(p.prep.length, wer).toBeGreaterThan(0);
        for (const item of p.prep) expect(item.trim()).not.toBe("");
      }
    }
  });

  it("jede Benennung hat in beiden Sprachen einen Namen", () => {
    for (const e of allEvents(DE)) {
      for (const p of e.participants) {
        if ("role" in p) continue;
        expect(DE.dutyLabels[p.duty], `de ${p.duty}`).toBeTruthy();
        expect(EN.dutyLabels[p.duty], `en ${p.duty}`).toBeTruthy();
      }
    }
  });

  /**
   * Vorgabe des Auftraggebers (September 2026): auf ART-Ebene sitzt der
   * Produkt-Manager der Solutions des ARTs, nicht der Feature Owner. PO Sync
   * und System Demo leitet er, in PI Planning und Management Review nimmt er
   * teil.
   */
  it("der Feature Owner sitzt in keinem Termin — der Produkt-Manager an seiner Stelle", () => {
    for (const l of [DE, EN]) {
      for (const e of allEvents(l)) {
        expect(e.participants.map(seatKey), e.key).not.toContain("feature_owner");
      }
    }
    const teil = (key: string) =>
      allEvents(DE)
        .find((e) => e.key === key)!
        .participants.find((p) => seatKey(p) === "solution.product")?.part;
    expect(teil("po-sync")).toBe("lead");
    expect(teil("system-demo")).toBe("lead");
    expect(teil("pi-planning")).toBe("active");
    expect(teil("management-review")).toBe("active");
  });

  /**
   * Finance Approver, Value Stream Architect Lead und ART Technical Lead —
   * dort, wo über Geld, Architektur über ARTs hinweg oder Technik im Zug
   * entschieden wird. Keiner von ihnen leitet einen Termin.
   */
  it("die drei Benennungen sitzen, wo entschieden wird — leiten tut keiner", () => {
    const platz = (duty: string) =>
      Object.fromEntries(
        allEvents(DE).flatMap((e) =>
          e.participants.filter((p) => seatKey(p) === duty).map((p) => [e.key, p.part]),
        ),
      );
    expect(platz("vs.finance")).toEqual({
      "strategic-portfolio-review": "optional",
      "portfolio-sync": "active",
      "participatory-budgeting": "active",
    });
    expect(platz("vs.architecture")).toEqual({
      "strategic-portfolio-review": "active",
      "participatory-budgeting": "optional",
      "pi-planning": "active",
      "management-review": "optional",
    });
    expect(platz("art.technical")).toEqual({
      "pi-planning": "active",
      "management-review": "optional",
      "coach-sync": "optional",
      "po-sync": "active",
      "system-demo": "active",
    });
  });

  it("je Tabelle erst die Leitung, dann die Teilnehmer, zuletzt die optionalen", () => {
    const rang = { lead: 0, active: 1, optional: 2 } as const;
    for (const e of allEvents(DE)) {
      const r = e.participants.map((p) => rang[p.part]);
      expect(r, e.key).toEqual([...r].sort((a, b) => a - b));
    }
  });

  it("jeder Verweis zeigt auf eine Anleitung, die es gibt", () => {
    const slugs = new Set(GUIDES_DE.map((g) => g.slug));
    for (const e of allEvents(DE)) {
      for (const s of e.seeAlso ?? []) expect(slugs, `${e.key} → ${s}`).toContain(s);
    }
  });

  it("Deutsch und Englisch sind gleich gebaut — nur die Prosa unterscheidet sich", () => {
    expect(gerippe(EN)).toEqual(gerippe(DE));
    expect(EN.title).not.toBe(DE.title);
  });
});
