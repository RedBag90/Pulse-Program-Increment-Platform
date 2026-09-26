"use client";

import { useTranslations } from "next-intl";
import type { SyntheticEvent } from "react";
import { AlertTriangle, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { blockingOnly, type BlockerRef } from "@/modules/drumbeat/domain/open-blockers";
import { useUrlState } from "@/modules/drumbeat/features/lib/use-url-state";

/**
 * **Blockieren die Abhängigkeiten dieser Karte sie gerade — und welche?**
 *
 * Das Symbol erscheint, sobald die Karte überhaupt blockierende
 * Abhängigkeiten hat (`classifyBlockers`: eingehende `blocks`, ausgehende
 * `depends_on`). Es zählt nur die, die **tatsächlich** aufhalten:
 *
 *  - mindestens eine blockiert → Warndreieck mit ihrer Zahl, auch bei 1;
 *  - keine blockiert (alle erledigt oder im selben PI) → grünes Dreieck mit
 *    Häkchen: die Abhängigkeiten sind da, aber erfüllt.
 *
 * Beim Überfahren öffnet ein Popover mit allen, gruppiert nach „Blockiert
 * durch" und „Blockiert nicht" samt Grund; jeder Eintrag öffnet seine Karte
 * im Slide-Over. Popover statt Tooltip, weil man hineinfahren und klicken
 * können muss — ein Klick oder Tap öffnet es ebenso.
 *
 * Die Hülle hält alle Ereignisse bei sich — das Popover liegt im Portal, im
 * React-Baum aber in der Karte, und ihr Klick öffnete sonst zugleich das
 * Slide-Over der Karte selbst (dieselbe Falle wie bei `FeatureScore`).
 */
export function FeatureBlockers({ blockers }: { blockers: readonly BlockerRef[] }) {
  const t = useTranslations();
  const { setParam } = useUrlState();
  if (blockers.length === 0) return null;

  const blocking = blockingOnly(blockers);
  const rest = blockers.filter((b) => b.state !== "blocking");
  const erfuellt = blocking.length === 0;
  const beiMir = (e: SyntheticEvent) => e.stopPropagation();
  const label = erfuellt
    ? t("drumbeat.ui.abhaengigkeitenErfuellt")
    : blocking.length === 1
      ? t("drumbeat.ui.offenerBlockerEins")
      : t("drumbeat.ui.offeneBlockerMehrere", { n: blocking.length });

  const eintrag = (b: BlockerRef) => (
    <li key={b.id} className="flex items-baseline gap-2">
      <button
        type="button"
        onClick={() => setParam("featureId", b.id)}
        className="min-w-0 truncate text-left text-xs text-primary hover:underline"
        title={b.title}
      >
        {b.title}
      </button>
      {b.state !== "blocking" && (
        <span className="shrink-0 text-label text-muted-foreground">
          {t(
            b.state === "done"
              ? "drumbeat.ui.blockerGrundErledigt"
              : "drumbeat.ui.blockerGrundSelbesPi",
          )}
        </span>
      )}
    </li>
  );

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
              className={`flex shrink-0 cursor-pointer items-center gap-0.5 rounded-sm hover:opacity-80 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${
                erfuellt ? "text-success" : "text-warning"
              }`}
            />
          }
        >
          <AlertTriangle className="size-3.5" aria-hidden />
          {erfuellt ? (
            <Check className="size-3.5" aria-hidden />
          ) : (
            <span className="text-label font-semibold tabular-nums">{blocking.length}</span>
          )}
        </PopoverTrigger>
        <PopoverContent side="top" align="start" className="w-64 gap-1.5 p-2">
          {blocking.length > 0 && (
            <>
              <p className="text-label font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                {t("drumbeat.ui.blockiertDurch")}
              </p>
              <ul className="space-y-1">{blocking.map(eintrag)}</ul>
            </>
          )}
          {rest.length > 0 && (
            <>
              <p className="text-label font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                {t("drumbeat.ui.blockiertNicht")}
              </p>
              <ul className="space-y-1">{rest.map(eintrag)}</ul>
            </>
          )}
        </PopoverContent>
      </Popover>
    </span>
  );
}
