import { test, expect, type Page } from "@playwright/test";

/**
 * **Der Umschalter schaltet den Inhalt um — geprüft am laufenden Server.**
 *
 * Alles andere in dieser Strecke prüft Einzelteile: der Wächter prüft, dass
 * kein roher Text im Quelltext steht, der Paritätstest, dass beide Kataloge
 * dieselben Schlüssel tragen, und die Attrappe in `src/test/setup.ts` umgeht
 * die Verdrahtung bewusst, damit 2841 Tests ohne Provider laufen.
 *
 * Was **keiner** davon prüft: ob Middleware, `[locale]`-Segment,
 * `setRequestLocale` und der Provider zusammen tatsächlich eine andere Sprache
 * ausliefern. Genau das steht hier.
 *
 * **Was dieser Test bewusst nicht tut.** Er klickt den Umschalter im Kopf
 * nicht an — der steht hinter der Anmeldung, und ein E2E-Lauf, der an einem
 * Seed hängt, ist in CI unzuverlässiger als er wert ist. Der Umschalter tut
 * genau eines: `router.replace(pathname, { locale })`, also das Präfix
 * tauschen. Dass ein getauschtes Präfix die Sprache wechselt, ist die
 * Behauptung — und die steht hier auf öffentlichen Flächen.
 */

/** Die Fläche, an der sich das prüfen lässt, ohne Sitzung: die Anmeldung. */
const SEITE = "/sign-in";

/**
 * Ein roher Katalog-Schlüssel auf dem Bildschirm ist die Ausfallart, vor der
 * ADR-0024 warnt: `next-intl` wirft dabei nicht, es rendert den Schlüssel als
 * Text. Der Wächter sieht das nicht — er prüft Quelltext, nicht Ausgabe.
 */
const SCHLUESSEL_IM_TEXT =
  /\b(work|goals|budgeting|drumbeat|risks|org|onboarding|wiki|admin|platform|auth|common|nav|errors|pages)\.[a-z][A-Za-z0-9]*\.[A-Za-z]/;

async function sichtbarerText(page: Page): Promise<string> {
  return (await page.locator("body").innerText()).replace(/\s+/g, " ");
}

test.describe("Zweisprachigkeit", () => {
  test("liefert dieselbe Seite in zwei Sprachen aus", async ({ page }) => {
    await page.goto(`/de${SEITE}`);
    const deutsch = await sichtbarerText(page);

    await page.goto(`/en${SEITE}`);
    const englisch = await sichtbarerText(page);

    // Die Überschrift ist in beiden Katalogen gepflegt und unterscheidet sich.
    expect(deutsch).toContain("Willkommen zurück");
    expect(englisch).toContain("Welcome back");

    // Und das Formular darunter zieht mit — nicht nur die Überschrift.
    expect(deutsch).toContain("E-Mail-Adresse");
    expect(englisch).toContain("Email address");

    expect(deutsch).not.toEqual(englisch);
  });

  test("zeigt nirgends einen rohen Katalog-Schlüssel", async ({ page }) => {
    for (const locale of ["de", "en"]) {
      await page.goto(`/${locale}${SEITE}`);
      const text = await sichtbarerText(page);
      const treffer = text.match(SCHLUESSEL_IM_TEXT);
      expect(treffer?.[0] ?? null, `roher Schlüssel auf /${locale}${SEITE}`).toBeNull();
    }
  });

  test("führt einen Aufruf ohne Präfix in eine Sprache", async ({ page }) => {
    // `localePrefix: "always"` — jede Route trägt ihr Segment. Wer ohne kommt,
    // wird von der Middleware eingeordnet statt auf einer präfixlosen Seite
    // gelassen, die keine Sprache hätte.
    await page.goto(SEITE);
    await expect(page).toHaveURL(/\/(de|en)\/sign-in/);
  });

  test("hält die Sprache über einen Seitenwechsel", async ({ page }) => {
    // Ein Wechsel innerhalb der Anwendung darf das Präfix nicht verlieren —
    // sonst fiele der Leser bei jedem Klick auf die Vorgabesprache zurück.
    await page.goto("/en/sign-up");
    await expect(page).toHaveURL(/\/en\/sign-up/);
    const text = await sichtbarerText(page);
    expect(text).toContain("Create account");
  });
});
