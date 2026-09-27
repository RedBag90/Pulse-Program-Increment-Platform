"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Owns the full interaction state-machine of the Top-Nav mega-menu: which group
 * is open, the hover-close timer that tolerates a ~150ms mouse jump between
 * trigger and panel, fine/coarse-pointer detection (touch opens and closes by
 * tap), and the ESC handler that restores focus to the trigger that opened the
 * panel.
 *
 * A click on a trigger only opens the panel — it never navigates. Until
 * September 2026 it also jumped to the group's first page; picking a page is
 * the panel's job.
 *
 * Consumers (Topbar, Triggers, Panel) spread the returned prop bags and call
 * `openPanel` / `close` — they never own state. That makes the state-machine
 * unit-testable as a hook, and turns Triggers + Panel into render-only files.
 */

const HOVER_CLOSE_DELAY_MS = 150;
const PANEL_ID = "mega-menu-panel";

export interface MegaMenuApi {
  /** `labelKey` of the open group, or `null` when closed. */
  openKey: string | null;
  /** Open the panel for `key`, cancelling any pending hover-close. */
  openPanel: (key: string) => void;
  /** Close immediately (cancels any pending hover-close). */
  close: () => void;
  /**
   * The trigger's click: opens the panel. On touch a second tap closes it;
   * with a mouse the panel is already open from hovering and stays open.
   */
  toggle: (key: string) => void;
  /**
   * Prop bag for a multi-item group's trigger button. Spread on the `<button>`
   * and wire `onClick` to `toggle`.
   */
  triggerProps: (key: string) => {
    onMouseEnter: (() => void) | undefined;
    onMouseLeave: (() => void) | undefined;
    onFocus: (e: { currentTarget: Element }) => void;
    "aria-haspopup": "true";
    "aria-expanded": boolean;
    "aria-controls": string;
    "data-trigger-key": string;
  };
  /** Prop bag for the full-width panel container. */
  panelProps: {
    id: string;
    role: "region";
    onMouseEnter: () => void;
    onMouseLeave: () => void;
  };
}

/** `:focus-visible` = Fokus per Tastatur; ohne Selektor-Unterstützung: ja. */
function isKeyboardFocus(el: Element): boolean {
  try {
    return el.matches(":focus-visible");
  } catch {
    return true;
  }
}

export function useMegaMenu(): MegaMenuApi {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hover-Mode nur fuer feine Pointer (Maus, Touchpad). Auf Touch faellt das
  // System auf den Tap-zu-oeffnen-und-navigieren-Pfad zurueck.
  const [isFinePointer, setIsFinePointer] = useState(true);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(pointer: fine)");
    setIsFinePointer(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setIsFinePointer(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const cancelClose = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const openPanel = useCallback(
    (key: string) => {
      cancelClose();
      setOpenKey(key);
    },
    [cancelClose],
  );

  const scheduleClose = useCallback(() => {
    cancelClose();
    closeTimerRef.current = setTimeout(() => setOpenKey(null), HOVER_CLOSE_DELAY_MS);
  }, [cancelClose]);

  const close = useCallback(() => {
    cancelClose();
    setOpenKey(null);
  }, [cancelClose]);

  const toggle = useCallback(
    (key: string) => {
      if (openKey === key && !isFinePointer) close();
      else openPanel(key);
    },
    [openKey, isFinePointer, close, openPanel],
  );

  // ESC: close + restore focus to the trigger that opened it. The trigger is
  // looked up via `data-trigger-key` so we don't have to thread refs through
  // child components.
  useEffect(() => {
    if (openKey === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      const key = openKey;
      setOpenKey(null);
      queueMicrotask(() => {
        const trigger = document.querySelector<HTMLButtonElement>(`[data-trigger-key="${key}"]`);
        trigger?.focus();
      });
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [openKey]);

  const triggerProps = useCallback<MegaMenuApi["triggerProps"]>(
    (key) => ({
      onMouseEnter: isFinePointer ? () => openPanel(key) : undefined,
      onMouseLeave: isFinePointer ? scheduleClose : undefined,
      // Nur Tastatur-Fokus öffnet. Ein Tipp setzt ebenfalls den Fokus — öffnete
      // der, sähe der Klick im selben Tipp ein offenes Menü und schlösse es.
      onFocus: (e) => {
        if (isKeyboardFocus(e.currentTarget)) openPanel(key);
      },
      "aria-haspopup": "true",
      "aria-expanded": openKey === key,
      "aria-controls": PANEL_ID,
      "data-trigger-key": key,
    }),
    [isFinePointer, openKey, openPanel, scheduleClose],
  );

  const panelProps: MegaMenuApi["panelProps"] = {
    id: PANEL_ID,
    role: "region",
    onMouseEnter: cancelClose,
    onMouseLeave: scheduleClose,
  };

  return { openKey, openPanel, close, toggle, triggerProps, panelProps };
}
