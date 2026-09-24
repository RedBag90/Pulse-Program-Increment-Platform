"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";

import { formatEUR } from "@/lib/formatting";
import { saveArtEpicAllocationsAction } from "@/modules/budgeting/features/actions/art-pot";
import type { ArtPotView } from "@/modules/budgeting/domain/art-budget-model";
import { ownWorkExceedsFrame, type OwnWorkGuide } from "@/modules/budgeting/domain/art-own-work";
import { SectionCard } from "@/components/ui/section-card";

/**
 * Der ART-Rahmen eines ARTs und seine Verteilung auf ART-Epics.
 *
 * Nichts ist vorbelegt, und sortiert wird nach Richtwert, nicht nach Eingabe —
 * dieselben zwei Regeln wie im Verteilbogen der Gruppen: jede Zuteilung ist eine
 * Entscheidung, und beim Tippen springt keine Zeile.
 *
 * Verteilt wird vom **RTE dieses ARTs**, der Finance-Partei, dem
 * Wertstrom-Owner, dem Portfolio-Management — oder, zeilenweise, vom
 * Produkt-Manager der Solution eines Epics.
 *
 * **Ein Knopf für die ganze Tabelle.** Vorher war jede Zeile ein eigenes
 * Formular mit ✓-Knopf: ein Roundtrip je Betrag, kein Zustand „ungespeichert",
 * kein Zurück — und wer zwei Beträge tauschen wollte, musste die Reihenfolge
 * kennen, in der der Deckel es zuließ. Das Aufteilen des Zuspruchs einen
 * Schritt vorher macht es längst so.
 */
