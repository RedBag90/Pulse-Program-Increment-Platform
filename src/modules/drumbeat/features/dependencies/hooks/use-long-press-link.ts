"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  nearerEnd,
  resolveDrop,
  type LinkDrop,
  type LinkGesture,
  type Point,
} from "@/modules/drumbeat/domain/long-press-link";

/**
 * **Abhängigkeiten per Touch** — ein Feature oder eine Kante lange halten,
 * dann auf ein anderes Feature ziehen.
 *
 * - Feature (`data-dep-node="<id>"`) halten → neue Abhängigkeit.
 * - Kante (`data-dep-edge="<depId>"` mit `data-dep-from`/`data-dep-to`)
 *   halten → das nähere Ende versetzen.
 *
 * Bewegt sich der Finger vor Ablauf der Haltezeit, passiert nichts: Knoten
 * schieben, Pannen und Scrollen laufen wie gehabt. Nach dem Aufnehmen fängt
 * der Hook die Bewegung in der **Capture-Phase** am Container ab — so sieht
 * weder xyflow (Knoten ziehen, Pannen) noch der Browser (Scrollen) sie.
 *
 * Nur Touch-Ereignisse: die Maus behält ihre Wege (Anfasser, Kantenenden).
 *
 * Verdrahtet wird über einen **Callback-Ref** (`ref={touchLink.ref}`): er
 * greift, sobald die Fläche erscheint — im Netzplan erst nach dem Laden. Ein
 * Objekt-Ref wäre beim ersten Effekt noch leer, und ein Element im State
 * löste beim Einhängen ein zweites Rendern des ganzen Netzplans aus.
 */

export const HALTEZEIT_MS = 400;
export const TOLERANZ_PX = 8;

export interface LinkPreview {
  gesture: LinkGesture;
  /** Fester Punkt der Linie (Quelle bzw. das nicht gegriffene Ende). */
  anchor: Point;
  finger: Point;
  targetId: string | null;
}

const mitte = (el: Element): Point => {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};

