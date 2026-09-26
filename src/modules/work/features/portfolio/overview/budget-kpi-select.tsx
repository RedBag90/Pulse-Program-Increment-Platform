"use client";

import { useTranslations } from "next-intl";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Link } from "@/i18n/navigation";
import type { KpiValueStreamOption } from "@/modules/work/domain/budget-kpi-selection";

/**
 * **Die Auswahl der Budget-KPIs im Portfolio Sync** — Wertstrom, dann
 * „gesamt" oder ein ART.
 *
 * Schreibt `?kpiVs=` und `?kpiArt=` und behält alle übrigen Parameter (Ansicht,
 * Filter), wie der `ViewSwitcher`. Ein neuer Wertstrom löscht das ART: es
 * gehörte zum alten.
 */
export function BudgetKpiSelect({
  options,
  selectedVs,
  selectedArt,
}: {
  options: readonly KpiValueStreamOption[];
  selectedVs: string;
  /** `null` = „Wertstrom gesamt". */
  selectedArt: string | null;
}) {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const vs = options.find((o) => o.id === selectedVs);

  function setze(changes: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v == null) params.delete(k);
      else params.set(k, v);
    }
    router.replace(`${pathname}?${params.toString()}` as never, { scroll: false });
  }

  const feld =
    "h-8 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-meta text-muted-foreground">
        {t("work.overview.kpiWertstrom")}
        <select
          className={feld}
          value={selectedVs}
          onChange={(e) => setze({ kpiVs: e.target.value, kpiArt: null })}
        >
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </label>
      {vs && (
        <label className="flex flex-col gap-1 text-meta text-muted-foreground">
          {t("work.overview.kpiSicht")}
          <select
            className={feld}
            value={selectedArt ?? ""}
            onChange={(e) => setze({ kpiArt: e.target.value === "" ? null : e.target.value })}
          >
            {vs.showTotals && <option value="">{t("work.overview.kpiWertstromGesamt")}</option>}
            {vs.arts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <Link
        href={`/budgeting/value-streams/${selectedVs}?tab=kpi` as never}
        className="pb-1.5 text-sm text-primary hover:underline"
      >
        {t("work.overview.zurBudgetseite")}
      </Link>
    </div>
  );
}
