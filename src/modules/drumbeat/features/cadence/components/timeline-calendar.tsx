"use client";

import { useMemo, useRef, useState, useEffect, startTransition, useActionState } from "react";
import { updatePiOnTimelineAction } from "@/modules/drumbeat/features/cadence/actions/pi";
import type { ActionState } from "@/server/http/server-action";
import { isoDay, parseIsoDay, addDays, daysBetween } from "@/modules/core/kernel/domain/calendar";
import {
  buildTimelineAxis,
  findTimelineConflicts,
  timelineBarMetrics,
} from "@/modules/drumbeat/domain/timeline-grid";

interface CalendarPi {
  id: string;
  name: string;
  /** ISO date YYYY-MM-DD. */
  startDate: string;
  /** ISO date YYYY-MM-DD. */
  endDate: string;
  status: string;
}

interface Props {
  pis: CalendarPi[];
  canEdit: boolean;
  /** Klick auf leeren Tag → Konsument oeffnet "Neues PI"-Dialog mit Start. */
  onEmptyDayClick: (isoDate: string) => void;
  /** Klick auf bestehendes PI → Edit-Dialog. */
  onPiClick: (piId: string) => void;
}

const ROW_HEIGHT = 36;

const STATUS_COLOR: Record<string, string> = {
  planned: "bg-slate-200 text-slate-900 border-slate-300",
  active: "bg-blue-200 text-blue-900 border-blue-400",
  completed: "bg-emerald-200 text-emerald-900 border-emerald-400",
};
const STATUS_DOT: Record<string, string> = {
  planned: "bg-slate-500",
  active: "bg-blue-600",
  completed: "bg-emerald-600",
};

interface DragState {
  piId: string;
  mode: "move" | "resize-end";
  /** Pixel-Offset des Click-Punkts vom Balken-Anfang. */
  grabOffsetPx: number;
  origStart: Date;
  origEnd: Date;
  /** Current optimistic position (rendered). */
  curStart: Date;
  curEnd: Date;
}

const initialActionState: ActionState = {};

/**
 * Horizontaler Kalender ueber 12 Monate ab dem fruehesten PI-Start
 * (oder heute, wenn keine PIs existieren). PIs sind farbig nach Status
 * (planned grau, active blau, completed grün). Drag = verschieben,
 * Drag am rechten Rand = resize End-Datum. Klick auf leeren Tag oder
 * PI-Balken oeffnet den Konsumenten-Callback.
 */
