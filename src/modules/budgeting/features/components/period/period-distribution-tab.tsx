"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Link } from "@/i18n/navigation";
import type { DistributionOverviewModel } from "@/modules/budgeting/server/views/distribution-overview";
import { closeDistributionAction } from "@/modules/budgeting/features/actions/finalize";
import { formatEUR } from "@/lib/formatting";

const cell = "px-2 py-1.5 text-right tabular-nums";
const btn =
  "rounded bg-blue-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50";

/**
 * Reiter „Verteilung": wer hat abgegeben, wer noch nicht, und was jede Gruppe
 * verteilt hat. Von hier führt der Weg in die Verteil-Route einer Gruppe — und
 * von dort auch wieder hierher zurück (früher landete man auf „Setup").
 *
 * Das Schließen der Verteilung steht am Ende der Fläche, an der sie stattfindet.
 */
export function PeriodDistributionTab({
  model,
  basePath,
}: {
  model: DistributionOverviewModel;
  basePath: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const running = model.status === "running";
  const allIn = model.groups.length > 0 && model.submittedCount >= model.groups.length;

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

  const distributedBy = (groupId: string): number =>
    model.candidates.reduce((s, c) => s + (c.amounts[groupId] ?? 0), 0);

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
          <span>
            <span className="font-medium">
              {model.submittedCount} von {model.groups.length}
            </span>{" "}
            <span className="text-muted-foreground">Gruppen haben abgegeben</span>
            {model.deadlinePassed && (
              <span className="ml-1 text-amber-600">· Deadline verstrichen</span>
            )}
          </span>
          <span className="text-xs text-muted-foreground">
            Verteilbar {formatEUR(model.distributable)}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width]"
            style={{
              width: `${model.groups.length > 0 ? Math.round((model.submittedCount / model.groups.length) * 100) : 0}%`,
            }}
          />
        </div>
      </section>

      <p className="text-xs text-muted-foreground">
        Auf Papier verteilen?{" "}
        <Link href={`${basePath}/sheet`} className="text-primary hover:underline">
          Verteilbögen drucken →
        </Link>
      </p>

      {model.groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Noch keine Gruppen — sie werden im Reiter „Setup" angelegt.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {model.groups.map((g) => (
            <li
              key={g.id}
              className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5"
            >
              <span className="font-medium">{g.name}</span>
              <span className="flex items-center gap-3 text-sm">
                <span className="tabular-nums text-muted-foreground">
                  {formatEUR(distributedBy(g.id))}
                </span>
                {g.submitted ? (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200">
                    eingereicht
                  </span>
                ) : (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    offen
                  </span>
                )}
                <Link
                  href={`${basePath}/distribute/${g.id}`}
                  className="rounded border px-2 py-1 text-xs font-medium hover:bg-muted"
                >
                  öffnen →
                </Link>
              </span>
            </li>
          ))}
        </ul>
      )}

      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Vorschläge je Gruppe
        </h3>
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
                      {c.amounts[g.id] != null ? formatEUR(c.amounts[g.id]!) : "—"}
                    </td>
                  ))}
                  <td className={`${cell} text-muted-foreground`}>{formatEUR(c.suggestion)}</td>
                </tr>
              ))}
              {model.candidates.length === 0 && (
                <tr>
                  <td
                    colSpan={model.groups.length + 2}
                    className="px-2 py-6 text-center text-muted-foreground"
                  >
                    Noch keine Kandidaten — die Runde ist nicht gestartet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {model.canFinalize && running && (
        <div className="flex flex-wrap items-center gap-3 border-t pt-4">
          <button type="button" onClick={runClose} disabled={pending} className={btn}>
            {pending ? "…" : "Verteilung schließen"}
          </button>
          <span className="text-xs text-muted-foreground">
            {allIn
              ? "Alle Gruppen sind eingereicht. Danach setzt Finance die endgültigen Beträge."
              : `Noch ${model.groups.length - model.submittedCount} offen — Schließen ist trotzdem möglich, wenn die Deadline verstrichen ist.`}
          </span>
        </div>
      )}
    </div>
  );
}
