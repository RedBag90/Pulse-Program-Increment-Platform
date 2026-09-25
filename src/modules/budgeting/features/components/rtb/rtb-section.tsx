"use client";

import { useTranslations } from "next-intl";
import { useActionState, useEffect, useState } from "react";
import {
  createRtbItemAction,
  updateRtbItemAction,
  deleteRtbItemAction,
} from "@/modules/budgeting/features/actions/rtb";
import {
  sumRtbAnnual,
  sumRtbCycle,
  RTB_INTERVALS,
  RTB_INTERVAL_KEYS,
  rtbAnnualAmount,
  rtbIntervalOrDefault,
} from "@/modules/budgeting/domain/rtb-interval";
import {
  RTB_KINDS,
  RTB_KIND_KEYS,
  isChangeKind,
  splitRunAndChange,
} from "@/modules/budgeting/domain/rtb-kind";
import { Link } from "@/i18n/navigation";
import {
  RTB_TEMPLATE_GROUP_HINTS,
  templatesOfGroup,
  templateById,
} from "@/modules/budgeting/domain/rtb-templates";
import {
  rtbAssignmentGroup,
  zaehltBeiAnderemArt,
  RTB_ASSIGNMENT_GROUPS,
  RTB_ASSIGNMENT_GROUP_KEYS,
} from "@/modules/budgeting/domain/rtb-art-resolution";
import { ConfirmMutateForm } from "@/components/actions/confirm-mutate-form";
import { SectionCard } from "@/components/ui/section-card";
import { EmptyState } from "@/components/ui/empty-state";

const input =
  "rounded-md border border-input bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
const btn =
  "rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50";
const btnGhost = "rounded-md border px-2 py-1 text-xs text-muted-foreground hover:text-foreground";
const EUR = (n: number) => `${Math.round(n).toLocaleString("de-DE")} €`;

export interface RtbItem {
  id: string;
  name: string;
  plannedAmount: number;
  active: boolean;
  /** "monthly" | "half_yearly" | "yearly" — die Periode des Betrags. */
  interval: string;
  /** `null` = wertstrom-übergreifend. */
  solutionId: string | null;
  /** "run" (Betrieb) | "art_change" (ART-Rahmen). */
  kind?: string;
  /** Der ART, für den ein ART-Rahmen reserviert ist. */
  artId?: string | null;
}

export interface RtbSolutionOption {
  id: string;
  name: string;
  /**
   * Der ART dieser Solution — seit `solutions.art_id NOT NULL` immer gesetzt.
   * Ohne ihn zeigte die Fläche eine Solution, ohne zu sagen, wo ihr Geld landet.
   */
  artId?: string | null;
}

export interface RtbArtOption {
  id: string;
  name: string;
}

/**
 * Run-the-Business-Plan: die **eine** Pflege-Fläche für Betriebskosten und
 * ART-Rahmen. Gerendert im Wertstrom-Budget und im Solution-Detail.
 *
 * **Zwei Gruppen, zwei Summen.** Betrieb ist Run, ein ART-Rahmen ist Grow.
 * Vorher stand eine gemeinsame Summe über der Liste, beschriftet als
 * „Betriebskosten (Keep the lights on)" — bei den Testdaten waren darin 69 %
 * Grow. Die Trennung macht die Zahl ehrlich und erspart zugleich eine
 * Art-Spalte: die Gruppe sagt die Art, und der ART bekommt dafür eine eigene.
 *
 * **Die Zeilen ruhen.** Vorher war jede Zeile ein dauerhaft offenes Formular;
 * fünf Zeilen ergaben 35 gleichzeitig sichtbare Bedienelemente. Jetzt ist genau
 * eine Zeile offen, und das Entfernen wohnt darin — mit Rückfrage, statt als
 * roter Dauerlink in jeder Zeile.
 *
 * Auf der Solution-Fläche (`solutionId` gesetzt) entfällt die Solution-Spalte:
 * die Fläche setzt die Zurechnung schon, und neue Positionen erben sie. ARTs
 * gibt es dort nicht, also bleibt es bei einer Gruppe.
 *
 * Aktive Positionen kommen als Kandidaten auf die PB-Liste jeder gestarteten
 * Budgeting-Kachel — mit dem Betrag **einer** Kachel, nicht dem gepflegten.
 */
