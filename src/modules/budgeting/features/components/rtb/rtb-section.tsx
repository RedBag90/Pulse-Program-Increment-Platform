"use client";

import { useActionState } from "react";
import {
  createRtbItemAction,
  updateRtbItemAction,
  deleteRtbItemAction,
} from "@/modules/budgeting/features/actions/rtb";

const input =
  "rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
const btn = "rounded bg-blue-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50";
const btnGhost = "rounded border px-2 py-1 text-xs text-muted-foreground hover:text-foreground";
const EUR = (n: number) => `${n.toLocaleString("de-DE")} €`;

export interface RtbItem {
  id: string;
  name: string;
  plannedAmount: number;
  active: boolean;
}

/**
 * Run-the-Business-Plan eines Value Streams: stehende Betriebskosten-Positionen,
 * die als partizipative Ballot-Kandidaten in jede gestartete Budgeting-Kachel
 * fließen. Nur Wertstrom-Owner/Finance/Admin editierbar.
 */
export function RtbSection({
  valueStreamId,
  items,
  canManage,
}: {
  valueStreamId: string;
  items: RtbItem[];
  canManage: boolean;
}) {
  const [addState, addAction, addPending] = useActionState(createRtbItemAction, {});
  const total = items.filter((i) => i.active).reduce((s, i) => s + i.plannedAmount, 0);

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium">Run the Business</h2>
      <p className="text-xs text-muted-foreground">
        Betriebskosten dieses Wertstroms (Keep the lights on). Aktive Positionen kommen als
        Ballot-Kandidaten in jede gestartete Budgeting-Kachel. Σ aktiv: {EUR(total)}.
      </p>

      <ul className="divide-y divide-border rounded-lg border">
        {items.map((it) => (
          <RtbRow key={it.id} item={it} canManage={canManage} />
        ))}
        {items.length === 0 && (
          <li className="px-3 py-2 text-sm text-muted-foreground">Noch keine Positionen.</li>
        )}
      </ul>

      {canManage && (
        <form action={addAction} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="valueStreamId" value={valueStreamId} />
          <label className="text-xs">
            Position
            <input name="name" required placeholder="z. B. Betrieb / Lizenzen" className={`block ${input}`} />
          </label>
          <label className="text-xs">
            Betrag (€)
            <input name="plannedAmount" type="number" min={0} step={1000} defaultValue={0} className={`block ${input} w-32`} />
          </label>
          <button type="submit" disabled={addPending} className={btn}>
            {addPending ? "…" : "Position hinzufügen"}
          </button>
          {addState.error && <span className="text-xs text-red-600">{addState.error}</span>}
        </form>
      )}
    </section>
  );
}

function RtbRow({ item, canManage }: { item: RtbItem; canManage: boolean }) {
  const [, updateAction] = useActionState(updateRtbItemAction, {});
  const [, deleteAction] = useActionState(deleteRtbItemAction, {});

  if (!canManage) {
    return (
      <li className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
        <span className={item.active ? "" : "text-muted-foreground line-through"}>{item.name}</span>
        <span className="tabular-nums text-muted-foreground">{EUR(item.plannedAmount)}</span>
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
      <form action={updateAction} className="flex items-center gap-1.5">
        <input type="hidden" name="id" value={item.id} />
        <input name="name" defaultValue={item.name} className={`${input} w-44`} />
        <input name="plannedAmount" type="number" min={0} step={1000} defaultValue={item.plannedAmount} className={`${input} w-28`} />
        <input type="hidden" name="active" value={String(item.active)} />
        <button type="submit" className={btnGhost}>speichern</button>
      </form>
      <div className="flex items-center gap-1.5">
        <form action={updateAction}>
          <input type="hidden" name="id" value={item.id} />
          <input type="hidden" name="active" value={String(!item.active)} />
          <button type="submit" className={btnGhost}>{item.active ? "deaktivieren" : "aktivieren"}</button>
        </form>
        <form action={deleteAction}>
          <input type="hidden" name="id" value={item.id} />
          <button type="submit" className={`${btnGhost} text-red-600`}>entfernen</button>
        </form>
      </div>
    </li>
  );
}
