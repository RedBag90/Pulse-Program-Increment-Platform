"use client";

import { useActionState, useState } from "react";

import { formatEUR } from "@/lib/formatting";
import { saveValueStreamGuardrailTargetsAction } from "@/modules/work/features/portfolio/actions/guardrail-targets";
import {
  GUARDRAIL_SOURCE_LABELS,
  type GuardrailTargetsSource,
} from "@/modules/work/domain/portfolio-guardrails";
import type {
  ClassificationPreview,
  ValueStreamCapacityMix,
} from "@/modules/work/server/views/value-stream-capacity-mix";

/**
 * Guardrail 2 und 3 eines Wertstroms: die Ziele setzen — und sehen, wie viel je
 * Arbeitstyp tatsächlich **abgeschlossen** wurde.
 *
 * Gemessen wird am zugeteilten Budget gelieferter Epics, nicht an
 * Business-Case-Schätzungen aller Epics. Das ist eine andere Frage als die der
 * tenant-weiten Guardrails-Fläche, deshalb steht die Messgrundlage im Titel.
 *
 * Leere Felder heißen **geerbt**, nicht „null". Wer nur das Portfolio-Limit
 * setzen will, soll den Capacity-Mix nicht mitschleppen müssen — sonst friert
 * er den Tenant-Stand ein, indem er ihn kopiert.
 */
