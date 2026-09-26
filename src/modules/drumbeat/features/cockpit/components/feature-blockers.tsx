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
 * Das Symbol erscheint, sobald die Karte blockierende Abhängigkeiten hat —
 * in eine der beiden Richtungen: Vorgänger, die sie aufhalten
 * (`classifyBlockers`: eingehende `blocks`, ausgehende `depends_on`), oder
 * Nachfolger, die sie aufhält (`classifySuccessors`). Gezählt und gefärbt wird
 * nach den Vorgängern, und nur nach denen, die **tatsächlich** aufhalten:
 *
 *  - mindestens einer blockiert → Warndreieck mit ihrer Zahl, auch bei 1;
 *  - keiner blockiert (alle erledigt oder im selben bzw. einem früheren PI
 *    eingeplant, oder die Karte hat nur Nachfolger) → grünes Dreieck mit
 *    Häkchen.
 *
 * Beim Überfahren öffnet ein Popover mit zwei Listen: „Blockiert durch" (die
 * Vorgänger) und „Blockiert" (die Nachfolger). Je Eintrag ein Warndreieck
 * oder ein grünes Häkchen samt Grund; jeder Eintrag öffnet seine Karte im
 * Slide-Over. Popover statt Tooltip, weil man hineinfahren und klicken können
 * muss — ein Klick oder Tap öffnet es ebenso.
 *
 * Die Hülle hält alle Ereignisse bei sich — das Popover liegt im Portal, im
 * React-Baum aber in der Karte, und ihr Klick öffnete sonst zugleich das
 * Slide-Over der Karte selbst (dieselbe Falle wie bei `FeatureScore`).
 */
type Grund = Record<Exclude<BlockerRef["state"], "blocking">, string>;

/** Warum ein Vorgänger diese Karte nicht blockiert — je Zustand ein Wort. */
const GRUND_VORGAENGER: Grund = {
  done: "drumbeat.ui.blockerGrundErledigt",
  samePi: "drumbeat.ui.blockerGrundSelbesPi",
  earlierPi: "drumbeat.ui.blockerGrundFrueheresPi",
};

/**
 * Warum diese Karte einen Nachfolger nicht blockiert — aus seiner Sicht:
 * `earlierPi` heisst, der Nachfolger liegt im späteren PI, `done`, dass diese
 * Karte erledigt ist.
 */
const GRUND_NACHFOLGER: Grund = {
  done: "drumbeat.ui.nachfolgerGrundErledigt",
  samePi: "drumbeat.ui.blockerGrundSelbesPi",
  earlierPi: "drumbeat.ui.nachfolgerGrundSpaeteresPi",
};

export function FeatureBlockers({
  blockers,
  successors = [],
}: {
  blockers: readonly BlockerRef[];
  /** Wen diese Karte aufhält (`classifySuccessors`) — der Abschnitt „Blockiert". */
  successors?: readonly BlockerRef[];
}) {
  const t = useTranslations();
  const { setParam } = useUrlState();
  if (blockers.length === 0 && successors.length === 0) return null;

  const blocking = blockingOnly(blockers);
  const erfuellt = blocking.length === 0;
  const beiMir = (e: SyntheticEvent) => e.stopPropagation();
  const label = erfuellt
    ? t("drumbeat.ui.abhaengigkeitenErfuellt")
    : blocking.length === 1
      ? t("drumbeat.ui.offenerBlockerEins")
      : t("drumbeat.ui.offeneBlockerMehrere", { n: blocking.length });

  /**
   * **Eine Liste, ein Zeichen je Eintrag.** Bis September 2026 teilte das
   * Popover in „Blockiert durch" und „Blockiert nicht". Jetzt steht alles
   * unter „Blockiert durch", und jeder Eintrag sagt mit seinem Zeichen, ob er
   * gerade aufhält: Warndreieck, oder grünes Häkchen samt Grund. Das Zeichen
   * trägt sein Wort (`sr-only`) — die Farbe steht nicht allein.
   */
  const eintrag = (grund: Grund) => (b: BlockerRef) => (
    <li key={b.id} className="flex items-center gap-1.5">
      {b.state === "blocking" ? (
        <span className="shrink-0 text-warning">
          <AlertTriangle className="size-3.5" aria-hidden />
          <span className="sr-only">{t("drumbeat.ui.blockiert")}</span>
        </span>
      ) : (
        <span className="shrink-0 text-success">
          <Check className="size-3.5" aria-hidden />
          <span className="sr-only">{t("drumbeat.ui.blockiertNicht")}</span>
        </span>
      )}
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
          {t(grund[b.state as Exclude<BlockerRef["state"], "blocking">])}
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
          {blockers.length > 0 && (
            <>
              <p className="text-label font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                {t("drumbeat.ui.blockiertDurch")}
              </p>
              <ul className="space-y-1">{blockers.map(eintrag(GRUND_VORGAENGER))}</ul>
            </>
          )}
          {/* **Die Gegenrichtung.** Wen hält diese Karte auf? Dasselbe Zeichen
              wie oben, aus Sicht des Nachfolgers: sein Symbol zählt diese
              Karte genau dann, wenn hier das Dreieck steht. */}
          {successors.length > 0 && (
            <>
              <p className="text-label font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                {t("drumbeat.ui.blockiertAndere")}
              </p>
              <ul className="space-y-1">{successors.map(eintrag(GRUND_NACHFOLGER))}</ul>
            </>
          )}
        </PopoverContent>
      </Popover>
    </span>
  );
}
