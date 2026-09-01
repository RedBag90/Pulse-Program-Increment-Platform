"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Fragment } from "react";
import type {
  DistributionOverviewModel,
  OverviewCandidate,
} from "@/modules/budgeting/server/views/distribution-overview";
import { CandidateWorksheet } from "@/modules/budgeting/features/components/period/candidate-worksheet";
import type { PeriodValueStreamsModel } from "@/modules/budgeting/server/views/period-valuestreams";
import {
  finalizePeriodAction,
  reopenPeriodAction,
  startNextPeriodAction,
} from "@/modules/budgeting/features/actions/finalize";
import { CaptureRevisionButton } from "@/modules/budgeting/features/components/revision/capture-revision-button";
import { ConfirmMutateForm } from "@/components/actions/confirm-mutate-form";
import { formatEUR } from "@/lib/formatting";

const btn =
  "rounded bg-blue-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50";
const btnGreen =
  "rounded bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50";

/**
 * Reiter „Ergebnis": die endgültigen Beträge, die daraus abgeleiteten
 * Wertstrom-/ART-Budgets und das Einfrieren — in dieser Reihenfolge.
 *
 * Der Snapshot stand bisher zwei Nav-Ebenen entfernt auf der Controlling-Seite
 * und fror dort das *heutige* Halbjahr ein, nicht diese Kachel. Jetzt steht er
 * neben dem Ergebnis, das er festhält, und bekommt dessen Zyklus mitgegeben.
 */
