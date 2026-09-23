import { defineRouting } from "next-intl/routing";

/**
 * **Zwei Sprachen, und beide sollen etwas zeigen.**
 *
 * Die Vorgabe stand bis September 2026 auf `en` — wer ohne Cookie kam, landete
 * auf `/en/` und bekam **deutsche Inhalte mit englischer Navigation**, also die
 * schlechteste der drei möglichen Fassungen. Solange die Übersetzung läuft, ist
 * Deutsch die ehrliche Vorgabe; sie beschreibt, was die Oberfläche tatsächlich
 * spricht.
 *
 * `localePrefix: "always"` bleibt: jede URL trägt ihre Sprache sichtbar, und
 * ein geteilter Link zeigt beim Empfänger dieselbe Fassung wie beim Absender.
 *
 * **Die Route-Segmente bleiben deutsch** (`/ziele`, `/umsetzung`) und gelten
 * unverändert unter `/en/`. Eine `pathnames`-Übersetzung bräche jedes
 * bestehende Lesezeichen und jeden Deep-Link aus versendeten E-Mails; sie kann
 * später nachgezogen werden, wenn es jemanden stört.
 */
export const routing = defineRouting({
  locales: ["en", "de"],
  defaultLocale: "de",
  localePrefix: "always",
});

/** Die unterstützten Sprachen als Typ — für alles, was einen Locale durchreicht. */
export type Locale = (typeof routing.locales)[number];

/** Schmaler Typwächter: ist das ein Locale, das wir führen? */
export function isLocale(value: string | null | undefined): value is Locale {
  return value != null && (routing.locales as readonly string[]).includes(value);
}
