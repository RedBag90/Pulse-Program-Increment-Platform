"use client";

import { useMemo, useState, useActionState, startTransition, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { addStandardPisAction } from "@/modules/core/org/features/structure/actions/pi-standard";
import { standardPiSchedule, selectFreeStandardPis } from "@/modules/core/org/domain/pi-standard";
import type { ActionState } from "@/server/http/server-action";

export interface FullPiStandardOption {
  id: string;
  name: string;
  anchorMonth: number;
  anchorDay: number;
  cadenceWeeks: number;
  piCount: number;
}

interface ExistingPi {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  timelineId: string;
  standards: FullPiStandardOption[];
  existingPis: ExistingPi[];
}

const initialState: ActionState = {};

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Standard-anwenden mit Live-Vorschau. User waehlt einen Standard + Jahr;
 * die Komponente rendert die zu erzeugenden PIs (per `standardPiSchedule`)
 * und markiert pro Eintrag, ob er als „neu" angelegt wird oder mit einem
 * existierenden PI in Konflikt steht (per `selectFreeStandardPis`). „Anwenden"
 * triggert die bestehende `addStandardPisAction`.
 */
export function StandardPreviewDialog({
  open,
  onOpenChange,
  timelineId,
  standards,
  existingPis,
}: Props) {
  const [standardId, setStandardId] = useState(standards[0]?.id ?? "");
  const currentYear = new Date().getUTCFullYear();
  const [year, setYear] = useState(currentYear);
  const [state, run, pending] = useActionState(addStandardPisAction, initialState);

  // Reset on open.
  useEffect(() => {
    if (open) {
      setStandardId(standards[0]?.id ?? "");
      setYear(new Date().getUTCFullYear());
    }
  }, [open, standards]);

  // Close on success.
  useEffect(() => {
    if (state?.success) onOpenChange(false);
  }, [state, onOpenChange]);

  const preview = useMemo(() => {
    const spec = standards.find((s) => s.id === standardId);
    if (!spec) return [];
    const schedule = standardPiSchedule(spec, year);
    const existing = existingPis.map((p) => ({
      startDate: new Date(`${p.startDate}T00:00:00Z`),
      endDate: new Date(`${p.endDate}T00:00:00Z`),
      name: p.name,
    }));
    const free = new Set(selectFreeStandardPis(schedule, existing).map((p) => p.name));
    return schedule.map((p) => {
      const fits = free.has(p.name);
      const conflict = fits
        ? null
        : (existing.find(
            (e) =>
              p.startDate.getTime() <= e.endDate.getTime() &&
              e.startDate.getTime() <= p.endDate.getTime(),
          )?.name ?? null);
      return {
        name: p.name,
        start: isoDay(p.startDate),
        end: isoDay(p.endDate),
        willCreate: fits,
        conflict,
      };
    });
  }, [standardId, year, standards, existingPis]);

  const newCount = preview.filter((p) => p.willCreate).length;
  const skipCount = preview.length - newCount;

  const onApply = () => {
    if (!standardId) return;
    const fd = new FormData();
    fd.set("timelineId", timelineId);
    fd.set("standardId", standardId);
    startTransition(() => run(fd));
  };

  if (standards.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>PI-Standard anwenden</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="std" className="text-xs font-medium">
                Standard
              </label>
              <select
                id="std"
                value={standardId}
                onChange={(e) => setStandardId(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              >
                {standards.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {s.cadenceWeeks}w × {s.piCount}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="year" className="text-xs font-medium">
                Jahr
              </label>
              <input
                id="year"
                type="number"
                min={currentYear - 1}
                max={currentYear + 5}
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm tabular-nums"
              />
            </div>
          </div>

          <div className="rounded-md border">
            <table className="w-full text-xs">
              <thead className="border-b bg-muted/40 text-left text-muted-foreground">
                <tr>
                  <th className="px-3 py-1.5">Name</th>
                  <th className="px-3 py-1.5">Start</th>
                  <th className="px-3 py-1.5">Ende</th>
                  <th className="px-3 py-1.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((p) => (
                  <tr key={p.name} className="border-b last:border-b-0">
                    <td className="px-3 py-1.5 font-medium">{p.name}</td>
                    <td className="px-3 py-1.5 tabular-nums text-muted-foreground">{p.start}</td>
                    <td className="px-3 py-1.5 tabular-nums text-muted-foreground">{p.end}</td>
                    <td className="px-3 py-1.5">
                      {p.willCreate ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
                          wird angelegt
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-900">
                          uebersprungen{p.conflict ? ` — Konflikt mit "${p.conflict}"` : ""}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-muted-foreground">
            <strong>{newCount}</strong> neu, <strong>{skipCount}</strong> uebersprungen.
          </p>

          {state?.error && (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          )}
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-9 rounded-md border px-3 text-sm hover:bg-muted/50"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={onApply}
            disabled={pending || newCount === 0}
            className="h-9 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {pending ? "Wende an…" : `Anwenden (${newCount})`}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
