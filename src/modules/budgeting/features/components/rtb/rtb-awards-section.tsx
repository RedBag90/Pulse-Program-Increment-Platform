"use client";

import { useActionState, useState } from "react";
import { saveRtbAwardsAction } from "@/modules/budgeting/features/actions/rtb";
import { formatEUR } from "@/lib/formatting";
import { RTB_KIND_LABELS, rtbKindOrDefault } from "@/modules/budgeting/domain/rtb-kind";
import type { RtbAwardView } from "@/modules/budgeting/server/services/rtb-award-service";

/**
 * Die Aufteilung des Zuspruchs auf die Positionen des Wertstroms.
 *
 * Die Runde entscheidet **eine** Summe je Wertstrom; hier entscheidet der
 * Wertstrom, wie viel davon der Betrieb bekommt und wie viel die
 * ART-Epic-Budget seiner ARTs. Aus den Rahmen-Zeilen entsteht der Topf, den
 * ein ART auf seine ART-Epics verteilen darf.
 */
export function RtbAwardsSection({
  valueStreamId,
  view,
  canManage,
}: {
  valueStreamId: string;
  view: RtbAwardView;
  canManage: boolean;
}) {
  const [state, action, pending] = useActionState(saveRtbAwardsAction, {});
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(view.rows.map((r) => [r.rtbItemId, String(r.amount)])),
  );

  const assigned = view.rows.reduce((s, r) => s + (Number(draft[r.rtbItemId]) || 0), 0);
  const awarded = view.awarded ?? 0;
  const rest = awarded - assigned;
  const editable = canManage && view.awarded != null && view.closedReason == null;

  if (view.rows.length === 0) return null;

  return (
    <section className="space-y-2">
      <div>
        <h2 className="text-sm font-medium">Zuspruch aufteilen · {view.cycleKey}</h2>
        <p className="text-xs text-muted-foreground">
          Die Runde spricht dem Wertstrom eine Summe zu; wie sie sich auf Betrieb und die
          ART-Epic-Budgets der ARTs verteilt, entscheidet er hier. Aus den Rahmen entsteht der Topf,
          den ein ART auf seine ART-Epics verteilen darf.
        </p>
      </div>

      {view.awarded == null ? (
        <p className="rounded-r-md border-l-2 bg-surface-frame px-3 py-2 text-sm text-muted-foreground">
          Für dieses Halbjahr ist noch nichts zugesprochen — die Kachel ist nicht abgeschlossen. Bis
          dahin gibt es nichts aufzuteilen, und die ART-Epic-Budgets stehen auf 0 €.
        </p>
      ) : (
        <form action={action} className="space-y-2">
          <input type="hidden" name="valueStreamId" value={valueStreamId} />
          <input type="hidden" name="cycleKey" value={view.cycleKey} />
          <input
            type="hidden"
            name="amounts"
            value={JSON.stringify(
              view.rows.map((r) => ({
                rtbItemId: r.rtbItemId,
                amount: Number(draft[r.rtbItemId]) || 0,
              })),
            )}
          />

          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-surface-frame text-xs text-muted-foreground">
                  <th className="p-2 text-left font-medium">Position</th>
                  <th className="p-2 text-left font-medium">Art</th>
                  <th className="p-2 text-right font-medium">Beantragt</th>
                  <th className="p-2 text-right font-medium">Zugeteilt</th>
                </tr>
              </thead>
              <tbody>
                {view.rows.map((r) => (
                  <tr key={r.rtbItemId} className="border-b last:border-0">
                    <td className="p-2">{r.name}</td>
                    <td className="p-2 text-muted-foreground">
                      {RTB_KIND_LABELS[rtbKindOrDefault(r.kind)]}
                    </td>
                    <td className="p-2 text-right tabular-nums">{formatEUR(r.ask)}</td>
                    <td className="p-2 text-right">
                      {editable ? (
                        <input
                          value={draft[r.rtbItemId] ?? "0"}
                          onChange={(e) =>
                            setDraft((p) => ({ ...p, [r.rtbItemId]: e.target.value }))
                          }
                          inputMode="numeric"
                          aria-label={`Zuteilung für ${r.name}`}
                          className="w-28 rounded-md border bg-background px-2 py-1 text-right tabular-nums"
                        />
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
                  <td className="p-2 text-right tabular-nums">{formatEUR(view.requested)}</td>
                  <td className="p-2 text-right tabular-nums">{formatEUR(assigned)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <p className={`text-sm ${rest < 0 ? "text-destructive" : "text-muted-foreground"}`}>
            Zugesprochen {formatEUR(awarded)} ·{" "}
            {rest < 0
              ? `${formatEUR(-rest)} zu viel verteilt`
              : `${formatEUR(rest)} noch nicht verteilt`}
          </p>

          {!view.saved && view.closedReason == null && (
            <p className="text-xs text-muted-foreground">
              Die Beträge sind anteilig vorbelegt — ein Vorschlag, keine Entscheidung. Erst mit dem
              Speichern gelten sie.
            </p>
          )}

          {view.closedReason && (
            <p className="rounded-r-md border-l-2 bg-surface-frame px-3 py-2 text-sm text-muted-foreground">
              {view.closedReason}
            </p>
          )}

          {state.error && (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          )}

          {editable && (
            <button
              type="submit"
              disabled={pending || rest < 0}
              className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
            >
              {pending ? "Speichere…" : "Aufteilung speichern"}
            </button>
          )}
        </form>
      )}
    </section>
  );
}
