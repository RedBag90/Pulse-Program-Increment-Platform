import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { NAV_GROUPS } from "@/components/nav/nav-config";
import { ROLE_PLAYBOOKS, type PlaybookClaim, type TourStep } from "../role-playbook";
import { ALL_ROLES, type Role } from "@/modules/core/kernel/domain/roles";
import { moduleForPath, MODULE_KEYS } from "@/modules/core/kernel/domain/modules";
import { routePath } from "../role-tour";
import { POLICIES, type Action } from "@/server/auth/policies";
import { ROLES } from "@/modules/core/kernel/domain/roles";

/**
 * Das Modul `onboarding` ist ein Blatt (ADR-0017): es erklärt die oberen Module,
 * ohne sie zu importieren, und verweist deshalb per String auf Routen und
 * Capabilities. Diese Tests sind die Gegenprobe zu genau dieser Freiheit — sie
 * ersetzen den Compiler dort, wo er nichts sieht. Wer sie abschwächt, hebt die
 * Kapselung faktisch auf.
 */

const ALL_STEPS: readonly TourStep[] = ALL_ROLES.flatMap((r) => ROLE_PLAYBOOKS[r].steps);
const ALL_CLAIMS: readonly PlaybookClaim[] = ALL_ROLES.flatMap((r) => [
  ...ROLE_PLAYBOOKS[r].responsibilities,
  ...ROLE_PLAYBOOKS[r].handoffs,
]);

/** Darf `role` die `action` laut Registry? Admin-Bypass wie in authorize(). */
function roleMayPerform(role: Role, action: Action): boolean {
  if (role === ROLES.PLATFORM_ADMIN || role === ROLES.TENANT_ADMIN) return true;
  return (POLICIES[action] ?? []).some((g) => g.roles.includes(role));
}

describe("ROLE_PLAYBOOKS — Vollständigkeit", () => {
  it("jede Rolle hat ein Playbook, und es beschreibt sich selbst", () => {
    for (const role of ALL_ROLES) {
      const pb = ROLE_PLAYBOOKS[role];
      expect(pb, `Playbook fehlt: ${role}`).toBeDefined();
      expect(pb.role).toBe(role);
      expect(pb.mission.length).toBeGreaterThan(20);
      expect(pb.responsibilities.length).toBeGreaterThan(0);
      expect(pb.steps.length).toBeGreaterThan(0);
    }
  });

  it("Schritt-Keys sind global eindeutig (sie sind der Persistenz-Schlüssel)", () => {
    const keys = ALL_STEPS.map((s) => s.key);
    const dupes = keys.filter((k, i) => keys.indexOf(k) !== i);
    expect(dupes).toEqual([]);
  });

  it("Schritt-Keys sind nach ihrer Rolle benannt — sonst driften sie unbemerkt", () => {
    for (const role of ALL_ROLES) {
      const wrong = ROLE_PLAYBOOKS[role].steps
        .map((s) => s.key)
        .filter((k) => !k.startsWith(`${role}.`));
      expect(wrong, `falsch präfigiert in ${role}`).toEqual([]);
    }
  });
});

