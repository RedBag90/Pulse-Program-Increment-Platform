"use client";

import { useActionState } from "react";
import type { DecisionsModel, DecisionRow } from "@/modules/budgeting/server/views/decisions-view";
import { recordDecisionAction } from "@/modules/budgeting/features/actions/round";

const EUR = (n: number) => `${n.toLocaleString("de-DE")} €`;
const input =
  "rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

const MAJ_LABEL: Record<string, string> = { yes: "Mehrheit Ja", no: "Mehrheit Nein", none: "keine Mehrheit" };
const OUTCOME_LABEL: Record<string, string> = {
  funded: "finanziert",
  rejected: "abgelehnt",
  deferred_with_review: "vertagt (Prüfauftrag)",
};

export function RoundDecisions({ model }: { model: DecisionsModel }) {
  const editable = model.status === "decided" && model.canDecide;

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">
          Streuzonen-Entscheidung{" "}
          <span className="text-xs font-normal text-muted-foreground">({model.spread.length} Epics)</span>
        </h2>
        {model.reserveAmount != null && (
          <span className="text-xs">
            Reserve: <span className="font-medium tabular-nums">{EUR(model.reserveAmount)}</span> → Folgerunde
          </span>
        )}
      </div>

      {model.spread.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">Keine Streuzone — nichts zu entscheiden.</p>
      ) : (
        <div className="mt-3 space-y-3">
          {model.spread.map((e) => (
            <DecisionCard key={e.epicId} roundId={model.roundId} row={e} editable={editable} />
          ))}
        </div>
      )}
    </div>
  );
}

function DecisionCard({
  roundId,
  row,
  editable,
}: {
  roundId: string;
  row: DecisionRow;
  editable: boolean;
}) {
  const [state, action, pending] = useActionState(recordDecisionAction, {});
  const d = row.decision;

  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">{row.title}</span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {EUR(row.cost)} · {row.yes}/{row.total} · {MAJ_LABEL[row.majority]}
        </span>
        {d && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
            {OUTCOME_LABEL[d.outcome] ?? d.outcome}
            {d.deviatesFromMajority && <span className="ml-1 text-amber-700">· Abweichung</span>}
          </span>
        )}
      </div>

      {d?.justification && <p className="mt-1 text-xs text-muted-foreground">Begründung: {d.justification}</p>}
      {d?.deferredCheckTask && (
        <p className="mt-1 text-xs text-muted-foreground">Prüfauftrag: {d.deferredCheckTask}</p>
      )}

      {editable && (
        <form action={action} className="mt-2 flex flex-wrap items-end gap-2">
          <input type="hidden" name="roundId" value={roundId} />
          <input type="hidden" name="epicId" value={row.epicId} />
          <label className="text-xs">
            Entscheidung
            <select name="outcome" defaultValue={d?.outcome ?? "funded"} className={`block ${input}`}>
              <option value="funded">finanzieren</option>
              <option value="rejected">ablehnen</option>
              <option value="deferred_with_review">vertagen (Prüfauftrag)</option>
            </select>
          </label>
          <label className="flex-1 text-xs">
            Begründung (Pflicht bei Abweichung von der Mehrheit)
            <input name="justification" defaultValue={d?.justification ?? ""} className={`block w-full ${input}`} />
          </label>
          <label className="text-xs">
            Prüfauftrag (bei Vertagung)
            <input name="deferredCheckTask" defaultValue={d?.deferredCheckTask ?? ""} className={`block ${input}`} />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="rounded bg-blue-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
          >
            {pending ? "…" : "Entscheiden"}
          </button>
          {state.error && <span className="w-full text-xs text-red-600">{state.error}</span>}
        </form>
      )}
    </div>
  );
}
