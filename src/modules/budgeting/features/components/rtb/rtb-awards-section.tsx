"use client";

import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import { Fragment, useActionState, useState } from "react";
import { saveRtbAwardsAction } from "@/modules/budgeting/features/actions/rtb";
import { Link } from "@/i18n/navigation";
import { formatEUR } from "@/lib/formatting";
import { SectionCard } from "@/components/ui/section-card";
import { RTB_KINDS, RTB_KIND_KEYS, rtbKindOrDefault } from "@/modules/budgeting/domain/rtb-kind";
import { RTB_INTERVAL_KEYS, rtbIntervalOrDefault } from "@/modules/budgeting/domain/rtb-interval";
import {
  rtbAssignmentGroup,
  RTB_ASSIGNMENT_GROUPS,
  RTB_ASSIGNMENT_GROUP_KEYS,
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
  const t = useTranslations();
  const locale = useLocale() as Locale;
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
          {t("budgeting.rtb.keineAktivePositionNichtsAufzuteilen")}{" "}
          <Link href={setupHref} className="text-primary hover:underline">
            {t("budgeting.rtb.positionenEinrichten")}
          </Link>
        </p>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title={`Zuspruch aufteilen · ${view.cycleKey}`}
      step={4}
      description={t("budgeting.rtb.dieRundeSprichtDem")}
      contentClassName="space-y-3"
    >
      {view.awarded == null ? (
        <p className="text-sm text-muted-foreground">{t("budgeting.rtb.fuerDiesesHalbjahrIst")}</p>
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
                  <th className="p-2 text-left font-medium">{t("budgeting.rtb.position")}</th>
                  {/*
                    Hier stand **„Art"** mit „Betrieb" / „ART-Rahmen" darin. Die
                    Kopfzeile setzt Versalien, gelesen wurde also „ART" — und
                    genau so heisst auf der Nachbarfläche die Spalte, die den
                    Agile Release Train nennt. Die Art sagt jetzt der Block, die
                    Spalte nennt die **Zurechnung**.
                  */}
                  <th className="p-2 text-left font-medium">{t("budgeting.rtb.zurechnung")}</th>
                  <th className="p-2 text-left font-medium">{t("budgeting.rtb.periode")}</th>
                  <th className="p-2 text-right font-medium">{t("budgeting.rtb.beantragt")}</th>
                  {/*
                    „Zugesprochen", nicht „Zugeteilt": das ist das Ergebnis der
                    Kachel. „Zugeteilt" heisst auf diesen Flächen die Summe, die
                    aus Epic-Zuteilungen an einem ART hängt — zwei Zahlen, die
                    sich nicht denselben Namen teilen dürfen (Spec §2.5).
                  */}
                  <th className="p-2 text-right font-medium">{t("budgeting.rtb.zugesprochen")}</th>
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
                            {t(RTB_KIND_KEYS[k])}
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
                                  {t(RTB_ASSIGNMENT_GROUP_KEYS[g])}
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
                                        {t("budgeting.rtb.zaehltBei", { art: r.artName ?? "—" })}
                                      </span>
                                    )}
                                </td>
                                <td className="p-2 text-muted-foreground">
                                  {t(RTB_INTERVAL_KEYS[rtbIntervalOrDefault(r.interval)])}
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
            {rest < 0
              ? t("budgeting.rtb.zugesprochenZuVielVerteilt", {
                  awarded: formatEUR(awarded, locale),
                  amount: formatEUR(-rest, locale),
                })
              : t("budgeting.rtb.zugesprochenNochNichtVerteilt", {
                  awarded: formatEUR(awarded, locale),
                  amount: formatEUR(rest, locale),
                })}
          </p>

          {!view.saved && view.closedReason == null && (
            <p className="text-xs text-muted-foreground">
              {t("budgeting.rtb.dieBetraegeSindAnteilig")}
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
              {pending ? t("budgeting.rtb.speichere") : t("budgeting.rtb.aufteilungSpeichern")}
            </button>
          )}
        </form>
      )}
    </SectionCard>
  );
}
