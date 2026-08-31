"use client";

import { useActionState } from "react";
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
  sumRtbAnnual,
  sumRtbCycle,
} from "@/modules/budgeting/domain/rtb-interval";

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
}

export interface RtbSolutionOption {
  id: string;
  name: string;
}

/**
 * Run-the-Business-Plan: die **eine** Pflege-Fläche der Betriebskosten. Wird an
 * drei Stellen mit derselben Datengrundlage gerendert — zentral je Wertstrom
 * (`/budgeting/run-the-business`), im Wertstrom-Detail und im Solution-Detail.
 *
 * Auf der Solution-Fläche (`solutionId` gesetzt) entfällt die Solution-Spalte:
 * die Fläche setzt die Zurechnung schon, und neue Positionen erben sie.
 *
 * Aktive Positionen kommen als Ballot-Kandidaten in jede gestartete
 * Budgeting-Kachel — mit dem Betrag **einer** Kachel, nicht dem gepflegten.
 * Deshalb nennt die Kopfzeile beide Summen: ohne sie ist nicht erkennbar, was
 * eine Zahl bedeutet.
 */
export function RtbSection({
  valueStreamId,
  items,
  canManage,
  solutions = [],
  solutionId = null,
}: {
  valueStreamId: string;
  items: RtbItem[];
  canManage: boolean;
  /** Zuordenbare Solutions des Wertstroms; leer ⇒ kein Solution-Feld. */
  solutions?: RtbSolutionOption[];
  /** Gesetzt ⇒ Fläche einer einzelnen Solution: Spalte weg, Zurechnung fix. */
  solutionId?: string | null;
}) {
  const [addState, addAction, addPending] = useActionState(createRtbItemAction, {});
  const scoped = solutionId != null;
  const showSolution = !scoped && solutions.length > 0;
  const solutionName = (id: string | null) =>
    id == null ? "— übergreifend" : (solutions.find((s) => s.id === id)?.name ?? "— übergreifend");

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium">Run the Business</h2>
      <p className="text-xs text-muted-foreground">
        {scoped
          ? "Betriebskosten, die dieser Solution zugerechnet sind."
          : "Betriebskosten dieses Wertstroms (Keep the lights on). Jede Position hat ihre eigene Periode und kann einer Solution zugerechnet werden."}{" "}
        Aktive Positionen kommen als Ballot-Kandidaten in jede gestartete Budgeting-Kachel.
      </p>
      <p className="text-xs text-muted-foreground">
        Σ aktiv <span className="font-medium text-foreground">{EUR(sumRtbAnnual(items))}</span> p.
        a.
        <span className="mx-2">·</span>
        <span className="font-medium text-foreground">{EUR(sumRtbCycle(items))}</span> je
        Budget-Kachel (Halbjahr)
      </p>

      <ul className="divide-y divide-border rounded-lg border">
        {items.map((it) => (
          <RtbRow
            key={it.id}
            item={it}
            canManage={canManage}
            {...(showSolution ? { solutions } : {})}
            solutionLabel={solutionName(it.solutionId)}
          />
        ))}
        {items.length === 0 && (
          <li className="px-3 py-2 text-sm text-muted-foreground">Noch keine Positionen.</li>
        )}
      </ul>

      {canManage && (
        <form action={addAction} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="valueStreamId" value={valueStreamId} />
          {scoped && <input type="hidden" name="solutionId" value={solutionId} />}
          <label className="text-xs">
            Position
            <input
              name="name"
              required
              placeholder="z. B. Betrieb / Lizenzen"
              className={`block ${input}`}
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
              className={`block ${input} w-32`}
            />
          </label>
          <label className="text-xs">
            Periode
            {/* Default `yearly`: Betriebskosten werden im Jahr geplant. Die
                Bestandszeilen stehen dagegen auf `half_yearly` — das ist, was
                ihr Betrag vor der Vereinheitlichung bedeutete. */}
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
          <button type="submit" disabled={addPending} className={btn}>
            {addPending ? "…" : "Position hinzufügen"}
          </button>
          {addState.error && <span className="text-xs text-red-600">{addState.error}</span>}
        </form>
      )}
    </section>
  );
}

function RtbRow({
  item,
  canManage,
  solutions,
  solutionLabel,
}: {
  item: RtbItem;
  canManage: boolean;
  solutions?: RtbSolutionOption[];
  solutionLabel: string;
}) {
  const [, updateAction] = useActionState(updateRtbItemAction, {});
  const [, deleteAction] = useActionState(deleteRtbItemAction, {});
  const interval = rtbIntervalOrDefault(item.interval);
  // Nur bei nicht-jährlicher Periode: sonst stünde die Umrechnung eines
  // Jahresbetrags auf sich selbst da.
  const derived =
    interval === "yearly" ? null : `= ${EUR(rtbAnnualAmount(item.plannedAmount, interval))} p. a.`;

  if (!canManage) {
    return (
      <li className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
        <span className={item.active ? "" : "text-muted-foreground line-through"}>{item.name}</span>
        <span className="flex items-center gap-3 text-muted-foreground">
          {solutions && <span className="text-xs">{solutionLabel}</span>}
          <span className="text-xs">{RTB_INTERVAL_LABELS[interval]}</span>
          <span className="tabular-nums">{EUR(item.plannedAmount)}</span>
        </span>
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
      <form action={updateAction} className="flex flex-wrap items-center gap-1.5">
        <input type="hidden" name="id" value={item.id} />
        <input name="name" defaultValue={item.name} className={`${input} w-44`} />
        <span className="flex flex-col">
          <input
            name="plannedAmount"
            type="number"
            min={0}
            step={1000}
            defaultValue={item.plannedAmount}
            className={`${input} w-28 text-right tabular-nums`}
          />
          {derived && <span className="mt-0.5 text-[10px] text-muted-foreground">{derived}</span>}
        </span>
        <select name="interval" defaultValue={interval} className={`${input} w-32`}>
          {RTB_INTERVALS.map((i) => (
            <option key={i} value={i}>
              {RTB_INTERVAL_LABELS[i]}
            </option>
          ))}
        </select>
        {solutions && (
          <select
            name="solutionId"
            defaultValue={item.solutionId ?? ""}
            className={`${input} w-40`}
          >
            <option value="">— übergreifend</option>
            {solutions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
        <input type="hidden" name="active" value={String(item.active)} />
        <button type="submit" className={btnGhost}>
          speichern
        </button>
      </form>
      <div className="flex items-center gap-1.5">
        <form action={updateAction}>
          <input type="hidden" name="id" value={item.id} />
          <input type="hidden" name="active" value={String(!item.active)} />
          <button type="submit" className={btnGhost}>
            {item.active ? "deaktivieren" : "aktivieren"}
          </button>
        </form>
        <form action={deleteAction}>
          <input type="hidden" name="id" value={item.id} />
          <button type="submit" className={`${btnGhost} text-red-600`}>
            entfernen
          </button>
        </form>
      </div>
    </li>
  );
}