export function PeriodResultTab({
  model,
  valueStreams,
  cycleKey,
  cycleLabel,
  canCapture,
  hasRevision,
}: {
  model: DistributionOverviewModel;
  valueStreams: PeriodValueStreamsModel | null;
  cycleKey: string;
  cycleLabel: string;
  canCapture: boolean;
  hasRevision: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const decided = model.status === "decided";
  const closed = model.status === "closed";

  const [finals, setFinals] = useState<Record<string, string>>(() =>
    Object.fromEntries(model.candidates.map((c) => [c.id, String(c.finalAmount ?? c.suggestion)])),
  );

  const finalTotal = useMemo(
    () =>
      closed
        ? model.candidates.reduce((s, c) => s + (c.finalAmount ?? 0), 0)
        : model.candidates.reduce((s, c) => s + (Number(finals[c.id]) || 0), 0),
    [finals, model.candidates, closed],
  );
  const reserve = model.distributable - finalTotal;

  if (!decided && !closed) {
    return (
      <p className="text-sm text-muted-foreground">
        Noch kein Ergebnis — erst wenn die Verteilung geschlossen ist, setzt Finance hier die
        endgültigen Beträge.
      </p>
    );
  }

  function runFinalize() {
    const missing = model.groups.length - model.submittedCount;
    const warning =
      missing > 0
        ? `\n\nAchtung: erst ${model.submittedCount} von ${model.groups.length} Gruppen haben abgegeben.`
        : "";
    if (
      !window.confirm(
        "Verteilung festschreiben? Die Kachel geht damit auf „abgeschlossen“ und die " +
          "Beträge sind nur über „Finalisierung zurücknehmen“ wieder änderbar." +
          warning,
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const payload = model.candidates.map((c) => ({
        candidateId: c.id,
        amount: Number(finals[c.id]) || 0,
      }));
      const fd = new FormData();
      fd.set("id", model.roundId);
      fd.set("finals", JSON.stringify(payload));
      const res = await finalizePeriodAction({}, fd);
      if (res.error) return setError(res.error);
      router.refresh();
    });
  }

  function runNext() {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("fromRoundId", model.roundId);
      const res = await startNextPeriodAction({}, fd);
      if (res.error) return setError(res.error);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Finale Beträge
          </h3>
          <span className="text-xs text-muted-foreground">
            Verteilbar {formatEUR(model.distributable)} · Festgeschrieben {formatEUR(finalTotal)} ·{" "}
            <span className={reserve < 0 ? "font-medium text-destructive" : ""}>
              Reserve {formatEUR(reserve)}
            </span>
          </span>
        </div>
        <CandidateWorksheet
          items={model.candidates}
          // Nach der **Anfrage** sortiert, nicht nach dem Endbetrag: beim
          // Setzen der Zahlen darf keine Zeile ihre Position wechseln.
          sortBy={(c: OverviewCandidate) => c.ask}
          columns={[
            {
              key: "ask",
              label: "Anfrage",
              value: (c: OverviewCandidate) => c.ask,
              width: "120px",
            },
            {
              key: "median",
              label: "Median",
              value: (c: OverviewCandidate) => c.suggestion,
              width: "120px",
            },
            {
              key: "final",
              label: "Final",
              value: (c: OverviewCandidate) =>
                decided ? Number(finals[c.id]) || 0 : (c.finalAmount ?? 0),
              width: "140px",
              cell: (c: OverviewCandidate) =>
                decided ? (
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    value={finals[c.id] ?? "0"}
                    disabled={!model.canFinalize}
                    onChange={(e) => setFinals((f) => ({ ...f, [c.id]: e.target.value }))}
                    className="w-28 rounded border border-gray-300 px-2 py-1 text-right text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                  />
                ) : (
                  <span className="font-medium">{formatEUR(c.finalAmount ?? 0)}</span>
                ),
            },
          ]}
          progress={{ of: "final", against: "ask" }}
          title={(c) => <span className="truncate">{c.title}</span>}
          empty="Keine Kandidaten."
        />

        {error && <p className="text-sm text-red-600">{error}</p>}
        {decided && reserve < 0 && (
          <p className="text-sm text-red-600">
            Die Summe der finalen Beträge überschreitet den verteilbaren Topf.
          </p>
        )}

        {model.canFinalize && (
          <div className="flex flex-wrap items-center gap-3 pt-1">
            {decided && (
              <>
                <button
                  type="button"
                  onClick={runFinalize}
                  disabled={pending || reserve < 0}
                  className={btnGreen}
                >
                  {pending ? "…" : "Verteilung festschreiben"}
                </button>
                <span className="text-xs text-muted-foreground">
                  Setzt die Kachel auf „abgeschlossen"; danach nur noch über „Finalisierung
                  zurücknehmen" änderbar.
                </span>
              </>
            )}
            {closed && (
              <ConfirmMutateForm
                action={reopenPeriodAction}
                fields={{ id: model.roundId }}
                label="Finalisierung zurücknehmen"
                pendingLabel="Nehme zurück…"
                confirmPrompt="Finalisierung zurücknehmen? Die Kachel geht zurück auf „entschieden“; die finalen Beträge bleiben als Vorbelegung erhalten."
                variant="outline"
              />
            )}
          </div>
        )}
      </section>

      {closed && valueStreams && valueStreams.rows.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Abgeleitete Budgets
          </h3>
          <p className="text-xs text-muted-foreground">
            Aus den finalen Beträgen oben: Wertstrom-Budget = Run the Business + Grow the Business
            (Epics nach ART).
          </p>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                  <th className="px-3 py-2 text-left font-medium">
                    Value Stream / Aufschlüsselung
                  </th>
                  <th className="px-3 py-2 text-right font-medium">Σ Budget</th>
                </tr>
              </thead>
              <tbody>
                {valueStreams.rows.map((vs) => (
                  <Fragment key={vs.valueStreamId ?? "none"}>
                    <tr className="border-b bg-muted/20">
                      <td className="px-3 py-2 font-medium">{vs.valueStreamName}</td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums">
                        {formatEUR(vs.total)}
                      </td>
                    </tr>
                    {vs.runTotal > 0 && (
                      <tr className="border-b">
                        <td className="px-3 py-1.5 pl-8 text-amber-700">Run the Business</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">
                          {formatEUR(vs.runTotal)}
                        </td>
                      </tr>
                    )}
                    {vs.arts.map((art) => (
                      <tr key={art.artId ?? "noart"} className="border-b">
                        <td className="px-3 py-1.5 pl-8 text-muted-foreground">
                          ART {art.artName}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums">
                          {formatEUR(art.total)}
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
                <tr className="border-t bg-muted/40 font-medium">
                  <td className="px-3 py-2">Σ gesamt</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatEUR(valueStreams.grandTotal)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}

      {closed && (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Stand einfrieren
          </h3>
          <div className="flex flex-wrap items-center gap-3">
            {canCapture ? (
              <CaptureRevisionButton
                cycleLabel={cycleLabel}
                cycleKey={cycleKey}
                variant="compact"
              />
            ) : (
              <span className="text-sm text-muted-foreground">
                Ohne das Recht „Budget-Plan erfassen" nicht möglich.
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              {hasRevision
                ? "Für diesen Zeitraum ist bereits ein Budget-Plan erfasst — erneutes Erfassen überschreibt ihn."
                : "Friert genau die Zahlen oben ein."}
            </span>
          </div>
        </section>
      )}

      {closed && model.canFinalize && (
        <section className="flex flex-wrap items-center gap-3 border-t pt-4">
          <button type="button" onClick={runNext} disabled={pending} className={btn}>
            {pending ? "…" : "Nächsten Zeitraum starten →"}
          </button>
          <span className="text-xs text-muted-foreground">
            Übernimmt Beteiligte, Gruppen und die Reserve.
          </span>
        </section>
      )}
    </div>
  );
}