export function ArtPotSection({
  view,
  artId,
  canDistribute,
  guide,
}: {
  view: ArtPotView;
  artId: string;
  canDistribute: boolean;
  /**
   * Der Richtwert für ART-eigene Arbeit samt seiner Herleitung. Er kommt aus
   * der Deckungsrechnung und wird deshalb hereingereicht, statt in `ArtPotView`
   * ein zweites Mal gerechnet zu werden.
   */
  guide: OwnWorkGuide;
}) {
  const t = useTranslations();
  const { pot, rows, ownWork } = view;
  const [state, formAction, pending] = useActionState(saveArtEpicAllocationsAction, {});
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(rows.map((r) => [r.epicId, String(r.amount)])),
  );
  /**
   * **Der Richtwert steht nicht im Feld.** Gemessen ergibt Plant Efficiency
   * 169.559 € gegen 58.750 € offenen Rahmen — als Vorbelegung wäre er
   * unbrauchbar. Das Feld startet mit dem, was reserviert ist.
   */
  const [ownWorkDraft, setOwnWorkDraft] = useState(String(ownWork.amount));

  const ownWorkAmount = Number(ownWorkDraft) || 0;
  const sum = rows.reduce((s, r) => s + (Number(draft[r.epicId]) || 0), 0) + ownWorkAmount;
  const over = sum > pot.total;
  const askSum = rows.reduce((s, r) => s + r.ask, 0) + (guide.ask ?? 0);
  const ownWorkEditable = canDistribute && ownWork.canDistribute && pot.closedReason == null;

  /**
   * **Die Schiene bleibt, der Knopf geht** (REQ-12). Ohne Rahmen gibt es nichts
   * zu verteilen — aber die Karte bleibt erkennbar der Ort, an dem es zu tun
   * wäre, und sagt, was dafür fehlt. Eine Fläche, die in diesem Fall
   * verschwände, liesse den RTE ohne Auskunft zurück.
   */
  if (pot.total === 0 && rows.length === 0) {
    return (
      <SectionCard title={`Rahmen verteilen · ${pot.cycleKey}`} step={4}>
        <p className="text-sm text-muted-foreground">{t("budgeting.art.fuerDiesesHalbjahrIst")}</p>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title={`Rahmen verteilen · ${pot.cycleKey}`}
      step={4}
      description={t("budgeting.art.ausDemArtRahmen")}
      contentClassName="space-y-3"
    >
      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: "ART-Rahmen", value: pot.total, tone: "" },
          { label: "Aus dem Rahmen vergeben", value: sum, tone: "var(--primary)" },
          {
            label: "Rahmen offen",
            value: pot.total - sum,
            tone: over ? "var(--destructive)" : "",
          },
        ].map((t) => (
          <div key={t.label} className="rounded-lg bg-card shadow-card p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
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
          {t("budgeting.art.keinVorgemerktesArtEpic")}
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-surface-frame text-label uppercase tracking-[0.1em] text-muted-foreground">
                <th className="p-2 text-left font-semibold">{t("budgeting.art.epic")}</th>
                <th className="p-2 text-left font-semibold">{t("budgeting.art.reifegrad")}</th>
                <th className="p-2 text-right font-semibold">{t("budgeting.art.richtwert")}</th>
                <th className="p-2 text-right font-semibold">{t("budgeting.art.zuteilung")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.epicId} className="border-b last:border-b-0">
                  <td className="p-2">
                    {r.title}
                    {r.askDrifted && (
                      <span className="ml-2 text-xs text-warning">
                        {t("budgeting.art.businessCaseWeichtVom")}
                      </span>
                    )}
                  </td>
                  <td className="p-2">
                    <span className="rounded-sm bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                      {r.stageGate}
                    </span>
                  </td>
                  <td className="p-2 text-right tabular-nums">{formatEUR(r.ask)}</td>
                  <td className="p-2 text-right">
                    {canDistribute && r.canDistribute && pot.closedReason == null ? (
                      <input
                        value={draft[r.epicId] ?? "0"}
                        onChange={(ev) => setDraft((p) => ({ ...p, [r.epicId]: ev.target.value }))}
                        inputMode="numeric"
                        aria-label={`Zuteilung für ${r.title}`}
                        className="w-28 rounded-md border bg-background px-2 py-1 text-right tabular-nums"
                      />
                    ) : (
                      <span className="tabular-nums">{formatEUR(r.amount)}</span>
                    )}
                  </td>
                </tr>
              ))}
              <OwnWorkRow
                guide={guide}
                value={ownWorkDraft}
                editable={ownWorkEditable}
                amount={ownWork.amount}
                onChange={setOwnWorkDraft}
              />
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

      {canDistribute && pot.closedReason == null && rows.some((r) => r.canDistribute) && (
        <form
          action={formAction}
          className="flex flex-wrap items-center gap-3 rounded-lg border bg-surface-frame px-3 py-2"
        >
          <input type="hidden" name="artId" value={artId} />
          <input type="hidden" name="cycleKey" value={pot.cycleKey} />
          <input
            type="hidden"
            name="amounts"
            value={JSON.stringify(
              rows
                .filter((r) => r.canDistribute)
                .map((r) => ({
                  epicId: r.epicId,
                  amount: Number(draft[r.epicId]) || 0,
                  ask: r.ask,
                })),
            )}
          />
          {/*
            Der Richtwert friert beim ersten Reservieren ein — danach gilt der
            gespeicherte, sonst wanderte er mit jedem neuen €-Satz.
          */}
          {ownWorkEditable && (
            <input
              type="hidden"
              name="ownWork"
              value={JSON.stringify({
                amount: ownWorkAmount,
                ask: ownWork.amount > 0 ? ownWork.ask : (guide.ask ?? 0),
              })}
            />
          )}
          <span className="text-sm text-muted-foreground">
            {t("budgeting.art.summe")}{" "}
            <span className="font-medium tabular-nums text-foreground">{formatEUR(sum)}</span> von{" "}
            {formatEUR(pot.total)}
          </span>
          <button
            type="submit"
            disabled={pending || over}
            className="ml-auto rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {pending ? "…" : "Zuteilung speichern"}
          </button>
        </form>
      )}

      {over && (
        <p role="alert" className="text-sm text-destructive">
          Die Summe überschreitet den ART-Rahmen um {formatEUR(sum - pot.total)}.
        </p>
      )}
      {/*
        **Eine Auskunft, keine Sperre.** Dass die eingeplante eigenständige
        Arbeit teurer wäre als der Rest des Rahmens, hindert niemanden am
        Reservieren — es ist genau die Auskunft, die vorher fehlte. Der Grund
        steht dabei, weil der Satz bei dünner Historie stark schwankt.
      */}
      {ownWorkExceedsFrame(guide, pot.remaining) && (
        <p className="text-sm text-warning">
          Der Richtwert für ART-eigene Arbeit ({formatEUR(guide.ask ?? 0)}) übersteigt, was vom
          Rahmen offen ist ({formatEUR(pot.remaining)}).
          {view.pot.total > 0 &&
            " Entweder wird weniger eigenständig gearbeitet, oder der Rahmen des nächsten Halbjahres muss das tragen."}
        </p>
      )}
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      {pot.closedReason && (
        <p className="rounded-lg border px-3 py-2 text-sm text-muted-foreground">
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
        {t("budgeting.art.dieZuteilungErfuelltDas")} <em>{t("budgeting.art.vor")}</em>{" "}
        {t("budgeting.art.demAntragBeantragtUnd")}
      </p>
      {canDistribute && rows.some((r) => !r.canDistribute) && (
        <p className="text-sm text-muted-foreground">{t("budgeting.art.bedienbarSindNurDie")}</p>
      )}
    </SectionCard>
  );
}

