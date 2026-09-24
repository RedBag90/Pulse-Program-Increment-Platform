"use client";

import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { DependencyEdgeType } from "@/modules/drumbeat/server/views/breakdown-network-view";
// Single source of truth für die Edge-Farben (graph-palette).
import { EDGE_COLOR } from "@/modules/drumbeat/features/cockpit/components/graph-palette";
import { DEPENDENCY_TYPE_KEYS } from "@/modules/drumbeat/domain/status";

/**
 * Shared Edge-Type-Popover — wird vom Epic-Breakdown-Netzplan UND vom
 * Delivery-Cockpit (Roadmap + Netzplan) genutzt. Drei Typen-Buttons,
 * optional ein „Loeschen"-Knopf darunter. Trigger ist ein beliebiges
 * Kind-Element (z. B. die Edge-Label-Pille im Breakdown, eine
 * Virtual-Anchor-Div im Cockpit).
 *
 * Wer KEIN Trigger-Element hat (z. B. nach Edge-Klick mit
 * Cursor-Koordinaten), nutzt `EdgeTypeMenu` direkt und positioniert es
 * selber per `absolute` + `style`.
 */

export type EdgeTypeChange = (next: DependencyEdgeType) => void;

export { EDGE_COLOR };

/**
 * Die Beschriftung der drei Kantentypen — **aus der Domäne**, nicht von hier.
 *
 * Bis September 2026 stand hier eine zweite Tabelle mit `"blocks"`,
 * `"depends on"`, `"relates to"`: englische Wörter in einer deutschen
 * Oberfläche, direkt neben `DEPENDENCY_TYPE_KEYS`, das dieselben drei Werte
 * seit jeher deutsch beschriftet. Welche der beiden ein Nutzer zu sehen bekam,
 * entschied allein, über welchen Netzplan er kam.
 */
export const EDGE_LABEL: Record<DependencyEdgeType, string> = DEPENDENCY_TYPE_KEYS;

interface MenuProps {
  currentType: DependencyEdgeType;
  onChange: EdgeTypeChange;
  onDelete?: (() => void) | undefined;
  onClose?: () => void;
}

/**
 * Reines Menue-Markup — kein Popover-Wrapper. Caller positioniert
 * selber (Portal / absolute Div etc.).
 */
export function EdgeTypeMenu({ currentType, onChange, onDelete, onClose }: MenuProps) {
  const t = useTranslations();
  return (
    <div className="w-48 rounded-md border bg-popover p-1 shadow-md">
      <p className="px-1 text-label font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {t("drumbeat.ui.abhaengigkeitstyp")}
      </p>
      <div className="flex flex-col gap-0.5">
        {(["depends_on", "blocks", "relates_to"] as const).map((typ) => (
          <button
            key={typ}
            type="button"
            className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
              typ === currentType ? "bg-muted font-medium" : "hover:bg-muted/50"
            }`}
            onClick={() => {
              if (typ !== currentType) onChange(typ);
              onClose?.();
            }}
          >
            <span
              className="size-2 shrink-0 rounded-sm"
              style={{ backgroundColor: EDGE_COLOR[typ] }}
              aria-hidden
            />
            <span>{t(EDGE_LABEL[typ])}</span>
            {typ === currentType && (
              <span className="ml-auto text-label text-muted-foreground">
                {t("drumbeat.ui.active")}
              </span>
            )}
          </button>
        ))}
      </div>
      {onDelete && (
        <>
          <div className="my-1 h-px bg-border" aria-hidden />
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-destructive transition-colors hover:bg-destructive/10"
            onClick={() => {
              onDelete();
              onClose?.();
            }}
          >
            <span>{t("drumbeat.ui.abhaengigkeitLoeschen")}</span>
          </button>
        </>
      )}
    </div>
  );
}

interface PopoverProps extends MenuProps {
  children: ReactNode;
}

/**
 * Popover-Variante — Caller liefert ein Kind-Element als Trigger.
 * Anchor-Position folgt dem Trigger automatisch.
 */
export function EdgeTypePopover({ children, currentType, onChange, onDelete }: PopoverProps) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={children as React.ReactElement} />
      <PopoverContent side="bottom" align="center" className="w-48">
        <EdgeTypeMenu
          currentType={currentType}
          onChange={onChange}
          {...(onDelete ? { onDelete } : {})}
          onClose={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
}