describe("ROLE_PLAYBOOKS — Routen zeigen ins echte Produkt", () => {
  it("jede Route löst auf ein registriertes Modul auf (kein fail-closed-Ziel)", () => {
    const unresolved = ALL_STEPS.filter((s) => moduleForPath(routePath(s.route)) === null).map(
      (s) => `${s.key} → ${s.route}`,
    );
    expect(unresolved).toEqual([]);
  });

  it("jede Route ist statisch — die Tour muss konkret dorthin navigieren können", () => {
    const dynamic = ALL_STEPS.filter((s) => s.route.includes("[")).map((s) => s.key);
    expect(dynamic).toEqual([]);
  });

  it("jede Route hat eine echte page.tsx (fängt Rückbauten wie den Team-Teardown)", () => {
    const base = join(process.cwd(), "src/app/[locale]/(dashboard)");

    // Routen-Gruppen (`(organisation)`) verändern die Adresse nicht, wohl aber
    // den Ordnerpfad. Deshalb wird der Baum abgelaufen und je `page.tsx` die
    // Route rekonstruiert, statt den Pfad direkt zusammenzusetzen.
    const routes = new Set<string>();
    const walk = (dir: string, route: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          const isGroup = entry.name.startsWith("(") && entry.name.endsWith(")");
          walk(join(dir, entry.name), isGroup ? route : `${route}/${entry.name}`);
        } else if (entry.name === "page.tsx") {
          routes.add(route === "" ? "/" : route);
        }
      }
    };
    walk(base, "");

    const missing = ALL_STEPS.filter((s) => !routes.has(s.route.split("?")[0] ?? "")).map(
      (s) => `${s.key} → ${s.route}`,
    );
    expect(missing).toEqual([]);
  });

  it("keine bekannten Legacy-Redirects als Ziel", () => {
    // Diese Pfade existieren nur noch als Weiterleitung — eine Tour, die dorthin
    // springt, landet woanders als angekündigt.
    const LEGACY = ["/pi-planning", "/rte", "/portfolio/budgeting", "/team"];
    const hits = ALL_STEPS.filter((s) => LEGACY.some((l) => s.route.startsWith(l))).map(
      (s) => s.key,
    );
    expect(hits).toEqual([]);
  });
});

