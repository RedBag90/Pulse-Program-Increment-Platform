"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DistributionOverviewModel } from "@/modules/budgeting/server/views/distribution-overview";
import {
  closeDistributionAction,
  finalizePeriodAction,
  startNextPeriodAction,
} from "@/modules/budgeting/features/actions/finalize";

const EUR = (n: number) => `${n.toLocaleString("de-DE")} €`;
const cell = "px-2 py-1.5 text-right tabular-nums";
const btn = "rounded bg-blue-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50";
const btnGreen =
  "rounded bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50";

/**
 * Finance-Übersicht: Matrix Gruppen × Kandidaten (live), Finalisierung im Status
 * `decided` (finaler €-Betrag je Kandidat, vorbefüllt aus dem Median) und
 * „Nächsten Zeitraum starten" nach dem Schließen.
 */
export function DistributionOverviewTab({ model }: { model: DistributionOverviewModel }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const decided = model.status === "decided";
  const closed = model.status === "closed";

  const [finals, setFinals] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      model.candidates.map((c) => [c.id, String(c.finalAmount ?? c.suggestion)]),
    ),
  );

  const finalTotal = useMemo(
    () => (closed
      ? model.candidates.reduce((s, c) => s + (c.finalAmount ?? 0), 0)
      : model.candidates.reduce((s, c) => s + (Number(finals[c.id]) || 0), 0)),
    [finals, model.candidates, closed],
  );
  const reserve = model.distributable - finalTotal;

  function runClose() {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", model.roundId);
      const res = await closeDistributionAction({}, fd);
      if (res.error) return setError(res.error);
      router.refresh();
    });
  }

  function runFinalize() {
    setError(null);
    startTransition(async () => {
      const payload = model.candidates.map((c) => ({ candidateId: c.id, amount: Number(finals[c.id]) || 0 }));
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-muted-foreground">
          Abgaben: {model.submittedCount} / {model.groups.length} Gruppen
          {model.deadlinePassed && <span className="ml-1 text-amber-600">· Deadline verstrichen</span>}
        </span>
        <span className="text-xs text-muted-foreground">
          Verteilbar {EUR(model.distributable)} · {closed || decided ? `Finalisiert ${EUR(finalTotal)} · Reserve ${EUR(reserve)}` : ""}
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
              <th className="px-2 py-1.5 text-left font-medium">Kandidat</th>
              {model.groups.map((g) => (
                <th key={g.id} className="px-2 py-1.5 text-right font-medium">
                  {g.name} {g.submitted ? "✓" : "⏳"}
                </th>
              ))}
              <th className="px-2 py-1.5 text-right font-medium">Median</th>
              {(decided || closed) && <th className="px-2 py-1.5 text-right font-medium">Final</th>}
            </tr>
          </thead>
          <tbody>
            {model.candidates.map((c) => (
              <tr key={c.id} className="border-b last:border-b-0">
                <td className="px-2 py-1.5">
                  {c.title}
                  {c.kind === "rtb" && <span className="ml-1 text-xs text-amber-700">RtB</span>}
                </td>
                {model.groups.map((g) => (
                  <td key={g.id} className={cell}>
                    {c.amounts[g.id] != null ? EUR(c.amounts[g.id]!) : "—"}
                  </td>
                ))}
                <td className={`${cell} text-muted-foreground`}>{EUR(c.suggestion)}</td>
                {decided && (
                  <td className={cell}>
                    <input
                      type="number"
                      min={0}
                      step={1000}
                      value={finals[c.id] ?? "0"}
                      disabled={!model.canFinalize}
                      onChange={(e) => setFinals((f) => ({ ...f, [c.id]: e.target.value }))}
                      className="w-28 rounded border border-gray-300 px-2 py-1 text-right text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                    />
                  </td>
                )}
                {closed && <td className={`${cell} font-medium`}>{EUR(c.finalAmount ?? 0)}</td>}
              </tr>
            ))}
            {model.candidates.length === 0 && (
              <tr>
                <td colSpan={model.groups.length + 2} className="px-2 py-6 text-center text-muted-foreground">
                  Noch keine Kandidaten (Runde noch nicht gestartet?).
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {model.canFinalize && (
        <div className="flex items-center gap-2">
          {model.status === "running" && (
            <button type="button" onClick={runClose} disabled={pending} className={btn}>
              {pending ? "…" : "Verteilung schließen → Finalisierung"}
            </button>
          )}
          {decided && (
            <button type="button" onClick={runFinalize} disabled={pending || reserve < 0} className={btnGreen}>
              {pending ? "…" : "Als tatsächliche Verteilung speichern"}
            </button>
          )}
          {closed && (
            <button type="button" onClick={runNext} disabled={pending} className={btn}>
              {pending ? "…" : "Nächsten Zeitraum starten →"}
            </button>
          )}
        </div>
      )}
      {decided && reserve < 0 && (
        <p className="text-sm text-red-600">Die Summe der finalen Beträge überschreitet den verteilbaren Topf.</p>
      )}
    </div>
  );
}