export function TimelineCalendar({ pis, canEdit, onEmptyDayClick, onPiClick }: Props) {
  const [, updateAction] = useActionState(updatePiOnTimelineAction, initialActionState);
  const [drag, setDrag] = useState<DragState | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  // Pro PI hoechstens ein in-flight Update — schuetzt vor Race-Conditions,
  // wenn der User mehrere Drags schnell hintereinander macht.
  const pendingByPi = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Fixed 12-month axis + pixel metrics from the domain grid. Anchor follows
  // the original PIs, so a drag never shifts the whole axis mid-move.
  const axis = useMemo(
    () =>
      buildTimelineAxis(
        pis.map((p) => ({ startDate: parseIsoDay(p.startDate), endDate: parseIsoDay(p.endDate) })),
        new Date(),
      ),
    [pis],
  );
  const { anchor, pxPerDay, totalWidthPx, months: monthHeaders } = axis;

  // Overlap-Detection über die effektiven Fenster (das aktiv gezogene PI wird
  // mit seiner optimistischen Position eingerechnet).
  const conflictIds = useMemo(() => {
    const windows = pis.map((p) =>
      drag && drag.piId === p.id
        ? { id: p.id, startDate: drag.curStart, endDate: drag.curEnd }
        : { id: p.id, startDate: parseIsoDay(p.startDate), endDate: parseIsoDay(p.endDate) },
    );
    return findTimelineConflicts(windows);
  }, [pis, drag]);

  // Pointer handlers.
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag || !trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const xInTrack = e.clientX - rect.left + (containerRef.current?.scrollLeft ?? 0);
    if (drag.mode === "move") {
      const newStartDay = Math.max(0, Math.round((xInTrack - drag.grabOffsetPx) / pxPerDay));
      const durationDays = daysBetween(drag.origStart, drag.origEnd);
      const newStart = addDays(anchor, newStartDay);
      const newEnd = addDays(newStart, durationDays);
      setDrag({ ...drag, curStart: newStart, curEnd: newEnd });
    } else {
      // resize-end
      const newEndDay = Math.max(
        daysBetween(anchor, drag.curStart) + 1,
        Math.round(xInTrack / pxPerDay),
      );
      const newEnd = addDays(anchor, newEndDay);
      setDrag({ ...drag, curEnd: newEnd });
    }
  };

  useEffect(() => {
    if (!drag) return;
    const onUp = () => {
      const startISO = isoDay(drag.curStart);
      const endISO = isoDay(drag.curEnd);
      const orig = pis.find((p) => p.id === drag.piId);
      if (orig && (orig.startDate !== startISO || orig.endDate !== endISO)) {
        // Debounce per PI: ein zweiter Drag innerhalb von 150ms canceled
        // den ersten Request — beim Server kommt nur die letzte Position an.
        const prev = pendingByPi.current.get(drag.piId);
        if (prev) clearTimeout(prev);
        const piId = drag.piId;
        const handle = setTimeout(() => {
          pendingByPi.current.delete(piId);
          const fd = new FormData();
          fd.set("id", piId);
          fd.set("startDate", startISO);
          fd.set("endDate", endISO);
          startTransition(() => updateAction(fd));
        }, 150);
        pendingByPi.current.set(drag.piId, handle);
      }
      setDrag(null);
    };
    window.addEventListener("pointerup", onUp);
    return () => window.removeEventListener("pointerup", onUp);
  }, [drag, pis, updateAction]);

  // Cleanup pending timers wenn die Komponente unmountet (Tab-Wechsel etc.).
  useEffect(() => {
    const map = pendingByPi.current;
    return () => {
      for (const handle of map.values()) clearTimeout(handle);
      map.clear();
    };
  }, []);

  const onTrackClick = (e: React.MouseEvent) => {
    if (!canEdit) return;
    if (drag) return;
    if (!trackRef.current) return;
    // ignore clicks bubbling from PI-Balken
    const target = e.target as HTMLElement;
    if (target.closest("[data-pi-bar]")) return;
    const rect = trackRef.current.getBoundingClientRect();
    const xInTrack = e.clientX - rect.left + (containerRef.current?.scrollLeft ?? 0);
    const dayOffset = Math.max(0, Math.floor(xInTrack / pxPerDay));
    onEmptyDayClick(isoDay(addDays(anchor, dayOffset)));
  };

  return (
    <div
      ref={containerRef}
      className="overflow-x-auto rounded-md border bg-card"
      onPointerMove={onPointerMove}
    >
      <div
        ref={trackRef}
        className="relative select-none"
        style={{ width: totalWidthPx, height: ROW_HEIGHT * (pis.length + 1) + 28 }}
        onClick={onTrackClick}
      >
        {/* Month headers */}
        <div
          className="sticky top-0 z-10 flex h-7 border-b bg-muted/40 text-xs"
          style={{ width: totalWidthPx }}
        >
          {monthHeaders.map((m) => (
            <div
              key={m.key}
              className="border-r px-1.5 py-1 text-muted-foreground"
              style={{ width: m.widthPx }}
            >
              {m.label}
            </div>
          ))}
        </div>

        {/* PI bars — one row each, chronological */}
        {pis
          .slice()
          .sort((a, b) => a.startDate.localeCompare(b.startDate))
          .map((pi, idx) => {
            const isDragging = drag?.piId === pi.id;
            const start = isDragging ? drag.curStart : parseIsoDay(pi.startDate);
            const end = isDragging ? drag.curEnd : parseIsoDay(pi.endDate);
            const { leftPx, widthPx } = timelineBarMetrics({ startDate: start, endDate: end }, axis);
            const top = 28 + idx * ROW_HEIGHT + 4;
            const conflict = conflictIds.has(pi.id);
            const lockable = pi.status === "planned" && canEdit;
            const tooltip = `${pi.name}\n${isoDay(start)} → ${isoDay(end)}\nStatus: ${pi.status}`;
            return (
              <div
                key={pi.id}
                data-pi-bar
                title={tooltip}
                aria-label={`PI ${pi.name}, ${isoDay(start)} bis ${isoDay(end)}, Status ${pi.status}`}
                onClick={(e) => {
                  if (drag) return;
                  e.stopPropagation();
                  onPiClick(pi.id);
                }}
                onPointerDown={(e) => {
                  if (!lockable) return;
                  if ((e.target as HTMLElement).dataset["resize"] === "true") return;
                  e.preventDefault();
                  const rect = trackRef.current!.getBoundingClientRect();
                  const xInTrack = e.clientX - rect.left + (containerRef.current?.scrollLeft ?? 0);
                  setDrag({
                    piId: pi.id,
                    mode: "move",
                    grabOffsetPx: xInTrack - leftPx,
                    origStart: parseIsoDay(pi.startDate),
                    origEnd: parseIsoDay(pi.endDate),
                    curStart: parseIsoDay(pi.startDate),
                    curEnd: parseIsoDay(pi.endDate),
                  });
                }}
                className={`absolute flex items-center gap-1.5 rounded-md border px-2 text-xs font-medium shadow-sm ${STATUS_COLOR[pi.status] ?? "bg-muted text-foreground"} ${conflict ? "ring-2 ring-destructive" : ""} ${lockable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}`}
                style={{
                  left: leftPx,
                  width: widthPx,
                  top,
                  height: ROW_HEIGHT - 8,
                }}
              >
                <span
                  className={`size-1.5 rounded-full ${STATUS_DOT[pi.status] ?? "bg-muted-foreground"}`}
                />
                <span className="flex-1 truncate">{pi.name}</span>
                {lockable && (
                  <span
                    data-resize="true"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDrag({
                        piId: pi.id,
                        mode: "resize-end",
                        grabOffsetPx: 0,
                        origStart: parseIsoDay(pi.startDate),
                        origEnd: parseIsoDay(pi.endDate),
                        curStart: parseIsoDay(pi.startDate),
                        curEnd: parseIsoDay(pi.endDate),
                      });
                    }}
                    className="ml-auto h-full w-1.5 cursor-ew-resize rounded-r border-l border-current/30"
                    title="Ende-Datum ziehen"
                  />
                )}
              </div>
            );
          })}

        {pis.length === 0 && (
          <p className="absolute left-3 top-10 text-xs text-muted-foreground">
            Klick auf einen Tag, um ein PI anzulegen.
          </p>
        )}
      </div>
    </div>
  );
}
