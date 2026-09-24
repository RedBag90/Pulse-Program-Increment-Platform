import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { untranslatedLiterals, formatTextViolations } from "@/test/helpers/translated-surfaces";

/**
 * **Die Flächen, die bereits übersetzt sind, bleiben es.**
 *
 * Nach dem Vorbild des ADR-0021-Wächters nebenan: eine Liste, die mit dem
 * Umbau wächst, statt eines projektweiten Tests, der am ersten Tag rot wäre —
 * 326 von 449 Dateien trugen zu Beginn deutsche Literale.
 *
 * **Wer eine Fläche übersetzt, trägt sie hier ein.** Ab dann kann niemand mehr
 * einen rohen String hineinschreiben, ohne dass der Lauf rot wird. Am Ende der
 * Umstellung steht hier ein Verzeichnis-Durchgang statt einer Liste, und diese
 * Datei sieht aus wie `visual-language.test.tsx` heute.
 */

const SRC = join(process.cwd(), "src");

/**
 * Bereits übersetzte Flächen — der Rahmen der Anwendung.
 *
 * Navigation, Anmeldung und Fehlerseiten waren die einzigen Flächen, die von
 * Anfang an aus dem Katalog lasen. Sie sind der Anfang der Liste.
 */
const UEBERSETZT = [
  "components/nav/sidebar.tsx",
  "components/nav/topbar.tsx",
  "components/nav/mobile-nav.tsx",
  "components/nav/top-nav-mega-panel.tsx",
  "components/nav/top-nav-mega-triggers.tsx",
  "features/auth/components/sign-in-form.tsx",
  "features/auth/components/sign-up-form.tsx",
  "features/auth/components/forgot-password-form.tsx",
  "features/auth/components/reset-password-form.tsx",
  "app/[locale]/not-found.tsx",
  "app/[locale]/error.tsx",
  "app/[locale]/(dashboard)/error.tsx",

  // ── Zug 2 · das Ziele-Modul, vollständig ──────────────────────────────────
  //
  // Der Probeschnitt aus ADR-0024: ein Bereich ganz, bevor die übrigen daran
  // hängen. Domäne, Flächen und der PDF-Bericht — ab hier kann in keine davon
  // ein roher Text zurückkommen, ohne dass der Lauf rot wird.
  "modules/core/goals/domain/epic-contribution.ts",
  "modules/core/goals/domain/epic-link-access.ts",
  "modules/core/goals/domain/epic-link-invariant.ts",
  "modules/core/goals/domain/goal-activity.ts",
  "modules/core/goals/domain/goal-checkin-slot.ts",
  "modules/core/goals/domain/goal-confidence.ts",
  "modules/core/goals/domain/goal-custom-field.ts",
  "modules/core/goals/domain/goal-entry-access.ts",
  "modules/core/goals/domain/goal-filter.ts",
  "modules/core/goals/domain/goal-metric.ts",
  "modules/core/goals/domain/goal-period.ts",
  "modules/core/goals/domain/goal-progress-mode.ts",
  "modules/core/goals/domain/goal-progress-series.ts",
  "modules/core/goals/domain/goal-related-work.ts",
  "modules/core/goals/domain/goal-reparent.ts",
  "modules/core/goals/domain/goal-setup.ts",
  "modules/core/goals/domain/goal-status.ts",
  "modules/core/goals/domain/goal-tree-filter.ts",
  "modules/core/goals/domain/goals-rollup.ts",
  "modules/core/goals/domain/ziele-report.ts",
  "modules/core/goals/features/components/create-goal-dialog.tsx",
  "modules/core/goals/features/components/goal-health-strip.tsx",
  "modules/core/goals/features/components/goal-period-field.tsx",
  "modules/core/goals/features/components/goal-scope-filter-bar.tsx",
  "modules/core/goals/features/components/goal-setup-stepper.tsx",
  "modules/core/goals/features/components/goal-status/goal-activity-feed.tsx",
  "modules/core/goals/features/components/goal-status/goal-detail-panel.tsx",
  "modules/core/goals/features/components/goal-status/goal-progress-chart.tsx",
  "modules/core/goals/features/components/goal-status/goal-status-pill.tsx",
  "modules/core/goals/features/components/goal-status/goal-status-select.tsx",
  "modules/core/goals/features/components/goal-tree-picker.tsx",
  "modules/core/goals/features/components/link-list.tsx",
  "modules/core/goals/features/components/money-export-button.tsx",
  "modules/core/goals/features/components/money-sheet-view.tsx",
  "modules/core/goals/features/components/period-multi-select.tsx",
  "modules/core/goals/features/components/period-picker.tsx",
  "modules/core/goals/features/components/related-work-search.tsx",
  "modules/core/goals/features/components/strategy-alignment-view.tsx",
  "modules/core/goals/features/components/strategy-layout-toggle.tsx",
  "modules/core/goals/features/components/strategy-network-view-lazy.tsx",
  "modules/core/goals/features/components/strategy-network-view.tsx",
  "modules/core/goals/features/components/strategy-roadmap-view.tsx",
  "modules/core/goals/features/components/strategy-table-view.tsx",
  "modules/core/goals/features/components/ziele-edit-drawer.tsx",
  "modules/core/goals/features/components/ziele-report-button.tsx",
  "modules/core/goals/features/components/ziele-shell.tsx",
  "modules/core/goals/features/components/ziele-sub-tabs.tsx",
  "modules/core/goals/server/report/ziele-report-document.tsx",
];

describe("Übersetzte Flächen bleiben übersetzt", () => {
  it("führt eine Liste, die mit der Umstellung wächst", () => {
    // Schrumpft sie je, ist eine Fläche zurückgefallen.
    expect(UEBERSETZT.length).toBeGreaterThanOrEqual(60);
  });

  it("trägt in keiner davon einen rohen Text", () => {
    const violations = UEBERSETZT.flatMap((rel) => untranslatedLiterals(join(SRC, rel)));
    expect(
      violations,
      violations.length === 0
        ? ""
        : `\n${violations.length} rohe Texte:\n${formatTextViolations(violations)}\n`,
    ).toEqual([]);
  });
});
