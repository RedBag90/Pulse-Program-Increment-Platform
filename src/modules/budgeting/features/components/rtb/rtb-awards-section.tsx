"use client";

import { useActionState, useState } from "react";
import { saveRtbAwardsAction } from "@/modules/budgeting/features/actions/rtb";
import { Link } from "@/i18n/navigation";
import { formatEUR } from "@/lib/formatting";
import { SectionCard } from "@/components/ui/section-card";
import { RTB_KIND_LABELS, rtbKindOrDefault } from "@/modules/budgeting/domain/rtb-kind";
import type { RtbAwardView } from "@/modules/budgeting/server/services/rtb-award-service";

/**
 * Die Aufteilung des Zuspruchs auf die Positionen des Wertstroms.
 *
 * Die Runde entscheidet **eine** Summe je Wertstrom; hier entscheidet der
 * Wertstrom, wie viel davon der Betrieb bekommt und wie viel die
 * ART-Rahmen seiner ARTs. Aus den Rahmen-Zeilen entsteht der Topf, den
 * ein ART auf seine ART-Epics verteilen darf.
 */
export function RtbAwardsSection({
  valueStreamId,
  view,
  canManage,
  setupHref,
}: {
  valueStreamId: string;
  view: RtbAwardView;
  canManage: boolean;
  /** Wohin man geht, wenn es noch keine Position gibt — der Reiter „Einrichten". */
  setupHref: string;
}) {
  const [state, action, pending] = useActionState(saveRtbAwardsAction, {});
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(view.rows.map((r) => [r.rtbItemId, String(r.amount)])),
  );

  const assigned = view.rows.reduce((s, r) => s + (Number(draft[r.rtbItemId]) || 0), 0);
  const awarded = view.awarded ?? 0;
  const rest = awarded - assigned;
  const editable = canManage && view.awarded != null && view.closedReason == null;

  /**
   * **Die Schiene bleibt, der Knopf geht** (REQ-12). Hier stand `return null` —
   * und damit sah ein Wertstrom ohne Positionen genauso aus wie einer, dessen
   * Aufteilung erledigt ist: gar nicht. Die Karte bleibt der Ort, an dem
   * aufgeteilt wird, und sagt, was dafür fehlt.
   */
  if (view.rows.length === 0) {
    return (
      <SectionCard title={`Zuspruch aufteilen · ${view.cycleKey}`} step={4}>
        <p className="text-sm text-muted-foreground">
          Dieser Wertstrom hat keine aktive Position — es gibt nichts, worauf sich ein Zuspruch
          aufteilen liesse.{" "}
          <Link href={setupHref} className="text-primary hover:underline">
            Positionen einrichten →
          </Link>
        </p>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title={`Zuspruch aufteilen · ${view.cycleKey}`}
      step={4}
      description="Die Runde spricht dem Wertstrom eine Summe zu; wie sie sich auf Betrieb und die ART-Rahmen der ARTs verteilt, entscheidet er hier. Aus den Rahmen entsteht der Rahmen, den ein ART auf seine ART-Epics verteilen darf."
      contentClassName="space-y-3"
    >
      {view.awarded == null ? (
        <p className="text-sm text-muted-foreground">
          Für dieses Halbjahr ist noch nichts zugesprochen — die Kachel ist nicht abgeschlossen. Bis
          dahin gibt es nichts aufzuteilen, und die ART-Rahmen stehen auf 0 €.
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

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-surface-frame text-meta uppercase tracking-[0.1em] text-muted-foreground">
                  <th className="p-2 text-left font-medium">Position</th>
                  <th className="p-2 text-left font-medium">Art</th>
                  <th className="p-2 text-right font-medium">Beantragt</th>
                  {/*
                    „Zugesprochen", nicht „Zugeteilt": das ist das Ergebnis der
                    Kachel. „Zugeteilt" heisst auf diesen Flächen die Summe, die
                    aus Epic-Zuteilungen an einem ART hängt — zwei Zahlen, die
                    sich nicht denselben Namen teilen dürfen (Spec §2.5).
                  */}
                  <th className="p-2 text-right font-medium">Zugesprochen</th>
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
            <p className="text-sm text-muted-foreground">{view.closedReason}</p>
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
    </SectionCard>
  );
}
