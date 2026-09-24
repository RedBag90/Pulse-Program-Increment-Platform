import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { GUIDES_DE as GUIDES, guideBySlug } from "@/modules/wiki/domain/guides";
import { CADENCES } from "@/modules/wiki/domain/cadence";
import { FIGURE_KINDS, type Block } from "@/modules/wiki/domain/blocks";
import type { Station } from "@/modules/wiki/domain/guide";
import { moduleForPath, MODULE_KEYS } from "@/modules/core/kernel/domain/modules";
import { PRACTICES } from "@/modules/core/kernel/domain/operating-model";
import { POLICIES } from "@/server/auth/policies";
import { appRoutes, emittedAnchors, anchorEmitted } from "@/test/helpers/app-routes";

/**
 * Das Wiki ist ein **Blatt ueber Core** (ADR-0017): es erklaert die oberen
 * Module, ohne sie zu importieren, und verweist deshalb per String auf Routen,
 * Anker und Capabilities. Diese Tests sind die Gegenprobe zu genau dieser
 * Freiheit — sie ersetzen den Compiler dort, wo er nichts sieht.
 *
 * Der Grund steht in derselben Sitzung im Protokoll: die Rollen-Tour hatte
 * genau diesen Aufbau, aber eine Weile keinen Routen-Test — sechs von acht
 * Rollen navigierten ins Leere, ohne dass etwas rot wurde. Wer diese Tests
 * abschwaecht, holt das zurueck.
 */

const ALL_STATIONS: { guide: string; station: Station }[] = GUIDES.flatMap((g) =>
  g.perspectives.flatMap((p) => p.stations.map((station) => ({ guide: g.slug, station }))),
);

/** Jeder Block einer Anleitung — auch die in Mechanik und Stationen. */
const ALL_BLOCKS: Block[] = GUIDES.flatMap((g) => [
  ...g.mechanics,
  ...g.perspectives.flatMap((p) => p.stations.flatMap((s) => s.body)),
]);

describe("GUIDES — Aufbau", () => {
  it("Slugs sind eindeutig (sie sind die Route)", () => {
    const slugs = GUIDES.map((g) => g.slug);
    const dupes = slugs.filter((s, i) => slugs.indexOf(s) !== i);
    expect(dupes).toEqual([]);
  });

  it("Slugs sind URL-tauglich — klein, ohne Umlaute, ohne Leerzeichen", () => {
    const bad = GUIDES.map((g) => g.slug).filter((s) => !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s));
    expect(bad).toEqual([]);
  });

  it("jede Anleitung traegt Titel, Vorspann, Rhythmus und mindestens eine Perspektive", () => {
    for (const g of GUIDES) {
      expect(g.title.length, g.slug).toBeGreaterThan(3);
      expect(g.standfirst.length, g.slug).toBeGreaterThan(40);
      // Der Teaser sitzt auf einer Kachel neben bis zu drei anderen — eine
      // Zeile, kein Absatz. Die Obergrenze ist die eigentliche Aussage.
      expect(g.teaser.length, g.slug).toBeGreaterThan(10);
      expect(g.teaser.length, g.slug).toBeLessThan(90);
      expect(CADENCES, g.slug).toContain(g.cadence);
      expect(g.perspectives.length, g.slug).toBeGreaterThan(0);
      expect(g.mechanics.length, g.slug).toBeGreaterThan(0);
    }
  });

  it("jede Perspektive stellt eine Frage und hat Stationen", () => {
    for (const g of GUIDES) {
      for (const p of g.perspectives) {
        expect(p.label.length, `${g.slug}/${p.label}`).toBeGreaterThan(2);
        expect(p.question.length, `${g.slug}/${p.label}`).toBeGreaterThan(10);
        expect(p.stations.length, `${g.slug}/${p.label}`).toBeGreaterThan(0);
      }
    }
  });

  it("Perspektiven-Beschriftungen sind je Anleitung eindeutig (sie werden zu Sprungzielen)", () => {
    for (const g of GUIDES) {
      const labels = g.perspectives.map((p) => p.label);
      expect(
        labels.filter((l, i) => labels.indexOf(l) !== i),
        g.slug,
      ).toEqual([]);
    }
  });

  it("kein Slug heisst wie eine statische Schwester-Route unter /wiki", () => {
    // Next gibt einem statischen Segment den Vorrang vor `[slug]`. Eine
    // Anleitung mit dem Slug einer solchen Schwester (heute: `rollen`) waere
    // damit **stumm** unerreichbar — der Hub verlinkte sie, die Route zeigte
    // etwas anderes, und `guideBySlug` faende sie trotzdem.
    const statisch = readdirSync(join(process.cwd(), "src/app/[locale]/(dashboard)/wiki"), {
      withFileTypes: true,
    })
      .filter((e) => e.isDirectory() && !e.name.startsWith("[") && !e.name.startsWith("_"))
      .map((e) => e.name);
    expect(statisch).toContain("rollen"); // sonst prueft dieser Test nichts
    expect(GUIDES.map((g) => g.slug).filter((slug) => statisch.includes(slug))).toEqual([]);
  });

  it("guideBySlug findet jede Anleitung und nur die", () => {
    for (const g of GUIDES) expect(guideBySlug(g.slug, "de")?.guide).toBe(g);
    expect(guideBySlug("gibt-es-nicht", "de")).toBeUndefined();
  });
});

