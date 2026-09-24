import de from "../../../messages/de.json";
import en from "../../../messages/en.json";
import type { Locale } from "@/i18n/routing";
import type { Translate } from "@/i18n/translate";

/**
 * **Ein Übersetzer aus dem echten Katalog — für Tests, die Wörter brauchen.**
 *
 * Das Gegenstück zu {@link identityTranslate}: der prüft Schlüssel, dieser
 * prüft, dass es die Schlüssel **gibt**. Genau das ist die Lücke, die ADR-0024
 * als gefährlich beschreibt — ein fehlender Schlüssel wirft zur Laufzeit
 * nicht, `next-intl` rendert ihn als Text. Auf einer Seite, die gerade niemand
 * ansieht, fällt das nie auf.
 *
 * Deshalb wirft dieser hier. Wer eine Fläche mit ihm durchrendert, weiss
 * danach, dass jeder Schlüssel, den sie anfasst, in **dieser** Sprache einen
 * Text hat — und der Paritätstest nebenan sorgt dafür, dass er ihn dann auch
 * in der anderen hat.
 *
 * Die Platzhalter sind bewusst simpel gehalten (`{name}` wird ersetzt, mehr
 * nicht): hier wird eine Fläche geprüft, nicht ICU nachgebaut.
 */
const KATALOGE: Record<Locale, unknown> = { de, en };

export function catalogTranslate(locale: Locale): Translate {
  const katalog = KATALOGE[locale];
  return (key, values) => {
    const text = key
      .split(".")
      .reduce<unknown>((acc, teil) => (acc as Record<string, unknown> | null)?.[teil], katalog);
    if (typeof text !== "string") {
      throw new Error(`Schlüssel fehlt in ${locale}.json: ${key}`);
    }
    if (!values) return text;
    return Object.entries(values).reduce(
      (out, [name, wert]) => out.replaceAll(`{${name}}`, String(wert)),
      text,
    );
  };
}
