"use client";

import { useTranslations } from "next-intl";
import { Inbox } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { useUrlState } from "@/modules/drumbeat/features/lib/use-url-state";
import type { CockpitFilters } from "@/modules/drumbeat/server/views/umsetzung-cockpit-view";

/**
 * **Der Leerzustand der vier Sichten** — mit Grund und Ausweg.
 *
 * Jede Sicht hatte ihren eigenen: ein `<td colSpan={7}>`, ein `h-[300px]`-Kasten,
 * ein `h-[420px]`-Kasten, und im Board **28 gestrichelte Kästchen mit „leer"**.
 * Alle sagten dasselbe — „Keine Features im Scope" — und keiner sagte das
 * Entscheidende: *dass drei Filter an sind*. Wer das nicht weiß, sucht den
 * Fehler bei den Daten.
 *
 * Der Docstring von `EmptyState` nennt genau diese vier als Grund seiner
 * Existenz; angekommen war er hier nie.
 */
export function CockpitEmpty({ filters }: { filters: CockpitFilters }) {
  const t = useTranslations();
  const { setParams } = useUrlState();

  const active =
    filters.status.length +
    filters.ownerIds.length +
    filters.epicIds.length +
    (filters.hasBlocker ? 1 : 0) +
    (filters.q.trim() !== "" ? 1 : 0);

  if (active === 0) {
    return (
      <EmptyState
        icon={<Inbox className="size-6" />}
        title={t("drumbeat.ui.nochKeineFeatures")}
        body={t("drumbeat.ui.inDiesemArtUnd")}
        className="h-[420px]"
      />
    );
  }

  return (
    <EmptyState
      icon={<Inbox className="size-6" />}
      title={t("drumbeat.ui.nichtsPasstZuDiesen")}
      body={`${active} ${active === 1 ? "Filter ist" : "Filter sind"} aktiv. Es gibt Features in diesem Scope — nur keines, das durchkommt.`}
      action={
        <button
          type="button"
          onClick={() =>
            setParams({ status: null, owner: null, epic: null, blocker: null, q: null })
          }
          className="rounded-md border bg-background px-3 py-1.5 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {t("drumbeat.ui.filterZuruecksetzen")}
        </button>
      }
      className="h-[420px]"
    />
  );
}
