"use client";

import { Info, Lock, ArrowRight } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  LIFECYCLE_TRIGGERS,
  SUB_STAGE_RULES,
  BLOCKED_MANUAL_TRANSITIONS,
} from "@/domain/epic-lifecycle-doc";

/**
 * In-App-Hilfe fuer den Stage-Gate-Lebenszyklus auf der Epic-Detail-Page.
 * Drei Sektionen — Trigger, Sub-Stages, gesperrte Transitionen. Die
 * Bucket-Mapping-Sicht lebt separat in `KanbanBucketHelp` und ist nur am
 * Portfolio-Kanban zu finden.
 */
export function StageGateLifecycleHelp({ className }: { className?: string }) {
  return (
    <Popover>
      <PopoverTrigger
        aria-label="Stage-Gate-Lebenszyklus erklaeren"
        className={`inline-flex size-5 items-center justify-center rounded-full text-muted-foreground hover:bg-muted/60 hover:text-foreground ${className ?? ""}`}
      >
        <Info className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent className="w-[640px] max-w-[92vw] space-y-4 p-4 text-xs">
        <header>
          <p className="text-sm font-medium">Stage-Gate-Lebenszyklus</p>
          <p className="mt-0.5 text-muted-foreground">
            Welches Event verschiebt das Gate, welche Sub-Stages folgen aus den Quell- Feldern, und
            welche Transitionen sind manuell gesperrt.
          </p>
        </header>

        {/* A · Auto-Advance-Trigger */}
        <section className="space-y-1.5">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Stage-Gate-Trigger (automatisch)
          </h4>
          <ul className="space-y-1">
            {LIFECYCLE_TRIGGERS.map((t) => (
              <li
                key={`${t.stageFrom}-${t.stageTo}`}
                className="flex items-start gap-2 rounded border bg-muted/20 px-2 py-1.5"
              >
                <span className="mt-0.5 inline-flex shrink-0 items-center gap-0.5 rounded bg-background px-1.5 py-0.5 font-mono text-[10px] font-medium">
                  {t.stageFrom}
                  <ArrowRight className="size-2.5" />
                  {t.stageTo}
                </span>
                <span className="flex-1">
                  <span className="block">{t.event}</span>
                  {t.subStageAfter && (
                    <span className="text-muted-foreground">
                      Sub-Stage danach: {t.subStageAfter}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* B · Sub-Stages */}
        <section className="space-y-1.5">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Sub-Stage-Derivation
          </h4>
          <p className="text-muted-foreground">
            Reine UI-Ableitung aus persistierten Feldern — kein eigener Audit-Eintrag.
          </p>
          <table className="w-full">
            <thead className="text-muted-foreground">
              <tr>
                <th className="py-0.5 text-left font-medium">Gate</th>
                <th className="py-0.5 text-left font-medium">Sub-Stage</th>
                <th className="py-0.5 text-left font-medium">Bedeutung</th>
                <th className="py-0.5 text-left font-medium">Bedingung</th>
              </tr>
            </thead>
            <tbody>
              {SUB_STAGE_RULES.map((r) => (
                <tr key={r.key} className="border-t border-border/50">
                  <td className="py-1 font-mono">{r.gate}</td>
                  <td className="py-1 font-mono">{r.key}</td>
                  <td className="py-1">{r.label}</td>
                  <td className="py-1 font-mono text-[10px] text-muted-foreground">
                    {r.condition}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* D · Manuell gesperrt */}
        <section className="space-y-1.5">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Manuell gesperrte Transitionen
          </h4>
          <ul className="space-y-1">
            {BLOCKED_MANUAL_TRANSITIONS.map((b) => (
              <li
                key={`${b.from}-${b.to}`}
                className="flex items-start gap-2 rounded border border-amber-200 bg-amber-50/60 px-2 py-1.5 dark:border-amber-900/50 dark:bg-amber-950/30"
              >
                <Lock className="mt-0.5 size-3 shrink-0 text-amber-700 dark:text-amber-400" />
                <span className="flex-1">
                  <span className="inline-flex items-center gap-0.5 font-mono text-[10px] font-medium">
                    {b.from}
                    <ArrowRight className="size-2.5" />
                    {b.to}
                  </span>
                  <span className="ml-2">{b.reason}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </PopoverContent>
    </Popover>
  );
}
