"use client";

import { useTranslations } from "next-intl";
import type { SyntheticEvent } from "react";
import { AlertTriangle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { BlockerRef } from "@/modules/drumbeat/domain/open-blockers";
import { useUrlState } from "@/modules/drumbeat/features/lib/use-url-state";

/**
 * **Ist diese Karte blockiert — und wodurch?**
 *
 * Ein Symbol, sobald ein offener Blocker da ist (`openBlockers`: eingehende
 * `blocks`, ausgehende `depends_on`). Beim Überfahren öffnet ein Popover mit
 * **allen** Blockern als Links; ein Klick öffnet die blockierende Karte im
 * Slide-Over. Popover statt Tooltip, weil man hineinfahren und klicken können
 * muss — und ein Klick oder Tap öffnet es ebenso, für Touch und Tastatur.
 *
 * Ersetzt die Zeile „blockt durch <erster Blocker>": sie nannte nur einen und
 * führte nirgends hin.
 *
 * Die Hülle hält alle Ereignisse bei sich — das Popover liegt im Portal, im
 * React-Baum aber in der Karte, und ihr Klick öffnete sonst zugleich das
 * Slide-Over der Karte selbst (dieselbe Falle wie bei `FeatureScore`).
 */
export function FeatureBlockers({ blockers }: { blockers: readonly BlockerRef[] }) {
  const t = useTranslations();
  const { setParam } = useUrlState();
  if (blockers.length === 0) return null;

  const beiMir = (e: SyntheticEvent) => e.stopPropagation();
  const label =
    blockers.length === 1
      ? t("drumbeat.ui.offenerBlockerEins")
      : t("drumbeat.ui.offeneBlockerMehrere", { n: blockers.length });

  return (
    <span
      className="contents"
      onClick={beiMir}
      onKeyDown={beiMir}
      onPointerDown={beiMir}
      onMouseDown={beiMir}
      onDragStart={beiMir}
    >
      <Popover>
        <PopoverTrigger
          openOnHover
          delay={100}
          aria-label={label}
          render={
            <button
              type="button"
              draggable={false}
              onDragStart={(e) => e.preventDefault()}
              className="flex shrink-0 cursor-pointer items-center gap-0.5 rounded-sm text-warning hover:opacity-80 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          }
        >
          <AlertTriangle className="size-3.5" aria-hidden />
          {blockers.length > 1 && (
            <span className="text-label font-semibold tabular-nums">{blockers.length}</span>
          )}
        </PopoverTrigger>
        <PopoverContent side="top" align="start" className="w-64 gap-1.5 p-2">
          <p className="text-label font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            {t("drumbeat.ui.blockiertDurch")}
          </p>
          <ul className="space-y-1">
            {blockers.map((b) => (
              <li key={b.id}>
                <button
                  type="button"
                  onClick={() => setParam("featureId", b.id)}
                  className="w-full truncate text-left text-xs text-primary hover:underline"
                  title={b.title}
                >
                  {b.title}
                </button>
              </li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>
    </span>
  );
}
