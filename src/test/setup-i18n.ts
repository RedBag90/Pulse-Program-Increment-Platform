import { vi } from "vitest";
import { createElement, Fragment, type ReactNode } from "react";

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
/**
 * `t.rich` wie im Original: `<b>…</b>` ruft die gleichnamige Funktion aus den
 * Werten auf, und was sie rendert, steht als eigenes Element im DOM.
 *
 * Bis September 2026 warf die Attrappe die Marken einfach weg. Solange es kaum
 * `t.rich` gab, reichte das. Mit der Umstellung aller Sätze, die an einen
 * Ausdruck grenzten, wurde daraus ein Loch: ein Link mitten im Satz
 * („… im <link>Portfolio-Dashboard</link>") war im Test kein Link mehr, und
 * eine Liste, die über eine leere Marke in den Satz kommt (`<arts></arts>`),
 * verschwand ganz.
 *
 * Verschachtelte Marken löst sie nicht auf — der Inhalt einer Marke kommt als
 * Text an. Im Katalog gibt es heute keine.
 */
function richText(
  fn: (key: string, values?: Record<string, string | number>) => string,
  key: string,
  values: Record<string, unknown> = {},
): unknown {
  const plain = Object.fromEntries(
    Object.entries(values).filter(([, v]) => typeof v !== "function"),
  ) as Record<string, string | number>;
  const text = fn(key, plain);
  const parts: unknown[] = [];
  const TAG = /<([a-zA-Z][\w-]*)>([\s\S]*?)<\/\1>/g;
  let last = 0;
  for (const m of text.matchAll(TAG)) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const render = values[m[1]!];
    parts.push(typeof render === "function" ? render(m[2]!) : m[2]!);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  if (parts.every((p) => typeof p === "string")) return parts.join("");
  return createElement(Fragment, null, ...(parts as ReactNode[]));
}

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
      const rich = (key: string, values?: Record<string, unknown>) => richText(fn, key, values);
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
      const rich = (key: string, values?: Record<string, unknown>) => richText(fn, key, values);
      return Object.assign(fn, { rich, raw: (key: string) => fn(key) });
    },
  };
});