describe("ROLE_PLAYBOOKS — Anker zeigen auf echte Elemente", () => {
  /**
   * Der wichtigste Test dieser Datei. Ohne ihn sind 11 von 13 Ankern ins Leere
   * gelaufen, ohne dass irgendetwas rot wurde — die Tour ist dadurch stillschweigend
   * zu einer Kette zentrierter Karten geworden. Ein fehlender Anker ist kein
   * Absturz, sondern ein Fallback; genau deshalb braucht es eine explizite Prüfung.
   */
  const SRC = join(process.cwd(), "src");

  /** Alle `data-tour`-Werte, die im Quelltext wirklich ausgegeben werden. */
  function emittedAnchors(): { literals: Set<string>; prefixes: string[] } {
    const literals = new Set<string>();
    const prefixes: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(p);
          continue;
        }
        if (!entry.name.endsWith(".tsx")) continue;
        const src = readFileSync(p, "utf8");
        for (const m of src.matchAll(/data-tour="([^"]+)"/g)) literals.add(m[1]!);
        // Template-Anker wie `group:${group.labelKey}` → nur der Präfix ist statisch.
        for (const m of src.matchAll(/data-tour=\{`([a-z-]+:?[a-z-]*)\$\{/g)) prefixes.push(m[1]!);
      }
    };
    walk(SRC);
    return { literals, prefixes };
  }

  const { literals, prefixes } = emittedAnchors();

  it("jeder referenzierte Anker wird im Quelltext auch ausgegeben", () => {
    const missing = ALL_STEPS.filter((s) => s.anchor)
      .filter((s) => {
        const a = s.anchor!;
        return !literals.has(a) && !prefixes.some((p) => a.startsWith(p));
      })
      .map((s) => `${s.key} → ${s.anchor}`);
    expect(missing).toEqual([]);
  });

  it("Gruppen-Anker nennen eine echte Nav-Gruppe", () => {
    const groupKeys = new Set(NAV_GROUPS.map((g) => g.labelKey));
    const bogus = ALL_STEPS.map((s) => s.anchor)
      .filter((a): a is string => Boolean(a?.startsWith("group:")))
      .filter((a) => !groupKeys.has(a.slice("group:".length)));
    expect(bogus).toEqual([]);
  });

  it("die Mehrheit der Schritte ist verankert — sonst ist es wieder eine Popup-Kette", () => {
    const anchored = ALL_STEPS.filter((s) => s.anchor).length;
    expect(anchored / ALL_STEPS.length).toBeGreaterThan(0.8);
  });
});

describe("ROLE_PLAYBOOKS — Rechte decken die Aussagen", () => {
  it("jede Schritt-Capability ist der Rolle laut POLICIES tatsächlich gewährt", () => {
    const overreach: string[] = [];
    for (const role of ALL_ROLES) {
      for (const step of ROLE_PLAYBOOKS[role].steps) {
        if (step.capability && !roleMayPerform(role, step.capability)) {
          overreach.push(`${step.key} verlangt ${step.capability}`);
        }
      }
    }
    expect(overreach).toEqual([]);
  });

  it("jede Verantwortungs-/Übergabe-Capability ist ebenfalls gedeckt", () => {
    const overreach: string[] = [];
    for (const role of ALL_ROLES) {
      const claims = [...ROLE_PLAYBOOKS[role].responsibilities, ...ROLE_PLAYBOOKS[role].handoffs];
      for (const c of claims) {
        if (c.capability && !roleMayPerform(role, c.capability)) {
          overreach.push(`${role}: „${c.text.slice(0, 40)}…“ verlangt ${c.capability}`);
        }
      }
    }
    expect(overreach).toEqual([]);
  });

  it("keine Referenz auf die abgeschaffte Feature-QS", () => {
    // Das QS-Gate ist am 2026-06-13 entfallen; die Actions existieren nur noch
    // als Registry-Leichen. Ein Tour-Schritt dorthin würde ins Leere führen.
    const refs = [...ALL_STEPS.map((s) => s.capability), ...ALL_CLAIMS.map((c) => c.capability)]
      .filter((a): a is Action => Boolean(a))
      .filter((a) => a.startsWith("feature.review."));
    expect(refs).toEqual([]);
  });

  it("Modul-Gates an Claims nennen echte Modul-Keys", () => {
    const bogus = ALL_CLAIMS.map((c) => c.module)
      .filter((m): m is NonNullable<typeof m> => Boolean(m))
      .filter((m) => !MODULE_KEYS.includes(m));
    expect(bogus).toEqual([]);
  });
});

describe("ROLE_PLAYBOOKS — inhaltliche Leitplanken", () => {
  it("die Mission ist modulneutral (sie wird immer gezeigt, auch im reinen Core-Tenant)", () => {
    // Nennt die Mission eine Fläche, die hinter einem Modul liegt, verspricht sie
    // im Free-Tenant etwas, das der Nutzer nicht sieht.
    const MODULE_WORDS = ["PI ", "Program Increment", "Budget", "Feature-Backlog", "Risk-Register"];
    const leaky = ALL_ROLES.filter((r) =>
      MODULE_WORDS.some((w) => ROLE_PLAYBOOKS[r].mission.includes(w)),
    );
    expect(leaky).toEqual([]);
  });

  it("jede Aussage über eine modulgebundene Fachlichkeit trägt ein Gate", () => {
    // Ohne Gate erscheint das Bullet auch in einem Tenant, der das Modul gar
    // nicht gebucht hat — und verspricht Verantwortung, die es dort nicht gibt.
    // Ein `capability`-Gate genügt: `role-tour.ts` leitet daraus das Modul ab.
    const MODULE_CONCEPTS =
      /\b(Epics?|Features?|PIs?|Program Increments?|Impediments?|Abhängigkeiten|Budget\w*|Risiko|Risiken|Wertnachweis)\b/;
    const ungated = ALL_CLAIMS.filter(
      (c) => MODULE_CONCEPTS.test(c.text) && !c.capability && !c.practice && !c.module,
    ).map((c) => c.text.slice(0, 60));
    expect(ungated).toEqual([]);
  });

  it("Teams kommen nicht mehr vor (Team-Rückbau fd8164a)", () => {
    const texts = [
      ...ALL_ROLES.map((r) => ROLE_PLAYBOOKS[r].mission),
      ...ALL_CLAIMS.map((c) => c.text),
      ...ALL_STEPS.flatMap((s) => [s.title, s.body]),
    ];
    const hits = texts.filter((t) => /\bTeams?\b/.test(t));
    expect(hits).toEqual([]);
  });
});
