"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Owns the full interaction state-machine of the Top-Nav mega-menu: which group
 * is open, the hover-close timer that tolerates a ~150ms mouse jump between
 * trigger and panel, fine/coarse-pointer detection (touch falls back to
 * tap-to-open + navigate), and the ESC handler that restores focus to the
 * trigger that opened the panel.
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
   * Prop bag for a multi-item group's trigger button. Spread on the `<button>`
   * and add your own `onClick` (typically: openPanel + router.push to the
   * group's default href).
   */
  triggerProps: (key: string) => {
    onMouseEnter: (() => void) | undefined;
    onMouseLeave: (() => void) | undefined;
    onFocus: () => void;
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
      onFocus: () => openPanel(key),
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

  return { openKey, openPanel, close, triggerProps, panelProps };
}
