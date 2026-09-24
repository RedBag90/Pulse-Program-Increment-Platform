import { describe, it, expect } from "vitest";
import { GUIDES_DE, GUIDES_EN, guidesFor } from "@/modules/wiki/domain/guides";
import type { Guide } from "@/modules/wiki/domain/guide";

/**
 * **Zwei Fassungen, eine Struktur.**
 *
 * Die Anleitungen liegen je Sprache als eigene Datei — richtig für 200.000
 * Zeichen Fachprosa, aber teuer erkauft: zwei Dateien können auseinanderlaufen,
 * und ein Katalog-Paritätstest greift hier nicht, weil nichts im Katalog steht.
 *
 * Dieser Test ist der Ersatz. Er prüft **nur**, was Logik ist und in beiden
 * Sprachen gleich sein muss: der Slug, der Rhythmus, das Modul, die Practice
 * und die Capabilities in „Wer welchen Schritt macht". Die Wörter prüft er
 * bewusst nicht — sonst wäre er ein Test gegen das Übersetzen.
 *
 * **Eine unvollständige Übersetzung ist kein Fehler.** Solange eine englische
 * Fassung fehlt, zeigt `guidesFor("en")` die deutsche mit `translated: false`;
 * der Leser sieht einen Hinweis. Rot wird dieser Test erst, wenn eine
 * vorhandene englische Fassung die Struktur ihrer deutschen verlässt.
 */

const struktur = (g: Guide) => ({
  slug: g.slug,
  cadence: g.cadence,
  module: g.module ?? null,
  practice: g.practice ?? null,
  seeAlso: [...g.seeAlso].sort(),
  perspektiven: g.perspectives.map((p) => ({
    role: p.role ?? null,
    stationen: p.stations.length,
  })),
  wer: g.who.map((w) => w.capability ?? null),
  missverstaendnisse: g.misconceptions.length,
});

describe("Anleitungen — Struktur-Parität zwischen den Sprachen", () => {
  it("führt für jeden übersetzten Slug eine deutsche Fassung", () => {
    for (const slug of Object.keys(GUIDES_EN)) {
      expect(
        GUIDES_DE.some((g) => g.slug === slug),
        `englische Anleitung ohne deutsche: ${slug}`,
      ).toBe(true);
    }
  });

  it("hält Slug, Rhythmus, Modul und Capabilities in beiden Sprachen gleich", () => {
    for (const [slug, en] of Object.entries(GUIDES_EN)) {
      const de = GUIDES_DE.find((g) => g.slug === slug);
      expect(de, slug).toBeDefined();
      expect(struktur(en), `Struktur weicht ab: ${slug}`).toEqual(struktur(de!));
    }
  });

  it("markiert die noch nicht übersetzten Anleitungen, statt sie zu verstecken", () => {
    const en = guidesFor("en");
    // Alle elf sind da — nur eben teils auf Deutsch.
    expect(en).toHaveLength(GUIDES_DE.length);
    const fehlend = en.filter((g) => !g.translated).map((g) => g.guide.slug);
    const uebersetzt = en.filter((g) => g.translated).map((g) => g.guide.slug);
    expect([...fehlend, ...uebersetzt].sort()).toEqual(GUIDES_DE.map((g) => g.slug).sort());
    // Auf Deutsch gilt jede als übersetzt — es ist die Quellsprache.
    expect(guidesFor("de").every((g) => g.translated)).toBe(true);
  });
});