/**
 * **Die Zeile für ART-eigene Arbeit** — dieselbe Mechanik wie eine Epic-Zeile,
 * ein anderer Gegenstand.
 *
 * Sie steht auch dann da, wenn kein eigenständiges Feature eingeplant ist: ein
 * RTE darf reservieren, bevor das erste angelegt wird. Was sie **nie** tut, ist
 * den Richtwert ins Feld schreiben — er ist eine Schätzung aus einem Satz mit
 * Vorbehalten, keine Vorgabe.
 */
function OwnWorkRow({
  guide,
  value,
  editable,
  amount,
  onChange,
}: {
  guide: OwnWorkGuide;
  value: string;
  editable: boolean;
  amount: number;
  onChange: (v: string) => void;
}) {
  const t = useTranslations();
  const herleitung =
    guide.featureCount === 0
      ? "Kein eigenständiges Feature in diesem Halbjahr eingeplant."
      : guide.rate == null
        ? `${guide.featureCount} ${guide.featureCount === 1 ? "Feature" : "Features"} · ${guide.jobSize} JS · kein €-Satz für dieses ART`
        : `${guide.featureCount} ${guide.featureCount === 1 ? "Feature" : "Features"} · ${guide.jobSize} JS × ${formatEUR(guide.rate)}`;

  return (
    <tr className="border-b bg-primary/5 last:border-b-0">
      <td className="p-2">
        <span className="font-medium">{t("budgeting.art.artEigeneArbeitOhne")}</span>
        <div className="mt-0.5 text-xs text-muted-foreground">{herleitung}</div>
      </td>
      <td className="p-2">
        <span className="rounded-sm bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">—</span>
      </td>
      <td className="p-2 text-right tabular-nums">
        {guide.ask == null ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <>
            {formatEUR(guide.ask)}
            <span className="ml-1.5 rounded-sm bg-muted px-1.5 py-0.5 text-meta text-muted-foreground">
              {t("budgeting.art.geschaetzt")}
            </span>
          </>
        )}
      </td>
      <td className="p-2 text-right">
        {editable ? (
          <input
            value={value}
            onChange={(ev) => onChange(ev.target.value)}
            inputMode="numeric"
            aria-label={t("budgeting.art.reservierungFuerArtEigene")}
            className="w-28 rounded-md border bg-background px-2 py-1 text-right tabular-nums"
          />
        ) : (
          <span className="tabular-nums">{formatEUR(amount)}</span>
        )}
      </td>
    </tr>
  );
}
