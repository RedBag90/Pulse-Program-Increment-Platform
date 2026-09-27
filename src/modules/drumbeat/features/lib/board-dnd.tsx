"use client";

import { useTranslations } from "next-intl";
import { useId, useState, type ReactNode } from "react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";

/**
 * **Karten ziehen — mit Maus und Finger.** Beide Feature-Boards (das große
 * und das Board dieses PIs) ziehen über diesen Baustein statt über HTML5-Drag,
 * das auf Touch-Geräten nicht feuert.
 *
 * - Maus: ab 4 px Weg — ein Klick bleibt ein Klick und öffnet das Slide-Over.
 * - Finger: 250 ms halten (8 px Toleranz) — ein Wischen scrollt das Board
 *   weiter, ein Tippen öffnet das Slide-Over.
 * - Tastatur: bewusst kein Sensor. Enter und Leertaste öffnen auf der Karte
 *   das Slide-Over; verschoben wird per Kartenmenü (⋮).
 *
 * Das Board bekommt beim Loslassen nur `(featureId, zielId)` und entscheidet
 * selbst — Rechte, Grund-Dialog, optimistischer Patch bleiben dort.
 */

/** Zeitpunkt des letzten Loslassens — der Klick danach gehört zum Ziehen. */
let lastDragEnd = 0;

/** True, wenn gerade eben gezogen wurde; die Karte ignoriert dann den Klick. */
export function recentlyDragged(): boolean {
  return Date.now() - lastDragEnd < 300;
}

export function BoardDndProvider({
  children,
  onDrop,
  renderOverlay,
  describe,
}: {
  children: ReactNode;
  /** Loslassen über einem Ziel. */
  onDrop: (featureId: string, targetId: string) => void;
  /** Die Karte am Finger. */
  renderOverlay: (featureId: string) => ReactNode;
  /** Namen für die Ansagen des Screenreaders. */
  describe: { card: (id: string) => string; target: (id: string) => string };
}) {
  const t = useTranslations();
  // Stabile Id: sonst vergibt dnd-kit seine `aria-describedby`-Ids auf Server
  // und Client verschieden, und React meldet einen Hydration-Fehler.
  const id = useId();
  const [active, setActive] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );

  function start(e: DragStartEvent) {
    setActive(String(e.active.id));
    // Ein kurzer Ruck, wo das Gerät es kann: die Karte ist aufgenommen.
    if (typeof navigator !== "undefined") navigator.vibrate?.(10);
  }

  function end(e: DragEndEvent) {
    setActive(null);
    lastDragEnd = Date.now();
    if (e.over) onDrop(String(e.active.id), String(e.over.id));
  }

  return (
    <DndContext
      id={id}
      sensors={sensors}
      onDragStart={start}
      onDragEnd={end}
      onDragCancel={() => {
        setActive(null);
        lastDragEnd = Date.now();
      }}
      accessibility={{
        screenReaderInstructions: { draggable: t("drumbeat.dnd.anleitung") },
        announcements: {
          onDragStart: ({ active: a }) =>
            t("drumbeat.dnd.aufgenommen", { karte: describe.card(String(a.id)) }),
          onDragOver: ({ active: a, over }) =>
            over
              ? t("drumbeat.dnd.ueber", {
                  karte: describe.card(String(a.id)),
                  ziel: describe.target(String(over.id)),
                })
              : undefined,
          onDragEnd: ({ active: a, over }) =>
            over
              ? t("drumbeat.dnd.abgelegt", {
                  karte: describe.card(String(a.id)),
                  ziel: describe.target(String(over.id)),
                })
              : t("drumbeat.dnd.zurueck", { karte: describe.card(String(a.id)) }),
          onDragCancel: ({ active: a }) =>
            t("drumbeat.dnd.zurueck", { karte: describe.card(String(a.id)) }),
        },
      }}
    >
      {children}
      <DragOverlay dropAnimation={null}>
        {active ? <div className="rotate-1 cursor-grabbing">{renderOverlay(active)}</div> : null}
      </DragOverlay>
    </DndContext>
  );
}

/** Die Karte als Zieh-Quelle. Ohne Recht bleibt sie eine reine Anzeige. */
export function useCardDrag(id: string, disabled: boolean) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id, disabled });
  return { attributes, listeners: disabled ? undefined : listeners, setNodeRef, isDragging };
}

/** Eine Zelle oder Spalte als Ablage. */
export function useDropCell(id: string) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return { setNodeRef, isOver };
}
