import { describe, it, expect } from "vitest";
import { ALL_ROLES, ROLE_LABELS } from "@/modules/core/kernel/domain/roles";
import { moduleForAction, MODULE_KEYS } from "@/modules/core/kernel/domain/modules";
import { ALL_DUTIES, DUTY_LEVEL_KEYS } from "@/modules/core/org/domain/role-directory";
import { ROLE_PLAYBOOKS } from "@/modules/onboarding/domain/role-playbook";
import { appRoutes } from "@/test/helpers/app-routes";

/**
 * **Die Naht zwischen Wiki und den Modulen, die den Text besitzen.**
 *
 * `/wiki/rollen` schreibt keinen Satz selbst: die Rollen-Texte kommen aus
 * `onboarding`, die Zustaendigkeiten aus `core/org`. Das Wiki darf beides nicht
 * zusammenfuehren (ADR-0017), der App-Root schon — und genau dort kann es
 * **still** schiefgehen: faellt eine Rolle ohne Text durch, steht eine leere
 * Karte da, und niemandem faellt es auf.
 *
 * Gleiche Bauart wie `wiki-figures.test.tsx`, gleiche Begruendung.
 */

describe("Rollen-Blaetter", () => {
  it("jede Rolle aus ALL_ROLES hat Auftrag, Beschriftung und mindestens einen Satz", () => {
    const luecken = ALL_ROLES.filter((r) => {
      const p = ROLE_PLAYBOOKS[r];
      return (
        p == null ||
        p.mission.trim().length < 20 ||
        p.responsibilities.length === 0 ||
        (ROLE_LABELS[r] ?? "").length === 0
      );
    });
    expect(luecken).toEqual([]);
  });

  it("jede Uebergabe traegt Text — eine leere Zeile ist ein Loch im Zusammenspiel", () => {
    const leer = ALL_ROLES.flatMap((r) =>
      [...ROLE_PLAYBOOKS[r].responsibilities, ...ROLE_PLAYBOOKS[r].handoffs]
        .filter((c) => c.text.trim().length < 10)
        .map((c) => `${r}: ${c.text}`),
    );
    expect(leer).toEqual([]);
  });

  it("jede Capability eines Satzes loest auf ein echtes Modul auf", () => {
    // Der Kompositionsroot leitet das Sichtbarkeits-Tor aus der Capability ab.
    // Loest sie auf `null` auf, faellt der Satz durch **kein** Tor und stuende
    // auch in einem Mandanten, der das Modul nicht hat.
    const unaufloesbar = ALL_ROLES.flatMap((r) =>
      [...ROLE_PLAYBOOKS[r].responsibilities, ...ROLE_PLAYBOOKS[r].handoffs]
        .filter((c) => c.module == null && c.capability != null)
        .filter((c) => moduleForAction(c.capability!) == null)
        .map((c) => `${r}: ${c.text} → ${c.capability}`),
    );
    expect(unaufloesbar).toEqual([]);
  });

  it("jedes direkt genannte Modul ist ein echter Modul-Schluessel", () => {
    const bogus = ALL_ROLES.flatMap((r) =>
      [...ROLE_PLAYBOOKS[r].responsibilities, ...ROLE_PLAYBOOKS[r].handoffs]
        .filter((c) => c.module != null)
        .filter((c) => !(MODULE_KEYS as readonly string[]).includes(c.module!))
        .map((c) => `${r}: ${c.module}`),
    );
    expect(bogus).toEqual([]);
  });
});

describe("Zustaendigkeiten", () => {
  it("jeder Platz erscheint genau einmal", () => {
    const keys = ALL_DUTIES.map((d) => d.key);
    expect(keys.filter((k, i) => keys.indexOf(k) !== i)).toEqual([]);
  });

  it("jeder Platz traegt Anliegen, Bezeichnung und eine benannte Ebene", () => {
    const kaputt = ALL_DUTIES.filter(
      (d) => d.duty.length < 5 || d.role.length < 3 || DUTY_LEVEL_KEYS[d.level] == null,
    ).map((d) => d.key);
    expect(kaputt).toEqual([]);
  });

  it("alle drei Ebenen sind vertreten — eine leere Ebene waere ein vergessener Platz", () => {
    expect(new Set(ALL_DUTIES.map((d) => d.level))).toEqual(
      new Set(["valueStream", "art", "solution"]),
    );
  });
});

describe("Verweise der Seite", () => {
  const routes = appRoutes();

  it("die Seite selbst und jedes Sprungziel existieren", () => {
    const ziele = ["/wiki", "/wiki/rollen", "/meine-rolle", "/structure/rollen"];
    expect(ziele.filter((z) => !routes.has(z))).toEqual([]);
  });
});
