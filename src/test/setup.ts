import "@testing-library/jest-dom";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// Vitest does not auto-cleanup DOM between tests when `globals: true` is paired
// with @testing-library/react ≥ 13 — opt in explicitly so render() output
// doesn't leak across cases.
afterEach(() => {
  cleanup();
});

/**
 * jsdom kennt `ResizeObserver` nicht. Alles, was seine Größe selbst misst,
 * bricht daran — React Flow (Netzplan, Ziel-Netz, Epic-Breakdown) und der
 * Horizont-Trichter. Die Attrappe misst nichts; sie sorgt nur dafür, dass der
 * Aufruf nicht wirft, damit sich solche Flächen überhaupt rendern lassen.
 */
if (!("ResizeObserver" in globalThis)) {
  class ResizeObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = ResizeObserverStub;
}

/** Dasselbe für die Matrix, die React Flow zum Umrechnen des Viewports nutzt. */
if (!("DOMMatrixReadOnly" in globalThis)) {
  class DOMMatrixReadOnlyStub {
    m22 = 1;
    constructor(_transform?: string) {}
  }
  (globalThis as { DOMMatrixReadOnly?: unknown }).DOMMatrixReadOnly = DOMMatrixReadOnlyStub;
}

/**
 * **`next-intl` im Test: der echte Katalog, ohne Provider.**
 *
 * Jede Komponente, die `useTranslations` aufruft, braucht sonst einen
 * `NextIntlClientProvider` um sich herum — und jede der 193 Testdateien mit
 * deutschen Zusicherungen müsste einen bekommen. Das wäre 193-mal dieselbe
 * Hülle für dieselbe Sache.
 *
 * Stattdessen steht hier **eine** Attrappe, und sie ist strenger als das
 * Original: `catalogTranslate` wirft bei einem Schlüssel, den `de.json` nicht
 * kennt. `next-intl` täte das nicht — es rendert den Schlüssel als Text, und
 * niemand merkt es, bis ein Kunde die Fläche öffnet. Ein Test, der eine
 * übersetzte Fläche rendert, prüft ab hier nebenbei mit, dass ihre Schlüssel
 * wirklich existieren.
 *
 * Die Verdrahtung selbst — Middleware, `[locale]`-Segment, Provider — prüft
 * das nicht; das ist Aufgabe des E2E-Laufs, der den Umschalter bedient.
 */
vi.mock("next-intl", async (importOriginal) => {
  const original = (await importOriginal()) as Record<string, unknown>;
  const { catalogTranslate } = await import("@/test/helpers/catalog");
  const t = catalogTranslate("de");
  return {
    ...original,
    useLocale: () => "de",
    useTranslations: (namespace?: string) => {
      const fn = (key: string, values?: Record<string, string | number>) =>
        t(namespace ? `${namespace}.${key}` : key, values);
      // `t.rich` trägt Auszeichnungen im Text (`<b>…</b>`). Im Test zählt der
      // Satz, nicht die Fettung — die Marken fallen weg, sonst stünden sie
      // wörtlich im DOM und jede Textsuche ginge daran vorbei.
      const rich = (key: string, values?: Record<string, string | number>) =>
        fn(key, values).replace(/<\/?[a-z][^>]*>/gi, "");
      return Object.assign(fn, { rich, raw: (key: string) => fn(key) });
    },
  };
});