export function RtbSection({
  valueStreamId,
  items,
  canManage,
  solutions = [],
  solutionId = null,
  arts = [],
}: {
  valueStreamId: string;
  items: RtbItem[];
  canManage: boolean;
  /** Zuordenbare Solutions des Wertstroms; leer ⇒ kein Solution-Feld. */
  solutions?: RtbSolutionOption[];
  /** Gesetzt ⇒ Fläche einer einzelnen Solution: Spalte weg, Zurechnung fix. */
  solutionId?: string | null;
  /** ARTs dieses Wertstroms; leer ⇒ kein ART-Rahmen anlegbar. */
  arts?: RtbArtOption[];
}) {
  const t = useTranslations();
  // Genau eine Zeile ist offen — mehr braucht niemand gleichzeitig, und die
  // Liste bleibt lesbar.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const scoped = solutionId != null;
  const showSolution = !scoped && solutions.length > 0;
  const canUseArts = arts.length > 0 && !scoped;
  const solutionName = (id: string | null) =>
    id == null ? "— übergreifend" : (solutions.find((s) => s.id === id)?.name ?? "— übergreifend");
  const artName = (id: string | null | undefined) =>
    id == null ? "—" : (arts.find((a) => a.id === id)?.name ?? "—");

  /** `solutionId → artId`, für den ART hinter einer Solution. */
  const artOfSolution: Record<string, string | null> = Object.fromEntries(
    solutions.map((so) => [so.id, so.artId ?? null]),
  );

  /**
   * **Was in der Zurechnungsspalte steht** — das, was die Gruppenüberschrift
   * noch nicht gesagt hat.
   *
   * Die Spalte hiess einmal „Solution" und verschwieg zwei der drei Wege. Seit
   * die Tabelle nach Ebene gegliedert ist, nennt die Überschrift den Weg und
   * die Spalte den **Namen** — bei einer Solution beide Stationen, denn dort
   * entscheidet der ART der Solution, wo das Geld landet.
   */
  const zurechnung = (it: RtbItem) => {
    switch (rtbAssignmentGroup(it)) {
      case "art":
        return artName(it.artId);
      case "solution": {
        const via = it.solutionId == null ? null : (artOfSolution[it.solutionId] ?? null);
        return `${solutionName(it.solutionId)} · ${artName(via)}`;
      }
      default:
        return "—";
    }
  };

  const { run, change } = splitRunAndChange(items);

  /**
   * **Schritt 1 der Finanzierungskette** — aber nur auf der Wertstrom-Fläche.
   * Auf der Solution-Fläche steht dieselbe Tabelle ausserhalb der Kette; eine
   * Schrittnummer behauptete dort einen Prozess, in dem sie nicht steht.
   *
   * Als Streuung, weil `exactOptionalPropertyTypes` ein `step={undefined}`
   * nicht erlaubt.
   */
  const schritt = scoped ? {} : { step: 1 };

  const groupProps = {
    canManage,
    editingId,
    onEdit: setEditingId,
    solutions,
    showSolution,
    solutionName,
    artName,
    zurechnung,
    artOfSolution,
    scoped,
    arts,
    canUseArts,
  };

  return (
    /*
      **Betrieb und ART-Rahmen sind Unterabschnitte einer Karte**, nicht zwei
      namenlose Blöcke. Sie gehören zusammen — dieselbe Tabelle, derselbe Weg
      über die PB-Liste — und stehen nur getrennt, weil das eine Run und das
      andere Grow ist. Vorher trennte sie nichts als Leerraum.
    */
    <SectionCard
      title={scoped ? "Betriebskosten" : "Betriebspositionen"}
      work={!scoped}
      {...schritt}
      description={
        <>
          {scoped
            ? "Betriebskosten, die dieser Solution zugerechnet sind."
            : "Was dieser Wertstrom laufend braucht: der Betrieb (Keep the lights on) und die ART-Rahmen seiner ARTs. Beide gehen denselben Weg über die PB-Liste — das eine ist Run, das andere Grow, deshalb stehen sie getrennt."}{" "}
          Aktive Positionen kommen als Kandidaten auf die PB-Liste jeder gestarteten
          Budgeting-Kachel.
        </>
      }
      action={
        canManage && !adding ? (
          <button type="button" onClick={() => setAdding(true)} className={btn}>
            {t("budgeting.rtb.position")}
          </button>
        ) : undefined
      }
      contentClassName="space-y-4"
    >
      {items.length === 0 && (
        <EmptyState
          title={t("budgeting.rtb.nochKeinePositionen")}
          body={t("budgeting.rtb.wasDieserWertstromLaufend")}
        />
      )}

      {run.items.length > 0 && (
        <RtbGroupTable title={t("budgeting.rtb.betrieb")} group={run} {...groupProps} />
      )}
      {change.items.length > 0 && (
        <RtbGroupTable title={`${RTB_KIND_KEYS.art_change}s`} group={change} {...groupProps} />
      )}

      {/*
        **Jede Arbeitsfläche nennt ihren Nachfolger** (REQ-10). Die Leiste sagt,
        wo der Prozess steht; dieser Satz übergibt konkret.
      */}
      {/*
        **Die Lese-Fassung darf keine Sackgasse sein.** Auf der Solution-Fläche
        wird seit 2026-09-19 nicht mehr gepflegt; der Weg dorthin muss dann
        sichtbar sein.
      */}
      {scoped && (
        <p className="text-xs text-muted-foreground">
          Gepflegt werden diese Positionen im Budget-Bereich des Wertstroms.{" "}
          <Link
            href={`/budgeting/value-streams/${valueStreamId}?tab=einrichten`}
            className="text-primary hover:underline"
          >
            {t("budgeting.rtb.zuDenBetriebspositionen")}
          </Link>
        </p>
      )}

      {!scoped && items.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Aktive Positionen kommen als Kandidaten auf die PB-Liste der nächsten Kachel — dort
          entscheidet sich, wie viel dieser Wertstrom bekommt.{" "}
          <Link href="/budgeting/periods" className="text-primary hover:underline">
            {t("budgeting.rtb.zuDenKacheln")}
          </Link>
        </p>
      )}

      {canManage && adding && (
        <AddForm
          valueStreamId={valueStreamId}
          solutionId={solutionId}
          solutions={solutions}
          showSolution={showSolution}
          arts={arts}
          canUseArts={canUseArts}
          onClose={() => setAdding(false)}
        />
      )}
    </SectionCard>
  );
}

