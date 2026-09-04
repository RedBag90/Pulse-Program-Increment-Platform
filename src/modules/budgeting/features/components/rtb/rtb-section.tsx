"use client";

import { useActionState, useState } from "react";
import {
  createRtbItemAction,
  updateRtbItemAction,
  deleteRtbItemAction,
} from "@/modules/budgeting/features/actions/rtb";
import {
  RTB_INTERVALS,
  RTB_INTERVAL_LABELS,
  rtbAnnualAmount,
  rtbIntervalOrDefault,
} from "@/modules/budgeting/domain/rtb-interval";
import {
  RTB_KINDS,
  RTB_KIND_LABELS,
  isChangeKind,
  splitRunAndChange,
} from "@/modules/budgeting/domain/rtb-kind";
import { ConfirmMutateForm } from "@/components/actions/confirm-mutate-form";

const input =
  "rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
const btn =
  "rounded bg-blue-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50";
const btnGhost = "rounded border px-2 py-1 text-xs text-muted-foreground hover:text-foreground";
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
  /** "run" (Betrieb) | "art_change" (ART-Epic-Budget). */
  kind?: string;
  /** Der ART, für den ein ART-Epic-Budget reserviert ist. */
  artId?: string | null;
}

export interface RtbSolutionOption {
  id: string;
  name: string;
}

export interface RtbArtOption {
  id: string;
  name: string;
}

/**
 * Run-the-Business-Plan: die **eine** Pflege-Fläche für Betriebskosten und
 * ART-Epic-Budgets. Gerendert im Wertstrom-Budget und im Solution-Detail.
 *
 * **Zwei Gruppen, zwei Summen.** Betrieb ist Run, ein ART-Epic-Budget ist Grow.
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
  /** ARTs dieses Wertstroms; leer ⇒ kein ART-Epic-Budget anlegbar. */
  arts?: RtbArtOption[];
}) {
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

  const { run, change } = splitRunAndChange(items);

  const groupProps = {
    canManage,
    editingId,
    onEdit: setEditingId,
    solutions,
    showSolution,
    solutionName,
    artName,
    arts,
    canUseArts,
  };

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-medium">Run the Business</h2>
        <p className="text-xs text-muted-foreground">
          {scoped
            ? "Betriebskosten, die dieser Solution zugerechnet sind."
            : "Was dieser Wertstrom laufend braucht: der Betrieb (Keep the lights on) und die ART-Epic-Budgets seiner ARTs. Beide gehen denselben Weg über die PB-Liste — das eine ist Run, das andere Grow, deshalb stehen sie getrennt."}{" "}
          Aktive Positionen kommen als Kandidaten auf die PB-Liste jeder gestarteten
          Budgeting-Kachel.
        </p>
      </div>

      {items.length === 0 && (
        <p className="rounded-lg border px-3 py-2 text-sm text-muted-foreground">
          Noch keine Positionen.
        </p>
      )}

      {run.items.length > 0 && (
        <RtbGroupTable title="Betrieb" group={run} kindOfGroup="run" {...groupProps} />
      )}
      {change.items.length > 0 && (
        <RtbGroupTable
          title={`${RTB_KIND_LABELS.art_change}s`}
          group={change}
          kindOfGroup="art_change"
          {...groupProps}
        />
      )}

      {canManage &&
        (adding ? (
          <AddForm
            valueStreamId={valueStreamId}
            solutionId={solutionId}
            solutions={solutions}
            showSolution={showSolution}
            arts={arts}
            canUseArts={canUseArts}
            onClose={() => setAdding(false)}
          />
        ) : (
          <button type="button" onClick={() => setAdding(true)} className={btn}>
            + Position hinzufügen
          </button>
        ))}
    </section>
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
  arts: RtbArtOption[];
  canUseArts: boolean;
}

