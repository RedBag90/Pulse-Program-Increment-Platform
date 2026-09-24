import { vi } from "vitest";

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

/**
 * **Dasselbe für `next-intl/server`.**
 *
 * `getTranslations` verlangt einen Request und wirft in einer
 * Client-Umgebung ausdrücklich („not supported in Client Components"). Das
 * trifft hier nicht die Anwendung, sondern den Lauf: eine Server-Action wird
 * vom Browser *aufgerufen*, läuft aber auf dem Server — im Test wird ihr Modul
 * trotzdem im jsdom-Projekt ausgewertet, sobald eine Komponente sie importiert.
 *
 * Es gilt derselbe Handel wie oben: der echte Katalog statt einer Attrappe,
 * und ein unbekannter Schlüssel wirft.
 */
vi.mock("next-intl/server", async (importOriginal) => {
  const original = (await importOriginal()) as Record<string, unknown>;
  const { catalogTranslate } = await import("@/test/helpers/catalog");
  const t = catalogTranslate("de");
  return {
    ...original,
    getLocale: async () => "de",
    // `getTranslations` kennt zwei Aufrufformen: einen Namensraum als
    // Zeichenkette, oder ein Objekt `{ locale, namespace }` — die zweite
    // braucht die API-Naht, die ihre Sprache aus `Accept-Language` liest und
    // sie deshalb ausdrücklich mitgeben muss. Wer nur die erste nachbildet,
    // baut aus dem Objekt den Schlüssel `[object Object].…`.
    getTranslations: async (arg?: string | { locale?: string; namespace?: string }) => {
      const namespace = typeof arg === "string" ? arg : arg?.namespace;
      const fn = (key: string, values?: Record<string, string | number>) =>
        t(namespace ? `${namespace}.${key}` : key, values);
      const rich = (key: string, values?: Record<string, string | number>) =>
        fn(key, values).replace(/<\/?[a-z][^>]*>/gi, "");
      return Object.assign(fn, { rich, raw: (key: string) => fn(key) });
    },
  };
});