export function useLongPressLink(opts: { enabled: boolean; onDrop: (drop: LinkDrop) => void }): {
  ref: (el: HTMLElement | null) => void;
  preview: LinkPreview | null;
} {
  const [preview, setPreview] = useState<LinkPreview | null>(null);
  const optsRef = useRef(opts);
  useEffect(() => {
    optsRef.current = opts;
  });
  const abbauen = useRef<(() => void) | null>(null);

  const ref = useCallback((root: HTMLElement | null) => {
    abbauen.current?.();
    abbauen.current = null;
    if (!root) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    let start: Point | null = null;
    let armed: LinkPreview | null = null;
    let markiert: Element | null = null;

    const knoten = (id: string): Element | null =>
      [...root.querySelectorAll("[data-dep-node]")].find(
        (el) => el.getAttribute("data-dep-node") === id,
      ) ?? null;

    const markiere = (el: Element | null) => {
      if (markiert === el) return;
      markiert?.removeAttribute("data-dep-target");
      el?.setAttribute("data-dep-target", "true");
      markiert = el;
    };

    const reset = () => {
      if (timer) clearTimeout(timer);
      timer = null;
      start = null;
      armed = null;
      markiere(null);
      setPreview(null);
    };

    const zielUnter = (p: Point): Element | null => {
      const el = document.elementFromPoint(p.x, p.y)?.closest("[data-dep-node]") ?? null;
      return el && root.contains(el) ? el : null;
    };

    const onStart = (e: TouchEvent) => {
      if (!optsRef.current.enabled || e.touches.length !== 1) {
        reset();
        return;
      }
      const t = e.touches[0]!;
      const ziel = e.target as Element | null;
      // An den Enden einer Netzplan-Kante liegt xyflows Anfasser zum Versetzen
      // mit der Maus — ein Kreis ohne Marker. Er gehört zur Kante seiner Gruppe.
      const quelle =
        ziel?.closest?.("[data-dep-node],[data-dep-edge]") ??
        ziel?.closest?.(".react-flow__edge")?.querySelector("[data-dep-edge]") ??
        null;
      if (!quelle || !root.contains(quelle)) return;
      start = { x: t.clientX, y: t.clientY };
      const punkt = start;
      timer = setTimeout(() => {
        timer = null;
        let gesture: LinkGesture;
        let anchor: Point;
        if (quelle.hasAttribute("data-dep-edge")) {
          // Liegen Kanten übereinander, gilt die oberste, deren beide Enden
          // Features auf der Fläche sind — eine Kante zu einem Feature ausserhalb
          // des Fensters lässt sich nicht versetzen und darf den Griff nicht
          // schlucken.
          const kandidaten = [
            quelle,
            ...(document.elementsFromPoint?.(punkt.x, punkt.y) ?? []).filter(
              (el) => el !== quelle && el.hasAttribute("data-dep-edge") && root.contains(el),
            ),
          ];
          const kante = kandidaten
            .map((el) => ({
              el,
              fromEl: knoten(el.getAttribute("data-dep-from") ?? ""),
              toEl: knoten(el.getAttribute("data-dep-to") ?? ""),
            }))
            .find((k) => k.fromEl && k.toEl);
          if (!kante) return;
          const { fromEl, toEl } = kante as { el: Element; fromEl: Element; toEl: Element };
          const depId = kante.el.getAttribute("data-dep-edge") ?? "";
          const fromId = kante.el.getAttribute("data-dep-from") ?? "";
          const toId = kante.el.getAttribute("data-dep-to") ?? "";
          const end = nearerEnd(punkt, mitte(fromEl), mitte(toEl));
          gesture = { kind: "relink", depId, fromId, toId, end };
          anchor = mitte(end === "to" ? fromEl : toEl);
        } else {
          const fromId = quelle.getAttribute("data-dep-node") ?? "";
          gesture = { kind: "create", fromId };
          anchor = mitte(quelle);
        }
        armed = { gesture, anchor, finger: punkt, targetId: null };
        // Ein kurzer Ruck, wo das Gerät es kann: aufgenommen.
        navigator.vibrate?.(10);
        setPreview(armed);
      }, HALTEZEIT_MS);
    };

    const onMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      const p = { x: t.clientX, y: t.clientY };
      if (!armed) {
        if (start && Math.hypot(p.x - start.x, p.y - start.y) > TOLERANZ_PX) reset();
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      const ziel = zielUnter(p);
      markiere(ziel);
      armed = { ...armed, finger: p, targetId: ziel?.getAttribute("data-dep-node") ?? null };
      setPreview(armed);
    };

    const onEnd = (e: TouchEvent) => {
      if (armed) {
        // Kein Klick hinterher: der würde sonst das Feature öffnen.
        e.preventDefault();
        const drop = resolveDrop(armed.gesture, armed.targetId);
        if (drop) optsRef.current.onDrop(drop);
      }
      reset();
    };

    const onContextMenu = (e: Event) => {
      // Android öffnet beim langen Druck sonst ein Kontextmenü.
      if (timer || armed) e.preventDefault();
    };

    root.addEventListener("touchstart", onStart, { capture: true, passive: true });
    root.addEventListener("touchmove", onMove, { capture: true, passive: false });
    root.addEventListener("touchend", onEnd, { capture: true, passive: false });
    root.addEventListener("touchcancel", reset, { capture: true });
    root.addEventListener("contextmenu", onContextMenu, { capture: true });
    abbauen.current = () => {
      reset();
      root.removeEventListener("touchstart", onStart, { capture: true });
      root.removeEventListener("touchmove", onMove, { capture: true });
      root.removeEventListener("touchend", onEnd, { capture: true });
      root.removeEventListener("touchcancel", reset, { capture: true });
      root.removeEventListener("contextmenu", onContextMenu, { capture: true });
    };
  }, []);

  // Beim Aushängen der Komponente die Listener abbauen.
  useEffect(() => () => abbauen.current?.(), []);

  return { ref, preview };
}