describe("GUIDES — Verweise ins echte Produkt", () => {
  const routes = appRoutes();
  const emitted = emittedAnchors();

  it("jede Route loest auf ein registriertes Modul auf (kein fail-closed-Ziel)", () => {
    const unresolved = ALL_STATIONS.filter((s) => s.station.route)
      .filter((s) => moduleForPath(s.station.route!.split("?")[0] ?? "") === null)
      .map((s) => `${s.guide}: ${s.station.title} → ${s.station.route}`);
    expect(unresolved).toEqual([]);
  });

  it("jede Route ist statisch — ein Sprungziel mit [param] fuehrt nirgendwohin", () => {
    const dynamic = ALL_STATIONS.filter((s) => s.station.route?.includes("[")).map(
      (s) => `${s.guide}: ${s.station.route}`,
    );
    expect(dynamic).toEqual([]);
  });

  it("jede Route hat eine echte page.tsx", () => {
    const missing = ALL_STATIONS.filter((s) => s.station.route)
      .filter((s) => !routes.has(s.station.route!.split("?")[0] ?? ""))
      .map((s) => `${s.guide}: ${s.station.title} → ${s.station.route}`);
    expect(missing).toEqual([]);
  });

  it("keine bekannten Legacy-Redirects als Ziel", () => {
    // Diese Pfade existieren nur noch als Weiterleitung — eine Anleitung, die
    // dorthin schickt, landet woanders als angekuendigt.
    const LEGACY = [
      "/pi-planning",
      "/rte",
      "/portfolio/budgeting",
      "/team",
      "/impediments",
      // Aufgegangen in „Meine Tasks"; die Route bleibt als Deep-Link-Ziel.
      "/my-approvals",
    ];
    const hits = ALL_STATIONS.filter((s) => LEGACY.some((l) => s.station.route?.startsWith(l))).map(
      (s) => `${s.guide}: ${s.station.route}`,
    );
    expect(hits).toEqual([]);
  });

  it("jeder genannte Anker wird im Quelltext auch ausgegeben", () => {
    const missing = ALL_STATIONS.filter((s) => s.station.anchor)
      .filter((s) => !anchorEmitted(s.station.anchor!, emitted))
      .map((s) => `${s.guide}: ${s.station.title} → ${s.station.anchor}`);
    expect(missing).toEqual([]);
  });
});

