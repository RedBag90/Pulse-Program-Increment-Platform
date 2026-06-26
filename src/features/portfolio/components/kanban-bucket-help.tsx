"use client";

import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { BUCKET_RULES } from "@/domain/epic-lifecycle-doc";

/**
 * In-App-Hilfe fuer das Portfolio-Kanban: erklaert die Mapping-Regel
 * zwischen `stageGate`-Wert und sichtbarer Kanban-Spalte. Bewusst nur diese
 * eine Sicht — der breitere Stage-Gate-Lebenszyklus (Trigger, Sub-Stages,
 * gesperrte Transitionen) lebt in `StageGateLifecycleHelp` und wird neben
 * dem Reifegrad-Track auf der Epic-Detail-Page gezeigt.
 */
export function KanbanBucketHelp({ className }: { className?: string }) {
  return (
    <Popover>
      <PopoverTrigger
        aria-label="Kanban-Bucket-Regeln erklaeren"
        className={`inline-flex size-5 items-center justify-center rounded-full text-muted-foreground hover:bg-muted/60 hover:text-foreground ${className ?? ""}`}
      >
        <Info className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent className="w-[560px] max-w-[92vw] space-y-3 p-4 text-xs">
        <header>
          <p className="text-sm font-medium">Kanban-Bucket-Regeln</p>
          <p className="mt-0.5 text-muted-foreground">
            Welche Karte landet in welcher Spalte? Bucket und Stage-Gate sind nicht 1:1 — zwei
            Override-Regeln verschieben Karten visuell.
          </p>
        </header>

        <table className="w-full">
          <thead className="text-muted-foreground">
            <tr>
              <th className="py-0.5 text-left font-medium">Stage-Gate</th>
              <th className="py-0.5 text-left font-medium">Zusatzbedingung</th>
              <th className="py-0.5 text-left font-medium">Bucket</th>
              <th className="py-0.5 text-left font-medium">Spalte</th>
            </tr>
          </thead>
          <tbody>
            {BUCKET_RULES.map((r, i) => {
              const isOverride = r.stageGate !== r.bucket;
              return (
                <tr
                  key={i}
                  className={`border-t border-border/50 ${isOverride ? "bg-amber-50/40 dark:bg-amber-950/20" : ""}`}
                >
                  <td className="py-1 font-mono">{r.stageGate}</td>
                  <td className="py-1 font-mono text-[10px] text-muted-foreground">
                    {r.precondition ?? "—"}
                  </td>
                  <td className="py-1 font-mono">{r.bucket}</td>
                  <td className="py-1">{r.bucketLabel}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <p className="text-[11px] text-muted-foreground">
          Goldfarbene Zeilen sind die Override-Regeln (Bucket ≠ Stage-Gate). Der eigentliche
          Stage-Gate-Wert bleibt am Epic unveraendert — nur die Spalte verschiebt sich.
        </p>
      </PopoverContent>
    </Popover>
  );
}
