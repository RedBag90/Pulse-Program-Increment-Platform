"use client";

import { useTranslations } from "next-intl";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

/**
 * Das kleine **ⓘ** neben einer Beschriftung: im Hover (und im Tastatur-Fokus)
 * erscheint der Satz, der den Fachbegriff erklärt oder die Frage stellt, die
 * das Feld beantwortet.
 *
 * Es lag modul-privat im Ziele-Drawer und wird jetzt auch vom Lean Business
 * Case gebraucht. Eine zweite Kopie hätte sich früher oder später vom Original
 * entfernt — wie es den WSJF-Rängen und dem Lane-Tint des Boards ergangen ist.
 *
 * **Der Auslöser ist bewusst kein `<button>`.** Die Formulare, die ihn
 * benutzen, stehen in `<fieldset disabled={readOnly}>`; ein Button darin ist
 * nach HTML-Spec deaktiviert, und zwar unabänderlich — `disabled={false}` hebt
 * das nicht auf. Der Tooltip wäre ausgerechnet in der Nur-Lese-Ansicht tot,
 * also für den Abnehmer, der am ehesten wissen will, wonach gefragt war. Ein
 * `<span>` ist kein Formularelement und bleibt bedienbar; `tabIndex` und
 * `role` machen ihn trotzdem für die Tastatur erreichbar.
 */
export function InfoHint({ text }: { text: string }) {
  const t = useTranslations();
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            role="button"
            tabIndex={0}
            aria-label={t("common.ui.erklaerung")}
            // Ein Klick soll nur das zugehörige Feld fokussieren, nicht das
            // Formular abschicken oder die Beschriftung umschalten.
            onClick={(e) => e.preventDefault()}
            className="inline-flex size-4 shrink-0 cursor-help items-center justify-center rounded-full border text-label font-normal normal-case leading-none text-muted-foreground hover:border-foreground hover:text-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            i
          </span>
        }
      />
      <TooltipContent>{text}</TooltipContent>
    </Tooltip>
  );
}
