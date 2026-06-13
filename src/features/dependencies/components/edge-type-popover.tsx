"use client";

import { useState, type ReactNode } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { DependencyEdgeType } from "@/server/views/breakdown-network-view";

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

export const EDGE_COLOR: Record<DependencyEdgeType, string> = {
  blocks: "#ef4444",
  depends_on: "#d97706",
  relates_to: "#94a3b8",
};

export const EDGE_LABEL: Record<DependencyEdgeType, string> = {
  blocks: "blocks",
  depends_on: "depends on",
  relates_to: "relates to",
};

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
  return (
    <div className="w-48 rounded-md border bg-popover p-1 shadow-md">
      <p className="px-1 text-[11px] uppercase tracking-wider text-muted-foreground">
        Abhängigkeitstyp
      </p>
      <div className="flex flex-col gap-0.5">
        {(["depends_on", "blocks", "relates_to"] as const).map((t) => (
          <button
            key={t}
            type="button"
            className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
              t === currentType ? "bg-muted font-medium" : "hover:bg-muted/50"
            }`}
            onClick={() => {
              if (t !== currentType) onChange(t);
              onClose?.();
            }}
          >
            <span
              className="size-2 shrink-0 rounded-sm"
              style={{ backgroundColor: EDGE_COLOR[t] }}
              aria-hidden
            />
            <span>{EDGE_LABEL[t]}</span>
            {t === currentType && (
              <span className="ml-auto text-[10px] text-muted-foreground">aktiv</span>
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
            <span>Abhängigkeit löschen</span>
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
