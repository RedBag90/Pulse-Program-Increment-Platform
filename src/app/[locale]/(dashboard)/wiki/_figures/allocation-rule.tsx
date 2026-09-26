import { useTranslations } from "next-intl";
import { GATE_STEPS, gateOfStep, gateStepNumberLabel } from "@/modules/work/domain/stage-gate";
import {
  mayHoldAllocation,
  requiresCurrentAllocation,
} from "@/modules/budgeting/domain/allocation-eligibility";
import { STAGE_SHORT_KEYS } from "@/components/detail/initiative-labels";

/**
 * **Wer darf Budget tragen — und wer muss?**
 *
 * Beide Spalten kommen aus den zwei Praedikaten selbst, nicht aus einer
 * abgeschriebenen Tabelle. Das ist hier mehr als Hygiene: die Regel stand
 * einmal an drei Stellen in drei Fassungen, bevor sie in
 * `allocation-eligibility.ts` versammelt wurde. Eine vierte Fassung im Wiki
 * waere der Rueckfall gewesen.
 */
export function AllocationRule() {
  const t = useTranslations();
  return (
    <div className="overflow-x-auto rounded-lg bg-card shadow-card">
      <table className="w-full min-w-[440px] border-collapse text-sm">
        <thead>
          <tr>
            {[
              t("wiki.ui.allocationRuleSchritt"),
              t("common.detail.reifegrad"),
              t("wiki.ui.allocationRuleDarfBudgetTragen"),
              t("wiki.ui.allocationRuleMussBudgetHaben"),
            ].map((h) => (
              <th
                key={h}
                className="whitespace-nowrap border-b px-4 py-2.5 text-left font-mono text-meta uppercase tracking-[0.1em] text-muted-foreground"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {GATE_STEPS.map((g) => {
            const may = mayHoldAllocation(g);
            const must = requiresCurrentAllocation(g);
            return (
              <tr key={g}>
                <td className="border-b border-border/60 px-4 py-2 font-mono text-xs text-foreground">
                  {gateStepNumberLabel(g, t)}
                </td>
                <td className="border-b border-border/60 px-4 py-2 text-muted-foreground">
                  {/* Nummernlose Schritte haben kein eigenes Kurzlabel — sie
                      erben das des Reifegrads, in dem sie leben. Ohne das
                      blieb die Zelle fuer „zur Analyse ausgewaehlt" leer. */}
                  {t(STAGE_SHORT_KEYS[g] ?? STAGE_SHORT_KEYS[gateOfStep(g)] ?? "—")}
                </td>
                <td className="border-b border-border/60 px-4 py-2">
                  {may ? (
                    <span className="font-medium text-foreground">{t("common.ja")}</span>
                  ) : (
                    <span className="text-muted-foreground/60">—</span>
                  )}
                </td>
                <td className="border-b border-border/60 px-4 py-2">
                  {must ? (
                    <span className="font-medium text-foreground">{t("common.ja")}</span>
                  ) : (
                    <span className="text-muted-foreground/60">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
