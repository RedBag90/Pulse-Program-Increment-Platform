import { getRequestConfig } from "next-intl/server";
import { routing, isLocale } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  // Die Middleware erkennt das Segment mit `/^\/([a-z]{2})(\/|$)/` und lässt
  // damit **jedes** Zweibuchstaben-Präfix durch. Hier wird geprüft, nicht
  // gehofft: was wir nicht führen, wird die Vorgabe.
  const locale = isLocale(requested) ? requested : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default as Record<string, unknown>,
  };
});
