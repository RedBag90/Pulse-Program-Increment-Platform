import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ClassificationDriftDialog } from "@/modules/work/features/portfolio/components/gate/classification-drift-dialog";
import { EpicClassBadge } from "@/modules/work/features/portfolio/components/epic-class-badge";

/**
 * **Die Einordnung auf Englisch — ganze Sätze, englische Beträge.**
 *
 * Bis September 2026 standen Dialog und Badge als JSX-Text zwischen
 * Ausdrücken: auf der englischen Oberfläche las man „Angelegt wurde dieses
 * Epic als ART epic. Der Business Case beziffert die Umsetzung auf 32.000 €
 * über dem Portfolio-Limit …". Der globale Test-Aufbau übersetzt deutsch
 * (`setup-i18n.ts`); diese Datei stellt auf den englischen Katalog um, denn
 * genau die zweite Sprache war der Fehler.
 */
vi.mock("next-intl", async (importOriginal) => {
  const original = (await importOriginal()) as Record<string, unknown>;
  const { catalogTranslate } = await import("@/test/helpers/catalog");
  const t = catalogTranslate("en");
  const fn = (key: string, values?: Record<string, string | number>) => t(key, values);
  const rich = (key: string, values?: Record<string, unknown>) =>
    fn(
      key,
      Object.fromEntries(
        Object.entries(values ?? {}).filter(([, v]) => typeof v !== "function"),
      ) as Record<string, string | number>,
    ).replace(/<\/?[a-z][^>]*>/gi, "");
  return {
    ...original,
    useLocale: () => "en",
    useTranslations: () => Object.assign(fn, { rich, raw: fn }),
  };
});

const GERMAN = /Angelegt|beziffert|Kosten|Finanziert|über|unter dem/;

describe("ClassificationDriftDialog (en)", () => {
  it("nennt die Richtung nach oben als englischen Satz mit englischem Betrag", () => {
    render(
      <ClassificationDriftDialog
        epicId="e1"
        open
        onOpenChange={() => {}}
        onProceed={() => {}}
        info={{
          drift: "up",
          intended: "art",
          derived: "portfolio",
          cost: 32_000,
          threshold: 25_000,
          valueStreamId: "vs",
          canOverride: false,
        }}
      />,
    );
    const text = document.body.textContent ?? "";
    expect(text).toContain("This epic was created as an ART epic.");
    expect(text).toContain("€32,000");
    expect(text).toContain("above the portfolio limit of €25,000");
    expect(text).toContain("switches the classification to portfolio epic");
    expect(text).not.toMatch(GERMAN);
  });

  it("nach unten ebenso", () => {
    render(
      <ClassificationDriftDialog
        epicId="e1"
        open
        onOpenChange={() => {}}
        onProceed={() => {}}
        info={{
          drift: "down",
          intended: "portfolio",
          derived: "art",
          cost: 7_000,
          threshold: 25_000,
          valueStreamId: "vs",
          canOverride: true,
        }}
      />,
    );
    const text = document.body.textContent ?? "";
    expect(text).toContain("below the portfolio limit of €25,000");
    expect(screen.getByText("Keep as a portfolio matter")).toBeTruthy();
    expect(text).not.toMatch(GERMAN);
  });
});

describe("EpicClassBadge (en)", () => {
  it("die Abweichung und die Rechnung stehen englisch da", () => {
    render(
      <EpicClassBadge
        classification={{ epicClass: "art", cost: 7_000, threshold: 25_000, overridden: false }}
        source="tenant"
        intended="portfolio"
        fundingGap="noPot"
      />,
    );
    const text = document.body.textContent ?? "";
    expect(text).toContain(
      "This epic was created as a portfolio epic — its cost makes it an ART epic.",
    );
    expect(text).toContain("Cost €7,000, below the portfolio limit of €25,000");
    expect(text).toContain("No ART budget exists for this epic's ART.");
    expect(text).not.toMatch(GERMAN);
  });
});