describe("GUIDES — Schluessel existieren wirklich", () => {
  it("jedes genannte Modul ist ein echter Modul-Schluessel", () => {
    const bogus = GUIDES.filter((g) => g.module != null)
      .filter((g) => !(MODULE_KEYS as readonly string[]).includes(g.module!))
      .map((g) => `${g.slug} → ${g.module}`);
    expect(bogus).toEqual([]);
  });

  it("jede genannte Practice ist eine echte Practice", () => {
    const bogus = GUIDES.filter((g) => g.practice != null)
      .filter((g) => !(PRACTICES as readonly string[]).includes(g.practice!))
      .map((g) => `${g.slug} → ${g.practice}`);
    expect(bogus).toEqual([]);
  });

  it("jede Capability in der Wer-macht-was-Tabelle existiert in POLICIES", () => {
    const bogus = GUIDES.flatMap((g) =>
      g.who
        .filter((w) => w.capability != null)
        .filter((w) => !(w.capability! in POLICIES))
        .map((w) => `${g.slug}: ${w.step} → ${w.capability}`),
    );
    expect(bogus).toEqual([]);
  });

  it("keine Referenz auf die abgeschaffte Feature-QS", () => {
    // Das QS-Gate ist am 2026-06-13 entfallen; die Actions sind inzwischen aus
    // POLICIES entfernt. Eine Anleitung dorthin fuehrte ins Leere.
    const refs = GUIDES.flatMap((g) => g.who.map((w) => w.capability))
      .filter((a): a is NonNullable<typeof a> => Boolean(a))
      .filter((a) => a.startsWith("feature.review."));
    expect(refs).toEqual([]);
  });

  it("jeder seeAlso-Slug zeigt auf eine existierende Anleitung — und nie auf sich selbst", () => {
    const bad = GUIDES.flatMap((g) =>
      g.seeAlso
        .filter((s) => s === g.slug || guideBySlug(s, "de")?.guide === undefined)
        .map((s) => `${g.slug} → ${s}`),
    );
    expect(bad).toEqual([]);
  });

  it("keine Anleitung ohne eingehende Naht — jede wird von einer anderen verwiesen", () => {
    // Die Naehte sind die einzige Navigation zwischen den Anleitungen ausser dem
    // Hub. Eine, auf die keine andere zeigt, erreicht nur, wer sie sucht — und
    // beim Schreiben faellt das nicht auf, weil man immer von ihr aus denkt.
    const inbound = new Set(GUIDES.flatMap((g) => g.seeAlso));
    const orphans = GUIDES.filter((g) => !inbound.has(g.slug)).map((g) => g.slug);
    expect(orphans).toEqual([]);
  });

  it("jede benutzte Figur ist eine bekannte Art", () => {
    const bogus = ALL_BLOCKS.filter((b) => b.kind === "figure")
      .map((b) => (b as Extract<Block, { kind: "figure" }>).figure)
      .filter((f) => !(FIGURE_KINDS as readonly string[]).includes(f));
    expect(bogus).toEqual([]);
  });
});

describe("GUIDES — Inhalt haelt, was die Form verspricht", () => {
  it("jede Station hat einen Rumpf (eine leere Station ist ein Loch im Ablauf)", () => {
    const empty = ALL_STATIONS.filter((s) => s.station.body.length === 0).map(
      (s) => `${s.guide}: ${s.station.title}`,
    );
    expect(empty).toEqual([]);
  });

  it("Tabellen sind rechteckig — jede Zeile so breit wie der Kopf", () => {
    const ragged = ALL_BLOCKS.filter((b) => b.kind === "table").flatMap((b) => {
      const t = b as Extract<Block, { kind: "table" }>;
      return t.rows
        .filter((r) => r.length !== t.head.length)
        .map((r) => `${t.head.join("|")}: ${r.length} statt ${t.head.length}`);
    });
    expect(ragged).toEqual([]);
  });

  it("Listen sind nicht leer", () => {
    const empty = ALL_BLOCKS.filter((b) => b.kind === "list").filter(
      (b) => (b as Extract<Block, { kind: "list" }>).items.length === 0,
    );
    expect(empty).toEqual([]);
  });

  it("jede Anleitung sagt, wer welchen Schritt macht", () => {
    for (const g of GUIDES) expect(g.who.length, g.slug).toBeGreaterThan(0);
  });

  it("jeder Irrtum nennt einen Satz und den Grund, warum er nicht stimmt", () => {
    for (const g of GUIDES) {
      for (const m of g.misconceptions) {
        expect(m.claim.length, g.slug).toBeGreaterThan(10);
        expect(m.why.length, g.slug).toBeGreaterThan(20);
      }
    }
  });
});
