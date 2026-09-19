"use client";

import { Fragment, useActionState, useState } from "react";
import { saveRtbAwardsAction } from "@/modules/budgeting/features/actions/rtb";
import { Link } from "@/i18n/navigation";
import { formatEUR } from "@/lib/formatting";
import { SectionCard } from "@/components/ui/section-card";
import { RTB_KINDS, RTB_KIND_LABELS, rtbKindOrDefault } from "@/modules/budgeting/domain/rtb-kind";
import { RTB_INTERVAL_LABELS, rtbIntervalOrDefault } from "@/modules/budgeting/domain/rtb-interval";
import {
  rtbAssignmentGroup,
  RTB_ASSIGNMENT_GROUPS,
  RTB_ASSIGNMENT_GROUP_LABELS,
} from "@/modules/budgeting/domain/rtb-art-resolution";
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

  /**
   * Die Zwischensummen: **beantragt** steht fest, **zugesprochen** rechnet aus
   * dem Entwurf mit — wie die Fusszeile es für das Ganze schon tut. Wer
   * verteilt, sieht sofort, wohin.
   */
  const summe = (rows: RtbAwardView["rows"], feld: "ask" | "amount") =>
    rows.reduce((s, r) => s + (feld === "ask" ? r.ask : Number(draft[r.rtbItemId]) || 0), 0);

  /** Was in der Zurechnungsspalte steht — die Wörter von „Einrichten". */
  const zurechnung = (r: RtbAwardView["rows"][number]) => {
    switch (rtbAssignmentGroup(r)) {
      case "art":
        return r.artName ?? "—";
      case "solution":
        return `${r.solutionName ?? "—"} · ${r.solutionArtName ?? "—"}`;

      default:
        return "—";
    }
  };

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
            <table className="w-full table-fixed text-sm">
              {/* Dieselben Breiten wie in „Einrichten", damit beide Flächen fluchten. */}
              <colgroup>
                <col />
                <col className="w-[20rem]" />
                <col className="w-28" />
                <col className="w-32" />
                <col className="w-36" />
              </colgroup>
              <thead>
                <tr className="border-b bg-surface-frame text-meta uppercase tracking-[0.1em] text-muted-foreground">
                  <th className="p-2 text-left font-medium">Position</th>
                  {/*
                    Hier stand **„Art"** mit „Betrieb" / „ART-Rahmen" darin. Die
                    Kopfzeile setzt Versalien, gelesen wurde also „ART" — und
                    genau so heisst auf der Nachbarfläche die Spalte, die den
                    Agile Release Train nennt. Die Art sagt jetzt der Block, die
                    Spalte nennt die **Zurechnung**.
                  */}
                  <th className="p-2 text-left font-medium">Zurechnung</th>
                  <th className="p-2 text-left font-medium">Periode</th>
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
                {/*
                  **Dieselbe Ordnung wie in „Einrichten"** (REQ-15): zwei Blöcke,
                  darin die drei Zurechnungsebenen. Vorher standen hier 13 Zeilen
                  flach — zweimal „ART-Rollen" mit je 7.500 €, ohne dass man sah,
                  welchem ART sie gelten.
                */}
                {RTB_KINDS.map((k) => {
                  const desBlocks = view.rows.filter((r) => rtbKindOrDefault(r.kind) === k);
                  if (desBlocks.length === 0) return null;
                  return (
                    <Fragment key={k}>
                      <tr className="border-b bg-surface-frame/60">
                        <td colSpan={3} className="px-2 pb-1.5 pt-3">
                          <span className="text-sm font-semibold uppercase tracking-[0.08em]">
                            {RTB_KIND_LABELS[k]}
                          </span>
                        </td>
                        <td className="px-2 pb-1.5 pt-3 text-right text-meta text-muted-foreground tabular-nums">
                          {formatEUR(summe(desBlocks, "ask"))}
                        </td>
                        <td className="px-2 pb-1.5 pt-3 text-right text-meta text-muted-foreground tabular-nums">
                          {formatEUR(summe(desBlocks, "amount"))}
                        </td>
                      </tr>
                      {RTB_ASSIGNMENT_GROUPS.map((g) => {
                        const drin = desBlocks.filter((r) => rtbAssignmentGroup(r) === g);
                        if (drin.length === 0) return null;
                        return (
                          <Fragment key={g}>
                            <tr className="border-b">
                              <td colSpan={3} className="px-2 py-1.5 pl-4">
                                <span className="text-sm font-medium">
                                  {RTB_ASSIGNMENT_GROUP_LABELS[g]}
                                </span>
                              </td>
                              <td className="px-2 py-1.5 text-right text-meta text-muted-foreground tabular-nums">
                                {formatEUR(summe(drin, "ask"))}
                              </td>
                              <td className="px-2 py-1.5 text-right text-meta text-muted-foreground tabular-nums">
                                {formatEUR(summe(drin, "amount"))}
                              </td>
                            </tr>
                            {drin.map((r) => (
                              <tr key={r.rtbItemId} className="border-b last:border-0">
                                <td className="p-2 pl-6">{r.name}</td>
                                <td className="p-2 text-muted-foreground">
                                  {zurechnung(r)}
                                  {/*
                                    Steht die Zeile unter einer Solution, zählt
                                    ihr Geld aber bei einem anderen ART, ist die
                                    Überschrift nicht die ganze Wahrheit —
                                    derselbe Hinweis wie in „Einrichten".
                                  */}
                                  {r.artId != null &&
                                    r.solutionId != null &&
                                    r.artId !== r.solutionArtId && (
                                      <span className="ml-1.5 text-warning">
                                        · zählt bei {r.artName ?? "—"}
                                      </span>
                                    )}
                                </td>
                                <td className="p-2 text-muted-foreground">
                                  {RTB_INTERVAL_LABELS[rtbIntervalOrDefault(r.interval)]}
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
                          </Fragment>
                        );
                      })}
                    </Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t bg-surface-frame font-semibold">
                  <td className="p-2" colSpan={3}>
                    Σ
                  </td>
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
