"use client";

import { useActionState, useState } from "react";

import { formatEUR } from "@/lib/formatting";
import { setArtEpicAllocationAction } from "@/modules/budgeting/features/actions/art-pot";
import type { ArtPotView } from "@/modules/budgeting/server/views/art-budget-detail";

/**
 * Der Veränderungsrahmen eines ARTs und seine Verteilung auf ART-Epics.
 *
 * Nichts ist vorbelegt, und sortiert wird nach Richtwert, nicht nach Eingabe —
 * dieselben zwei Regeln wie im Verteilbogen der Gruppen: jede Zuteilung ist eine
 * Entscheidung, und beim Tippen springt keine Zeile.
 *
 * Verteilt wird **nicht** vom ART: zuständig sind Wertstrom-Owner,
 * Finance-Partei und Portfolio-Management. Die Fläche liegt hier, weil hier der
 * Zusammenhang sichtbar wird — die Entscheidung liegt es nicht.
 */
export function ArtPotSection({
  view,
  artId,
  canDistribute,
}: {
  view: ArtPotView;
  artId: string;
  canDistribute: boolean;
}) {
  const { pot, rows } = view;
  const [state, formAction, pending] = useActionState(setArtEpicAllocationAction, {});
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(rows.map((r) => [r.epicId, String(r.amount)])),
  );

  const sum = rows.reduce((s, r) => s + (Number(draft[r.epicId]) || 0), 0);
  const over = sum > pot.total;
  const askSum = rows.reduce((s, r) => s + r.ask, 0);

  if (pot.total === 0 && rows.length === 0) {
    return (
      <section className="space-y-2">
        <h2 className="text-lg font-medium">ART-Epics finanzieren</h2>
        <p className="rounded-r-md border-l-2 bg-surface-frame px-3 py-2 text-sm text-muted-foreground">
          Für dieses Halbjahr ist diesem ART kein Veränderungsrahmen zugeteilt. Ein Rahmen wird als
          Run-the-Business-Position im Wertstrom angelegt und in der Kachel mitverteilt.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-medium">ART-Epics finanzieren · {pot.cycleKey}</h2>
      <p className="text-sm text-muted-foreground">
        Aus dem Veränderungsrahmen des ARTs. Portfolio-Epics laufen über die Kachel.
      </p>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: "ART-Topf", value: pot.total, tone: "" },
          { label: "Verteilt", value: sum, tone: "var(--primary)" },
          { label: "Rest", value: pot.total - sum, tone: over ? "var(--destructive)" : "" },
        ].map((t) => (
          <div key={t.label} className="rounded-lg border bg-card p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t.label}
            </div>
            <div
              className="mt-1 text-2xl font-semibold tabular-nums"
              style={t.tone ? { color: t.tone } : undefined}
            >
              {formatEUR(t.value)}
            </div>
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Kein vorgemerktes ART-Epic in diesem ART. Die Vormerkung setzt der Epic Owner.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-surface-frame text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                <th className="p-2 text-left font-semibold">Epic</th>
                <th className="p-2 text-left font-semibold">Reifegrad</th>
                <th className="p-2 text-right font-semibold">Richtwert</th>
                <th className="p-2 text-right font-semibold">Zuteilung</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.epicId} className="border-b last:border-b-0">
                  <td className="p-2">
                    {r.title}
                    {r.askDrifted && (
                      <span className="ml-2 text-xs text-amber-700 dark:text-amber-400">
                        Business Case weicht vom eingefrorenen Richtwert ab
                      </span>
                    )}
                  </td>
                  <td className="p-2">
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                      {r.stageGate}
                    </span>
                  </td>
                  <td className="p-2 text-right tabular-nums">{formatEUR(r.ask)}</td>
                  <td className="p-2 text-right">
                    {canDistribute && pot.closedReason == null ? (
                      <form action={formAction} className="inline-flex items-center gap-1">
                        <input type="hidden" name="artId" value={artId} />
                        <input type="hidden" name="epicId" value={r.epicId} />
                        <input type="hidden" name="cycleKey" value={pot.cycleKey} />
                        <input type="hidden" name="ask" value={r.ask} />
                        <input
                          name="amount"
                          value={draft[r.epicId] ?? "0"}
                          onChange={(ev) =>
                            setDraft((p) => ({ ...p, [r.epicId]: ev.target.value }))
                          }
                          inputMode="numeric"
                          className="w-28 rounded-md border bg-background px-2 py-1 text-right tabular-nums"
                        />
                        <button
                          type="submit"
                          disabled={pending}
                          className="rounded-md border px-2 py-1 text-xs disabled:opacity-50"
                        >
                          ✓
                        </button>
                      </form>
                    ) : (
                      <span className="tabular-nums">{formatEUR(r.amount)}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t bg-surface-frame font-semibold">
                <td className="p-2">Σ</td>
                <td className="p-2" />
                <td className="p-2 text-right tabular-nums">{formatEUR(askSum)}</td>
                <td className="p-2 text-right tabular-nums">{formatEUR(sum)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {over && (
        <p role="alert" className="text-sm text-destructive">
          Die Summe überschreitet den Rahmen um {formatEUR(sum - pot.total)}.
        </p>
      )}
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      {pot.closedReason && (
        <p className="rounded-r-md border-l-2 bg-surface-frame px-3 py-2 text-sm text-muted-foreground">
          {pot.closedReason}
        </p>
      )}
      {pot.remaining > 0 && pot.closedReason == null && (
        <p className="text-sm text-muted-foreground">
          {formatEUR(pot.remaining)} des Rahmens sind ungenutzt. Sie verfallen nicht und wandern
          nicht — sie sind die Grundlage für das Gespräch über den nächsten Rahmen.
        </p>
      )}
      <p className="text-sm text-muted-foreground">
        Die Zuteilung erfüllt das blockierende Kriterium für L3.2. Beantragt und abgenommen wird wie
        bei jedem Epic.
      </p>
    </section>
  );
}