interface GroupProps {
  canManage: boolean;
  editingId: string | null;
  onEdit: (id: string | null) => void;
  solutions: RtbSolutionOption[];
  showSolution: boolean;
  solutionName: (id: string | null) => string;
  artName: (id: string | null | undefined) => string;
  /** Der Weg zum ART, als Text — siehe `zurechnung` oben. */
  zurechnung: (it: RtbItem) => string;
  /** `solutionId → artId`, für die Abweichungsprüfung in der Solution-Gruppe. */
  artOfSolution: Record<string, string | null>;
  /** Fläche einer einzelnen Solution: dort ist die Zurechnung fix und entfällt. */
  scoped: boolean;
  arts: RtbArtOption[];
  canUseArts: boolean;
}

/** Eine Gruppe als ruhende Tabelle, mit eigener Summe im Kopf. */
function RtbGroupTable({
  title,
  group,
  ...p
}: GroupProps & {
  title: string;
  group: { items: RtbItem[]; annual: number; cycle: number };
}) {
  const t = useTranslations();
  /*
    **Die Spalte nennt den Namen, die Gruppe den Weg.** Sie hiess einmal
    „Solution" und verschwieg damit zwei der drei Wege; dann „Zurechnung" und
    trug den Weg im Text jeder Zeile. Seit die Tabelle gegliedert ist, steht der
    Weg einmal in der Überschrift — und in der Solution-Gruppe die Solution
    **samt** ihrem ART, denn der entscheidet, wo das Geld landet.

    Auf der Solution-Fläche ist ohnehin alles „Solution-individuell": dort
    entfällt die Gliederung, und die eine sinnvolle Spalte ist der ART.
  */
  const secondCol = p.scoped ? "ART" : "Zurechnung";

  const spalten = p.canManage ? 6 : 5;

  return (
    <div className="space-y-2 first:pt-0 [&+&]:border-t [&+&]:pt-5">
      <div className="flex flex-wrap items-baseline gap-2">
        {/*
          **Die Obergruppe führt.** Sie stand auf `text-meta` (11 px) und
          gedämpft — kleiner als die Untergruppen darunter und kleiner als ihre
          eigene Summe daneben. Grösser als `text-sm` darf eine Überschrift
          nicht werden (der Wächter `section-structure` hält das fest), also
          kommt die Prominenz aus Versalien, Gewicht und voller Textfarbe.
        */}
        <h3 className="text-sm font-semibold uppercase tracking-[0.08em]">{title}</h3>
        <span className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{EUR(group.annual)}</span> p. a.
          <span className="mx-1.5">·</span>
          <span className="font-medium text-foreground">{EUR(group.cycle)}</span>{" "}
          {t("budgeting.rtb.jeKachel")}
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full table-fixed text-sm">
          {/*
            **Feste Spalten, damit Betrieb und ART-Rahmen fluchten.** Beide
            Tabellen stehen untereinander und wirken als eine Fläche; mit
            `table-auto` leitete jede ihre Breiten aus ihrem eigenen Inhalt ab,
            und die Köpfe standen versetzt. Die erste Spalte nimmt den Rest.
          */}
          <colgroup>
            <col />
            <col className="w-[22rem]" />
            <col className="w-32" />
            <col className="w-32" />
            <col className="w-32" />
            {p.canManage && <col className="w-28" />}
          </colgroup>
          <thead>
            <tr className="border-b bg-surface-frame text-left text-meta uppercase tracking-[0.1em] text-muted-foreground">
              <th className="px-3 py-2">{t("budgeting.rtb.position2")}</th>
              {secondCol && <th className="px-3 py-2">{secondCol}</th>}
              <th className="px-3 py-2">{t("budgeting.rtb.periode")}</th>
              <th className="px-3 py-2 text-right">{t("budgeting.rtb.betrag")}</th>
              <th className="px-3 py-2 text-right">p. a.</th>
              {p.canManage && <th className="px-3 py-2" />}
            </tr>
          </thead>
          <tbody>
            {RTB_ASSIGNMENT_GROUPS.map((key) => {
              const drin = p.scoped
                ? key === "solution"
                  ? group.items
                  : []
                : group.items.filter((it) => rtbAssignmentGroup(it) === key);
              if (drin.length === 0) return null;
              return (
                <RtbAssignmentGroupRows
                  key={key}
                  label={p.scoped ? null : t(RTB_ASSIGNMENT_GROUP_KEYS[key])}
                  items={drin}
                  spalten={spalten}
                  {...p}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Eine Ebene innerhalb einer Tabelle — Überschrift mit Zwischensumme, dann ihre
 * Zeilen.
 *
 * **Gruppenzeilen statt sechs getrennter Tabellen:** die Spalten bleiben über
 * alle Ebenen ausgerichtet, und die beiden Obergruppen behalten je eine Summe
 * im Kopf. Dasselbe Muster trägt der Business Case.
 */
function RtbAssignmentGroupRows({
  label,
  items,
  spalten,
  ...p
}: GroupProps & {
  label: string | null;
  items: RtbItem[];
  spalten: number;
}) {
  const t = useTranslations();
  return (
    <>
      {label != null && (
        <tr className="border-b bg-surface-frame/60">
          {/*
            **Drei Ebenen, eine Grösse, drei Gewichte.** Die Obergruppe ist
            versal und `font-semibold`, diese Untergruppe `font-medium`, die
            Zeilen normal. Hier stand das Label einmal auf `text-label` (10 px,
            laut ADR-0021 für **Versal**-Mikrolabel) mit einer Summe auf
            `text-xs` daneben — der Nebensatz war grösser als das, was er
            erläutert.
          */}
          <td colSpan={spalten} className="px-3 pb-1.5 pt-3">
            <span className="text-sm font-medium">{label}</span>
            <span className="ml-2 text-meta text-muted-foreground">
              {EUR(sumRtbAnnual(items))} p. a. · {EUR(sumRtbCycle(items))} je Kachel
            </span>
          </td>
        </tr>
      )}
      {items.map((it) =>
        p.editingId === it.id ? (
          <tr key={it.id} className="border-b last:border-b-0 bg-primary/5">
            <td colSpan={spalten} className="p-3">
              <RowEditor item={it} onClose={() => p.onEdit(null)} {...p} />
            </td>
          </tr>
        ) : (
          <tr key={it.id} className={`border-b last:border-b-0 ${it.active ? "" : "opacity-55"}`}>
            <td className={`px-3 py-2 ${it.active ? "" : "line-through"}`}>{it.name}</td>
            <td className="px-3 py-2 text-muted-foreground">
              {p.scoped
                ? // Auf der Solution-Fläche zählt, **wo das Geld landet**: der
                  // direkt gesetzte ART, sonst der ART der Solution.
                  p.artName(
                    it.artId ?? (it.solutionId != null ? p.artOfSolution[it.solutionId] : null),
                  )
                : p.zurechnung(it)}
              {/*
                      Steht die Zeile unter einer Solution, zählt ihr Geld aber
                      bei einem anderen ART, ist die Überschrift nicht die ganze
                      Wahrheit. Im Bestand kommt das nicht vor — der Fall ist
                      aber möglich, und stumm wäre er eine falsche Auskunft.
                    */}
              {(() => {
                const anderer = zaehltBeiAnderemArt(it, p.artOfSolution);
                return anderer == null ? null : (
                  <span className="ml-1.5 text-warning">· zählt bei {p.artName(anderer)}</span>
                );
              })()}
            </td>
            <td className="px-3 py-2 text-muted-foreground">
              {t(RTB_INTERVAL_KEYS[rtbIntervalOrDefault(it.interval)])}
            </td>
            <td className="px-3 py-2 text-right tabular-nums">{EUR(it.plannedAmount)}</td>
            <td className="px-3 py-2 text-right tabular-nums">
              {it.active ? (
                EUR(rtbAnnualAmount(it.plannedAmount, it.interval))
              ) : (
                <span className="text-muted-foreground">{t("budgeting.rtb.inaktiv")}</span>
              )}
            </td>
            {p.canManage && (
              <td className="px-3 py-2 text-right">
                <button type="button" onClick={() => p.onEdit(it.id)} className={btnGhost}>
                  {t("budgeting.rtb.bearbeiten")}
                </button>
              </td>
            )}
          </tr>
        ),
      )}
    </>
  );
}

/**
 * Die geöffnete Zeile. Trägt zum ersten Mal auch **Art** und **ART** — die
 * Server-Action nimmt beide entgegen, das alte Zeilen-Formular schickte sie nie
 * mit, sodass eine einmal angelegte Zuordnung unveränderlich war.
 *
 * Exportiert **nur für den Test**: was hier zu prüfen ist — dass ein
 * erfolgreiches Speichern die Zeile zuklappt — braucht keine Tabelle drumherum.
 */
export function RowEditor({
  item,
  onClose,
  solutions,
  showSolution,
  arts,
  canUseArts,
}: GroupProps & { item: RtbItem; onClose: () => void }) {
  const t = useTranslations();
  const [state, action, pending] = useActionState(updateRtbItemAction, {});
  const [kind, setKind] = useState<string>(item.kind ?? "run");

  /**
   * **Nach dem Speichern klappt die Zeile zu** — und erst dadurch sieht man,
   * was man getan hat.
   *
   * Jedes Merkmal für „inaktiv" wohnt in der **eingeklappten** Zeile: gedämpft,
   * der Name durchgestrichen, „inaktiv" statt der Jahreszahl. Beim Bearbeiten
   * wird genau diese Zeile durch dieses Formular ersetzt. Wer hier
   * deaktivierte und dann speicherte, sah deshalb nichts — bis zum Neuladen,
   * und hielt das Speichern für gescheitert. Geschrieben war es längst.
   *
   * Nebenbei löst das ein zweites Problem: die Eingaben unten sind
   * `defaultValue` und beim ersten Rendern eingefroren. Ein offener Editor
   * hätte den frischen Serverstand ohnehin nicht gezeigt.
   */
  useEffect(() => {
    if (state.success) onClose();
  }, [state, onClose]);

  return (
    <div className="space-y-2">
      <form action={action} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="id" value={item.id} />

        {canUseArts && (
          <>
            <label className="text-xs">
              {t("budgeting.rtb.kostenart")}
              <select
                name="kind"
                value={kind}
                onChange={(e) => setKind(e.target.value)}
                className={`block ${input} w-44`}
              >
                {RTB_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {t(RTB_KIND_KEYS[k])}
                  </option>
                ))}
              </select>
            </label>
            {/*
              **Das Feld steht bei jeder Art** (2026-09-19). Es hing hinter
              `isChangeKind`, und damit war Weg 1 der Auflösung — „steht ein ART
              an der Position, gilt er" — für Betriebspositionen nicht
              erreichbar: alle 25 im Bestand tragen `artId = null`, nicht aus
              Wahl, sondern weil das Formular keinen anbot.
            */}
            <label className="text-xs">
              {t("budgeting.ui.art")}
              <select
                name="artId"
                required={isChangeKind(kind)}
                defaultValue={item.artId ?? ""}
                className={`block ${input} w-40`}
              >
                <option value="">{isChangeKind(kind) ? "— bitte wählen" : "— kein ART"}</option>
                {arts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        {/*
          Dieselbe Ordnung wie im Anlege-Formular — und **eigenständig
          bedingt**: `showSolution` und `canUseArts` haengen beide an `scoped`,
          koennen aber auseinanderlaufen (ein Wertstrom mit Solutions, aber
          ohne ART). Im selben `canUseArts`-Block waere das Feld dort
          verschwunden.
        */}
        {showSolution && (
          <label className="text-xs">
            {t("budgeting.rtb.solution")}
            <select
              name="solutionId"
              defaultValue={item.solutionId ?? ""}
              className={`block ${input} w-40`}
            >
              <option value="">{t("budgeting.rtb.uebergreifend")}</option>
              {solutions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="text-xs">
          {t("budgeting.rtb.position2")}
          <input name="name" defaultValue={item.name} className={`block ${input} w-52`} />
        </label>
        <label className="text-xs">
          {t("budgeting.rtb.betrag2")}
          <input
            name="plannedAmount"
            type="number"
            min={0}
            step={1000}
            defaultValue={item.plannedAmount}
            className={`block ${input} w-32 text-right tabular-nums`}
          />
        </label>
        <label className="text-xs">
          {t("budgeting.rtb.periode")}
          <select
            name="interval"
            defaultValue={rtbIntervalOrDefault(item.interval)}
            className={`block ${input} w-32`}
          >
            {RTB_INTERVALS.map((i) => (
              <option key={i} value={i}>
                {t(RTB_INTERVAL_KEYS[i])}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={pending} className={btn}>
          {pending ? "…" : "Speichern"}
        </button>
        <button type="button" onClick={onClose} className={btnGhost}>
          {t("budgeting.rtb.abbrechen")}
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        {/* Zustand und Löschen sind seltene Eingriffe — sie wohnen hier, nicht
            als Dauerlinks in jeder Zeile der Liste. */}
        <ConfirmMutateForm
          action={updateRtbItemAction}
          fields={{ id: item.id, active: item.active ? "false" : "true" }}
          label={item.active ? "Deaktivieren" : "Aktivieren"}
          pendingLabel="…"
          size="sm"
        />
        {/*
          **Der Zustand bekommt eigene Worte.** Der Knopf daneben trägt seine
          Handlung, nicht seinen Zustand (`Deaktivieren` heisst „ist aktiv") —
          das ist die Hausregel und bleibt so. Nur war er bisher das
          **einzige** Zeichen dafür, woran man ist, und ein Knopftext ist ein
          schlechter Ort, um einen Zustand abzulesen.
        */}
        {!item.active && (
          <span className="text-xs text-muted-foreground">
            {t("budgeting.rtb.positionDeaktiviert")}
          </span>
        )}
        <ConfirmMutateForm
          action={deleteRtbItemAction}
          fields={{ id: item.id }}
          label={t("budgeting.rtb.entfernen")}
          pendingLabel="…"
          confirmPrompt={`„${item.name}" wirklich entfernen? Zugeteilte Beträge dieser Position gehen verloren.`}
          destructive
          size="sm"
          className="ml-auto"
          onSuccess={onClose}
        />
      </div>

      {/* Beide Knöpfe oben sind eigene Formulare mit eigener Aktion — wer das
          nicht weiss, drückt danach „Speichern", um sie zu bestätigen. */}
      <p className="text-xs text-muted-foreground">{t("budgeting.rtb.zustandWirktSofort")}</p>

      {state.error && <p className="text-xs text-destructive">{state.error}</p>}
    </div>
  );
}

/**
 * Das Anlegen — eingeklappt ein Knopf.
 *
 * Die Felder stehen in der Reihenfolge Art → ART → Position → …, damit das
 * bedingte ART-Feld **unter** dem Feld erscheint, das es auslöst, statt mitten
 * in einer Zeile aufzuploppen.
 */
function AddForm({
  valueStreamId,
  solutionId,
  solutions,
  showSolution,
  arts,
  canUseArts,
  onClose,
}: {
  valueStreamId: string;
  solutionId: string | null;
  solutions: RtbSolutionOption[];
  showSolution: boolean;
  arts: RtbArtOption[];
  canUseArts: boolean;
  onClose: () => void;
}) {
  const t = useTranslations();
  const [state, action, pending] = useActionState(createRtbItemAction, {});
  const [kind, setKind] = useState<string>("run");
  /**
   * **Vorlage, nicht Vorgabe.** Die Auswahl setzt Name, Art und Periode vor —
   * den **Betrag nie**, den weiß nur der Wertstrom. „— eigene Position" ist der
   * Ausgangszustand und verhält sich wie vor den Vorlagen.
   */
  const [templateId, setTemplateId] = useState("");
  const [name, setName] = useState("");
  const [interval, setInterval] = useState<string>("yearly");
  const template = templateById(templateId);

  const waehle = (id: string) => {
    setTemplateId(id);
    const t = templateById(id);
    if (t == null) return;
    setName(t.label);
    setKind(t.kind);
    setInterval(t.interval);
  };

  return (
    <form action={action} className="space-y-3 rounded-lg border bg-surface-frame p-3">
      <input type="hidden" name="valueStreamId" value={valueStreamId} />
      {solutionId != null && <input type="hidden" name="solutionId" value={solutionId} />}

      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs">
          {t("budgeting.rtb.vorlage")}
          <select
            value={templateId}
            onChange={(e) => waehle(e.target.value)}
            className={`block ${input} w-72`}
          >
            <option value="">{t("budgeting.rtb.eigenePosition")}</option>
            {RTB_ASSIGNMENT_GROUPS.map((g) => (
              <optgroup key={g} label={t(RTB_ASSIGNMENT_GROUP_KEYS[g])}>
                {templatesOfGroup(g).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        {template != null && (
          <p className="max-w-md text-xs text-muted-foreground">
            {RTB_TEMPLATE_GROUP_HINTS[template.group]}
          </p>
        )}
      </div>

      {/*
        Der Vorbehalt steht **neben der Auswahl**, nicht in einem Tooltip: er
        ändert, wie die Zahl später gelesen wird.
      */}
      {template?.caveat != null && <p className="text-xs text-warning">{template.caveat}</p>}

      {(canUseArts || showSolution) && (
        <div className="flex flex-wrap items-end gap-2">
          {canUseArts && (
            <>
              <label className="text-xs">
                {t("budgeting.rtb.kostenart")}
                <select
                  name="kind"
                  value={kind}
                  onChange={(e) => setKind(e.target.value)}
                  className={`block ${input} w-44`}
                >
                  {RTB_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {t(RTB_KIND_KEYS[k])}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs">
                {t("budgeting.ui.art")}
                <select
                  name="artId"
                  required={isChangeKind(kind)}
                  defaultValue=""
                  className={`block ${input} w-40`}
                >
                  <option value="">{isChangeKind(kind) ? "— bitte wählen" : "— kein ART"}</option>
                  {arts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
          {/*
            **Die Solution steht neben dem ART, nicht am Zeilenende.** Beide
            beantworten dieselbe Frage — wohin zählt diese Position —, und der
            Erklärsatz darunter nennt sie in einem Atemzug. Vorher stand er
            *über* einem Feld, das erst zwei Zeilen tiefer am rechten Rand
            auftauchte.

            Eigenständig bedingt: `showSolution` und `canUseArts` koennen
            auseinanderlaufen.
          */}
          {showSolution && (
            <label className="text-xs">
              {t("budgeting.rtb.solution")}
              <select name="solutionId" defaultValue="" className={`block ${input} w-40`}>
                <option value="">{t("budgeting.rtb.uebergreifend")}</option>
                {solutions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}

      {/*
        Was der ART bewirkt — der Unterschied, für den es das Feld gibt. Ohne
        ihn verteilt sich eine Betriebsposition gleichmässig auf alle ARTs des
        Stroms; mit ihm zählt sie bei genau einem.
      */}
      {canUseArts && !isChangeKind(kind) && (
        <p className="text-xs text-muted-foreground">{t("budgeting.rtb.mitArtZaehltDie")}</p>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs">
          {t("budgeting.rtb.position2")}
          <input
            name="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("budgeting.rtb.zBBetriebLizenzen")}
            className={`block ${input} w-52`}
          />
        </label>
        <label className="text-xs">
          {t("budgeting.rtb.betrag2")}
          <input
            name="plannedAmount"
            type="number"
            min={0}
            step={1000}
            defaultValue={0}
            className={`block ${input} w-32 text-right tabular-nums`}
          />
        </label>
        <label className="text-xs">
          Periode
          {/* Default `yearly`: Betriebskosten werden im Jahr geplant. */}
          <select
            name="interval"
            value={interval}
            onChange={(e) => setInterval(e.target.value)}
            className={`block ${input} w-32`}
          >
            {RTB_INTERVALS.map((i) => (
              <option key={i} value={i}>
                {t(RTB_INTERVAL_KEYS[i])}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Abgesetzt statt inmitten der Eingaben — sie schliessen die Eingabe ab. */}
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={pending} className={btn}>
          {pending ? "…" : "Hinzufügen"}
        </button>
        <button type="button" onClick={onClose} className={btnGhost}>
          {t("budgeting.rtb.abbrechen")}
        </button>
      </div>

      {state.error && <p className="text-xs text-destructive">{state.error}</p>}
    </form>
  );
}