/** Eine Gruppe als ruhende Tabelle, mit eigener Summe im Kopf. */
function RtbGroupTable({
  title,
  group,
  kindOfGroup,
  ...p
}: GroupProps & {
  title: string;
  group: { items: RtbItem[]; annual: number; cycle: number };
  kindOfGroup: "run" | "art_change";
}) {
  const isChange = kindOfGroup === "art_change";
  // Die zweite Spalte trägt, was die Gruppe **nicht** schon sagt: bei Betrieb
  // die Solution, bei einem ART-Epic-Budget den ART.
  const secondCol = isChange ? "ART" : p.showSolution ? "Solution" : null;

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-baseline gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h3>
        <span className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{EUR(group.annual)}</span> p. a.
          <span className="mx-1.5">·</span>
          <span className="font-medium text-foreground">{EUR(group.cycle)}</span> je Kachel
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-surface-frame text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2">Position</th>
              {secondCol && <th className="px-3 py-2">{secondCol}</th>}
              <th className="px-3 py-2">Periode</th>
              <th className="px-3 py-2 text-right">Betrag</th>
              <th className="px-3 py-2 text-right">p. a.</th>
              {p.canManage && <th className="px-3 py-2" />}
            </tr>
          </thead>
          <tbody>
            {group.items.map((it) =>
              p.editingId === it.id ? (
                <tr key={it.id} className="border-b last:border-b-0 bg-primary/5">
                  <td colSpan={secondCol ? 6 : 5} className="p-3">
                    <RowEditor item={it} onClose={() => p.onEdit(null)} {...p} />
                  </td>
                </tr>
              ) : (
                <tr
                  key={it.id}
                  className={`border-b last:border-b-0 ${it.active ? "" : "opacity-55"}`}
                >
                  <td className={`px-3 py-2 ${it.active ? "" : "line-through"}`}>{it.name}</td>
                  {secondCol && (
                    <td className="px-3 py-2 text-muted-foreground">
                      {isChange ? p.artName(it.artId) : p.solutionName(it.solutionId)}
                    </td>
                  )}
                  <td className="px-3 py-2 text-muted-foreground">
                    {RTB_INTERVAL_LABELS[rtbIntervalOrDefault(it.interval)]}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{EUR(it.plannedAmount)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {it.active ? (
                      EUR(rtbAnnualAmount(it.plannedAmount, it.interval))
                    ) : (
                      <span className="text-muted-foreground">inaktiv</span>
                    )}
                  </td>
                  {p.canManage && (
                    <td className="px-3 py-2 text-right">
                      <button type="button" onClick={() => p.onEdit(it.id)} className={btnGhost}>
                        Bearbeiten
                      </button>
                    </td>
                  )}
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Die geöffnete Zeile. Trägt zum ersten Mal auch **Art** und **ART** — die
 * Server-Action nimmt beide entgegen, das alte Zeilen-Formular schickte sie nie
 * mit, sodass eine einmal angelegte Zuordnung unveränderlich war.
 */
function RowEditor({
  item,
  onClose,
  solutions,
  showSolution,
  arts,
  canUseArts,
}: GroupProps & { item: RtbItem; onClose: () => void }) {
  const [state, action, pending] = useActionState(updateRtbItemAction, {});
  const [kind, setKind] = useState<string>(item.kind ?? "run");

  return (
    <div className="space-y-2">
      <form action={action} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="id" value={item.id} />

        {canUseArts && (
          <>
            <label className="text-xs">
              Art
              <select
                name="kind"
                value={kind}
                onChange={(e) => setKind(e.target.value)}
                className={`block ${input} w-44`}
              >
                {RTB_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {RTB_KIND_LABELS[k]}
                  </option>
                ))}
              </select>
            </label>
            {isChangeKind(kind) && (
              <label className="text-xs">
                ART
                <select
                  name="artId"
                  required
                  defaultValue={item.artId ?? ""}
                  className={`block ${input} w-40`}
                >
                  <option value="">— bitte wählen</option>
                  {arts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </>
        )}

        <label className="text-xs">
          Position
          <input name="name" defaultValue={item.name} className={`block ${input} w-52`} />
        </label>
        <label className="text-xs">
          Betrag (€)
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
          Periode
          <select
            name="interval"
            defaultValue={rtbIntervalOrDefault(item.interval)}
            className={`block ${input} w-32`}
          >
            {RTB_INTERVALS.map((i) => (
              <option key={i} value={i}>
                {RTB_INTERVAL_LABELS[i]}
              </option>
            ))}
          </select>
        </label>
        {showSolution && (
          <label className="text-xs">
            Solution
            <select
              name="solutionId"
              defaultValue={item.solutionId ?? ""}
              className={`block ${input} w-40`}
            >
              <option value="">— übergreifend</option>
              {solutions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <button type="submit" disabled={pending} className={btn}>
          {pending ? "…" : "Speichern"}
        </button>
        <button type="button" onClick={onClose} className={btnGhost}>
          Abbrechen
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
        <ConfirmMutateForm
          action={deleteRtbItemAction}
          fields={{ id: item.id }}
          label="Entfernen"
          pendingLabel="…"
          confirmPrompt={`„${item.name}" wirklich entfernen? Zugeteilte Beträge dieser Position gehen verloren.`}
          destructive
          size="sm"
          className="ml-auto"
          onSuccess={onClose}
        />
      </div>

      {state.error && <p className="text-xs text-red-600">{state.error}</p>}
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
  const [state, action, pending] = useActionState(createRtbItemAction, {});
  const [kind, setKind] = useState<string>("run");

  return (
    <form action={action} className="space-y-3 rounded-lg border bg-surface-frame p-3">
      <input type="hidden" name="valueStreamId" value={valueStreamId} />
      {solutionId != null && <input type="hidden" name="solutionId" value={solutionId} />}

      {canUseArts && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs">
            Art
            <select
              name="kind"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              className={`block ${input} w-44`}
            >
              {RTB_KINDS.map((k) => (
                <option key={k} value={k}>
                  {RTB_KIND_LABELS[k]}
                </option>
              ))}
            </select>
          </label>
          {isChangeKind(kind) && (
            <label className="text-xs">
              ART
              <select name="artId" required defaultValue="" className={`block ${input} w-40`}>
                <option value="">— bitte wählen</option>
                {arts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs">
          Position
          <input
            name="name"
            required
            placeholder="z. B. Betrieb / Lizenzen"
            className={`block ${input} w-52`}
          />
        </label>
        <label className="text-xs">
          Betrag (€)
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
          <select name="interval" defaultValue="yearly" className={`block ${input} w-32`}>
            {RTB_INTERVALS.map((i) => (
              <option key={i} value={i}>
                {RTB_INTERVAL_LABELS[i]}
              </option>
            ))}
          </select>
        </label>
        {showSolution && (
          <label className="text-xs">
            Solution
            <select name="solutionId" defaultValue="" className={`block ${input} w-40`}>
              <option value="">— übergreifend</option>
              {solutions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <button type="submit" disabled={pending} className={btn}>
          {pending ? "…" : "Hinzufügen"}
        </button>
        <button type="button" onClick={onClose} className={btnGhost}>
          Abbrechen
        </button>
      </div>

      {state.error && <p className="text-xs text-red-600">{state.error}</p>}
    </form>
  );
}
