"use client";

import { Info, ArrowRight } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { GATE_CRITERIA_DOC, SUB_STAGE_RULES } from "@/modules/work/domain/epic-lifecycle-doc";

/**
 * In-App-Hilfe für den Reifegrad-Lebenszyklus auf der Epic-Detail-Page.
 *
 * Zwei Sektionen: was ein Wechsel voraussetzt, und wie die Sub-Stages abgeleitet
 * werden. Die frühere dritte Sektion („manuell gesperrte Transitionen") ist
 * entfallen — es gibt keine gesperrten Übergänge mehr, weil kein Übergang mehr
 * automatisch passiert: jeder wird beantragt und abgenommen.
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
          <p className="text-sm font-medium">Reifegrad-Lebenszyklus</p>
          <p className="mt-0.5 text-muted-foreground">
            Jeder Wechsel wird beantragt und von benannten Personen abgenommen — nichts rückt von
            selbst vor. Hier steht, was ein Wechsel voraussetzt und wie die Sub-Stages entstehen.
          </p>
        </header>

        {/* A · Voraussetzungen je Wechsel */}
        <section className="space-y-1.5">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Voraussetzungen je Wechsel
          </h4>
          <p className="text-muted-foreground">
            Fett = blockierend (der Antrag ist ohne das nicht möglich). Der Rest ist beratend.
          </p>
          <ul className="space-y-1">
            {GATE_CRITERIA_DOC.map((g) => (
              <li
                key={`${g.stageFrom}-${g.stageTo}`}
                className="flex items-start gap-2 rounded border bg-muted/20 px-2 py-1.5"
              >
                <span className="mt-0.5 inline-flex shrink-0 items-center gap-0.5 rounded bg-background px-1.5 py-0.5 font-mono text-[10px] font-medium">
                  {g.stageFrom}
                  <ArrowRight className="size-2.5" />
                  {g.stageTo}
                </span>
                <span className="flex-1">
                  {g.criteria.length === 0 ? (
                    <span className="text-muted-foreground">Keine inhaltliche Voraussetzung.</span>
                  ) : (
                    g.criteria.map((c) => (
                      <span
                        key={c.label}
                        className={`block ${c.blocking ? "font-medium" : "text-muted-foreground"}`}
                      >
                        {c.label}
                      </span>
                    ))
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

      </PopoverContent>
    </Popover>
  );
}
