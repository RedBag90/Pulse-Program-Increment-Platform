import type { Guide } from "@/modules/wiki/domain/guide";
import { TENANT_ONBOARDING } from "@/modules/wiki/domain/guides/tenant-onboarding";
import { PORTFOLIO_SETUP } from "@/modules/wiki/domain/guides/portfolio-setup";
import { EPIC_INTAKE } from "@/modules/wiki/domain/guides/epic-intake";
import { EPIC_LIFECYCLE } from "@/modules/wiki/domain/guides/epic-lifecycle";
import { DELIVERY } from "@/modules/wiki/domain/guides/delivery";
import { PI } from "@/modules/wiki/domain/guides/pi";
import { RISK } from "@/modules/wiki/domain/guides/risk";
import { BENEFIT } from "@/modules/wiki/domain/guides/benefit";
import { PORTFOLIO_CYCLE } from "@/modules/wiki/domain/guides/portfolio-cycle";
import { BUDGETING } from "@/modules/wiki/domain/guides/budgeting";
import { ART_EPIC_BUDGET } from "@/modules/wiki/domain/guides/art-epic-budget";

/**
 * Alle Anleitungen, **in der Reihenfolge des Bogens** — erst der Rhythmus, dann
 * innerhalb dessen die zeitliche Folge. Der Hub gruppiert daraus; die Reihenfolge
 * hier ist die Quelle, keine Sortierung im Renderer.
 *
 * Eine Datei je Anleitung: elf volle Durchlaeufe in einer Datei waeren
 * unlesbar.
 */
export const GUIDES: readonly Guide[] = [
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

/** Nachschlagen ueber den Slug — die Detailseite bekommt ihn aus der Route. */
export function guideBySlug(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}
