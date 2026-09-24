import type { Locale } from "@/i18n/routing";
import type { Guide } from "@/modules/wiki/domain/guide";

import { TENANT_ONBOARDING } from "@/modules/wiki/domain/guides/de/tenant-onboarding";
import { PORTFOLIO_SETUP } from "@/modules/wiki/domain/guides/de/portfolio-setup";
import { EPIC_INTAKE } from "@/modules/wiki/domain/guides/de/epic-intake";
import { EPIC_LIFECYCLE } from "@/modules/wiki/domain/guides/de/epic-lifecycle";
import { DELIVERY } from "@/modules/wiki/domain/guides/de/delivery";
import { PI } from "@/modules/wiki/domain/guides/de/pi";
import { RISK } from "@/modules/wiki/domain/guides/de/risk";
import { BENEFIT } from "@/modules/wiki/domain/guides/de/benefit";
import { PORTFOLIO_CYCLE } from "@/modules/wiki/domain/guides/de/portfolio-cycle";
import { BUDGETING } from "@/modules/wiki/domain/guides/de/budgeting";
import { ART_EPIC_BUDGET } from "@/modules/wiki/domain/guides/de/art-epic-budget";

import { ART_EPIC_BUDGET_EN } from "@/modules/wiki/domain/guides/en/art-epic-budget";
import { BENEFIT_EN } from "@/modules/wiki/domain/guides/en/benefit";
import { BUDGETING_EN } from "@/modules/wiki/domain/guides/en/budgeting";
import { DELIVERY_EN } from "@/modules/wiki/domain/guides/en/delivery";
import { EPIC_INTAKE_EN } from "@/modules/wiki/domain/guides/en/epic-intake";
import { EPIC_LIFECYCLE_EN } from "@/modules/wiki/domain/guides/en/epic-lifecycle";
import { PI_EN } from "@/modules/wiki/domain/guides/en/pi";
import { PORTFOLIO_CYCLE_EN } from "@/modules/wiki/domain/guides/en/portfolio-cycle";
import { PORTFOLIO_SETUP_EN } from "@/modules/wiki/domain/guides/en/portfolio-setup";
import { RISK_EN } from "@/modules/wiki/domain/guides/en/risk";
import { TENANT_ONBOARDING_EN } from "@/modules/wiki/domain/guides/en/tenant-onboarding";

/**
 * **Die Anleitungen liegen je Sprache als eigene Datei, nicht im Katalog.**
 *
 * Für Etiketten und Sätze ist der Katalog richtig; für 200.000 Zeichen
 * Fachprosa wäre er es nicht. Zweitausend Schlüssel mit Absätzen darin liest
 * niemand, und wer später eine Formulierung schärfen will, müsste sie aus
 * `de.json` heraussuchen, statt den Text im Zusammenhang zu lesen. ADR-0024
 * benennt dieses Muster bereits für die E-Mail-Vorlage: **zwei Fassungen, eine
 * je Sprache**, statt eines Satzes mit Platzhaltern.
 *
 * Die **Struktur** bleibt dabei geteilt: `slug`, `cadence`, `module`,
 * `practice` und die `capability` in `who` stehen in beiden Fassungen gleich,
 * weil sie Logik sind. Dass sie nicht auseinanderlaufen, prüft
 * `__tests__/guides-parity.test.ts`.
 *
 * **Die Übersetzung läuft noch.** Was auf Englisch fehlt, kommt auf Deutsch —
 * sichtbar gekennzeichnet, nicht stillschweigend. Eine fehlende Anleitung zu
 * verstecken wäre schlimmer: das Wiki sähe auf `/en/` kaputt aus statt
 * unvollständig.
 */
const DE: readonly Guide[] = [
  TENANT_ONBOARDING,
  PORTFOLIO_SETUP,
  EPIC_INTAKE,
  EPIC_LIFECYCLE,
  BENEFIT,
  PORTFOLIO_CYCLE,
  BUDGETING,
  ART_EPIC_BUDGET,
  PI,
  DELIVERY,
  RISK,
];

/** Was bereits übersetzt ist, nach Slug. Wächst mit der Redaktionsarbeit. */
const EN_BY_SLUG: Record<string, Guide> = {
  [ART_EPIC_BUDGET_EN.slug]: ART_EPIC_BUDGET_EN,
  [BENEFIT_EN.slug]: BENEFIT_EN,
  [BUDGETING_EN.slug]: BUDGETING_EN,
  [DELIVERY_EN.slug]: DELIVERY_EN,
  [EPIC_INTAKE_EN.slug]: EPIC_INTAKE_EN,
  [EPIC_LIFECYCLE_EN.slug]: EPIC_LIFECYCLE_EN,
  [PI_EN.slug]: PI_EN,
  [PORTFOLIO_CYCLE_EN.slug]: PORTFOLIO_CYCLE_EN,
  [PORTFOLIO_SETUP_EN.slug]: PORTFOLIO_SETUP_EN,
  [RISK_EN.slug]: RISK_EN,
  [TENANT_ONBOARDING_EN.slug]: TENANT_ONBOARDING_EN,
};

/** Eine Anleitung mit dem Vermerk, ob sie in der gewünschten Sprache vorliegt. */
export interface LocalizedGuide {
  guide: Guide;
  /** `false` ⇒ die deutsche Fassung, weil noch keine englische existiert. */
  translated: boolean;
}

/**
 * Alle Anleitungen, **in der Reihenfolge des Bogens** — erst der Rhythmus, dann
 * innerhalb dessen die zeitliche Folge. Der Hub gruppiert daraus; die
 * Reihenfolge hier ist die Quelle, keine Sortierung im Renderer.
 */
export function guidesFor(locale: Locale): LocalizedGuide[] {
  return DE.map((de) => {
    const en = locale === "en" ? EN_BY_SLUG[de.slug] : undefined;
    return en ? { guide: en, translated: true } : { guide: de, translated: locale === "de" };
  });
}

/** Nachschlagen über den Slug — die Detailseite bekommt ihn aus der Route. */
export function guideBySlug(slug: string, locale: Locale): LocalizedGuide | undefined {
  return guidesFor(locale).find((g) => g.guide.slug === slug);
}

/** Die deutschen Fassungen — die Quelle, gegen die der Paritätstest prüft. */
export const GUIDES_DE = DE;

/** Die vorhandenen englischen Fassungen, nach Slug. */
export const GUIDES_EN = EN_BY_SLUG;