export function ValueStreamGuardrailsSection({
  valueStreamId,
  mix,
  threshold,
  source,
  overriddenAxes,
  canEdit,
  preview,
}: {
  valueStreamId: string;
  mix: ValueStreamCapacityMix;
  threshold: number;
  source: GuardrailTargetsSource;
  overriddenAxes: string[];
  canEdit: boolean;
  /** Aufteilung bei diesem Limit — `null`, solange die Practice aus ist. */
  preview?: ClassificationPreview | null | undefined;
}) {
  const [state, formAction, pending] = useActionState(saveValueStreamGuardrailTargetsAction, {});
  const own = (axis: string) => overriddenAxes.includes(axis);
  const [business, setBusiness] = useState(own("capacity") ? String(mix.targets.business) : "");
  const [enabler, setEnabler] = useState(own("capacity") ? String(mix.targets.enabler) : "");
  const [limit, setLimit] = useState(own("approval") ? String(threshold) : "");

  const deviation = (bucket: "business" | "enabler") =>
    Math.round((mix.mix.rows[bucket].amountShare - mix.mix.rows[bucket].target) * 100);
  const worst = Math.max(Math.abs(deviation("business")), Math.abs(deviation("enabler")));
  const tone = worst > 15 ? "rose" : worst > 5 ? "amber" : "green";
  const thin = mix.totalEpics > 0 && mix.unclassified.count / mix.totalEpics > 0.2;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-3">
        <h2 className="text-lg font-medium">Guardrail 2 · Capacity Allocation</h2>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            tone === "rose"
              ? "bg-destructive/10 text-destructive"
              : tone === "amber"
                ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
          }`}
        >
          {tone === "green" ? "Im Ziel" : tone === "amber" ? "Abweichung" : "Kritisch"}
        </span>
        <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
          {GUARDRAIL_SOURCE_LABELS[source]}
        </span>
      </div>
      <p className="text-sm text-muted-foreground">
        Gemessen am <strong className="font-medium text-foreground">abgeschlossenen Budget</strong>{" "}
        dieses Wertstroms — nicht an den Business-Case-Schätzungen aller Epics, die die tenant-weite
        Guardrails-Fläche zeigt.
      </p>

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-surface-frame text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
              <th className="p-2 text-left font-semibold">Arbeitstyp</th>
              <th className="p-2 text-right font-semibold">Epics</th>
              <th className="p-2 text-right font-semibold">Abgeschlossen</th>
              <th className="p-2 text-right font-semibold">Anteil</th>
              <th className="p-2 text-right font-semibold">Ziel</th>
              <th className="p-2 text-right font-semibold">Abw.</th>
            </tr>
          </thead>
          <tbody>
            {(["business", "enabler"] as const).map((bucket) => {
              const row = mix.mix.rows[bucket];
              const d = deviation(bucket);
              return (
                <tr key={bucket} className="border-b last:border-b-0">
                  <td className="p-2">
                    {bucket === "business" ? "Business-Epics" : "Enabler-Epics"}
                  </td>
                  <td className="p-2 text-right tabular-nums">{row.count}</td>
                  <td className="p-2 text-right tabular-nums">{formatEUR(row.amount)}</td>
                  <td className="p-2 text-right tabular-nums">
                    {Math.round(row.amountShare * 100)} %
                  </td>
                  <td className="p-2 text-right tabular-nums text-muted-foreground">
                    {Math.round(row.target * 100)} %
                  </td>
                  <td
                    className={`p-2 text-right tabular-nums ${Math.abs(d) > 5 ? "text-destructive" : ""}`}
                  >
                    {d > 0 ? "+" : ""}
                    {d} pp
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {mix.byCycle.length > 1 && (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-surface-frame text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                <th className="p-2 text-left font-semibold">Entwicklung</th>
                <th className="p-2 text-right font-semibold">Business</th>
                <th className="p-2 text-right font-semibold">Enabler</th>
              </tr>
            </thead>
            <tbody>
              {mix.byCycle.map((c) => (
                <tr key={c.cycleKey} className="border-b last:border-b-0">
                  <td className="p-2">{c.label}</td>
                  <td className="p-2 text-right tabular-nums">
                    {formatEUR(c.business)} · {c.businessShare} %
                  </td>
                  <td className="p-2 text-right tabular-nums">
                    {formatEUR(c.enabler)} · {c.enablerShare} %
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {mix.unclassified.count > 0 && (
        <p className="rounded-r-md border-l-2 bg-surface-frame px-3 py-2 text-sm text-muted-foreground">
          <strong className="font-medium text-foreground">{mix.unclassified.count}</strong>{" "}
          gelieferte Epics tragen keinen Typ ({formatEUR(mix.unclassified.amount)}) und gehen nicht
          in die Anteile ein.
          {thin && " Ab 20 % unklassifiziert ist der Mix nur noch ein Indiz."}
        </p>
      )}

      {preview && (
        <div className="space-y-2 rounded-lg border bg-card p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Guardrail 3 · Aufteilung bei einem Limit von {formatEUR(preview.threshold)}
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="text-2xl font-semibold tabular-nums">{preview.portfolio.count}</div>
              <div className="text-xs text-muted-foreground">
                Portfolio-Epics · {formatEUR(preview.portfolio.amount)} · über den Ballot
              </div>
            </div>
            <div>
              <div className="text-2xl font-semibold tabular-nums">{preview.art.count}</div>
              <div className="text-xs text-muted-foreground">
                ART-Epics · {formatEUR(preview.art.amount)} · aus den ART-Rahmen
              </div>
            </div>
          </div>
          {preview.unclassified > 0 && (
            <p className="text-xs text-muted-foreground">
              {preview.unclassified} Epics sind noch nicht eingeordnet — ohne freigegebenen Business
              Case liegt keine belastbare Kostenschätzung vor. Sie bleiben Portfolio-Sache, bis er
              steht.
            </p>
          )}
          {preview.artWithoutArt > 0 && (
            <p className="rounded-r-md border-l-2 border-l-amber-600 bg-amber-500/[0.07] px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
              {preview.artWithoutArt} davon tragen keinen ART und hätten nach der Trennung keinen
              Finanzierungsweg.
            </p>
          )}
        </div>
      )}

      {canEdit && (
        <form action={formAction} className="space-y-2 rounded-lg border bg-card p-4">
          <input type="hidden" name="valueStreamId" value={valueStreamId} />
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Ziele dieses Wertstroms
          </p>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-2">
              Business
              <input
                name="business"
                value={business}
                onChange={(ev) => setBusiness(ev.target.value)}
                inputMode="numeric"
                placeholder="geerbt"
                className="w-20 rounded-md border bg-background px-2 py-1 text-right tabular-nums"
              />
              %
            </label>
            <label className="flex items-center gap-2">
              Enabler
              <input
                name="enabler"
                value={enabler}
                onChange={(ev) => setEnabler(ev.target.value)}
                inputMode="numeric"
                placeholder="geerbt"
                className="w-20 rounded-md border bg-background px-2 py-1 text-right tabular-nums"
              />
              %
            </label>
            <label className="flex items-center gap-2">
              Portfolio-Limit
              <input
                name="portfolioThreshold"
                value={limit}
                onChange={(ev) => setLimit(ev.target.value)}
                inputMode="numeric"
                placeholder="geerbt"
                className="w-28 rounded-md border bg-background px-2 py-1 text-right tabular-nums"
              />
              €
            </label>
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {pending ? "…" : "Speichern"}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Leer lassen heißt <strong className="font-medium">geerbt</strong>. Aktuell gilt:
            Business {mix.targets.business} % / Enabler {mix.targets.enabler} %, Portfolio-Limit{" "}
            {formatEUR(threshold)} — {GUARDRAIL_SOURCE_LABELS[source]}.
          </p>
          {state.error && (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          )}
        </form>
      )}
    </section>
  );
}
