"use client";

import { useMemo, useRef, useState, useEffect, startTransition, useActionState } from "react";
import { updatePiOnTimelineAction } from "@/features/timeline/actions/pi";
import type { ActionState } from "@/server/http/server-action";

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

const PX_PER_DAY = 6;
const MONTHS_TO_SHOW = 12;
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

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseISO(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + days);
  return r;
}

function startOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

const MONTH_LABELS_DE = [
  "Jan",
  "Feb",
  "Mär",
  "Apr",
  "Mai",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Okt",
  "Nov",
  "Dez",
];

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

  const anchor = useMemo(() => {
    if (pis.length === 0) return startOfMonth(new Date());
    const earliest = pis.reduce<Date>((min, p) => {
      const d = parseISO(p.startDate);
      return d < min ? d : min;
    }, parseISO(pis[0]!.startDate));
    return startOfMonth(earliest);
  }, [pis]);

  // Total days = MONTHS_TO_SHOW months from anchor.
  const totalDays = useMemo(() => {
    const end = new Date(
      Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + MONTHS_TO_SHOW, 1),
    );
    return daysBetween(anchor, end);
  }, [anchor]);

  // Month labels positioned at their month-start.
  const monthHeaders = useMemo(() => {
    return Array.from({ length: MONTHS_TO_SHOW }, (_, i) => {
      const d = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + i, 1));
      const widthDays = daysBetween(
        d,
        new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)),
      );
      return {
        key: `${d.getUTCFullYear()}-${d.getUTCMonth()}`,
        label: `${MONTH_LABELS_DE[d.getUTCMonth()]} ${d.getUTCFullYear()}`,
        leftPx: daysBetween(anchor, d) * PX_PER_DAY,
        widthPx: widthDays * PX_PER_DAY,
      };
    });
  }, [anchor]);

  // Overlap-Detection (excluding the actively dragged PI).
  const conflictIds = useMemo(() => {
    const out = new Set<string>();
    const effectivePis = pis.map((p) => {
      if (drag && drag.piId === p.id) {
        return { ...p, startDate: isoDay(drag.curStart), endDate: isoDay(drag.curEnd) };
      }
      return p;
    });
    for (let i = 0; i < effectivePis.length; i++) {
      const a = effectivePis[i]!;
      const aStart = parseISO(a.startDate);
      const aEnd = parseISO(a.endDate);
      for (let j = i + 1; j < effectivePis.length; j++) {
        const b = effectivePis[j]!;
        const bStart = parseISO(b.startDate);
        const bEnd = parseISO(b.endDate);
        if (aStart < bEnd && aEnd > bStart) {
          out.add(a.id);
          out.add(b.id);
        }
      }
    }
    return out;
  }, [pis, drag]);

  // Pointer handlers.
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag || !trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const xInTrack = e.clientX - rect.left + (containerRef.current?.scrollLeft ?? 0);
    if (drag.mode === "move") {
      const newStartDay = Math.max(0, Math.round((xInTrack - drag.grabOffsetPx) / PX_PER_DAY));
      const durationDays = daysBetween(drag.origStart, drag.origEnd);
      const newStart = addDays(anchor, newStartDay);
      const newEnd = addDays(newStart, durationDays);
      setDrag({ ...drag, curStart: newStart, curEnd: newEnd });
    } else {
      // resize-end
      const newEndDay = Math.max(
        daysBetween(anchor, drag.curStart) + 1,
        Math.round(xInTrack / PX_PER_DAY),
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
        const fd = new FormData();
        fd.set("id", drag.piId);
        fd.set("startDate", startISO);
        fd.set("endDate", endISO);
        startTransition(() => updateAction(fd));
      }
      setDrag(null);
    };
    window.addEventListener("pointerup", onUp);
    return () => window.removeEventListener("pointerup", onUp);
  }, [drag, pis, updateAction]);

  const onTrackClick = (e: React.MouseEvent) => {
    if (!canEdit) return;
    if (drag) return;
    if (!trackRef.current) return;
    // ignore clicks bubbling from PI-Balken
    const target = e.target as HTMLElement;
    if (target.closest("[data-pi-bar]")) return;
    const rect = trackRef.current.getBoundingClientRect();
    const xInTrack = e.clientX - rect.left + (containerRef.current?.scrollLeft ?? 0);
    const dayOffset = Math.max(0, Math.floor(xInTrack / PX_PER_DAY));
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
        style={{ width: totalDays * PX_PER_DAY, height: ROW_HEIGHT * (pis.length + 1) + 28 }}
        onClick={onTrackClick}
      >
        {/* Month headers */}
        <div
          className="sticky top-0 z-10 flex h-7 border-b bg-muted/40 text-xs"
          style={{ width: totalDays * PX_PER_DAY }}
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
            const start = isDragging ? drag.curStart : parseISO(pi.startDate);
            const end = isDragging ? drag.curEnd : parseISO(pi.endDate);
            const leftPx = daysBetween(anchor, start) * PX_PER_DAY;
            const widthPx = Math.max(PX_PER_DAY * 2, daysBetween(start, end) * PX_PER_DAY);
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
                    origStart: parseISO(pi.startDate),
                    origEnd: parseISO(pi.endDate),
                    curStart: parseISO(pi.startDate),
                    curEnd: parseISO(pi.endDate),
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
                        origStart: parseISO(pi.startDate),
                        origEnd: parseISO(pi.endDate),
                        curStart: parseISO(pi.startDate),
                        curEnd: parseISO(pi.endDate),
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
