"use client";

import { useActionState } from "react";
import type { ZonesModel } from "@/modules/budgeting/server/views/zones-view";
import { setGroupAllocationAction } from "@/modules/budgeting/features/actions/round";

const EUR = (n: number) => `${n.toLocaleString("de-DE")} €`;

const ZONE_BADGE: Record<string, string> = {
  consensus: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  rejection: "bg-slate-100 text-slate-500 dark:bg-slate-900 dark:text-slate-400",
  spread: "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
};
const ZONE_LABEL: Record<string, string> = {
  consensus: "Konsens",
  rejection: "Ablehnung",
  spread: "Streuzone",
};

export function RoundCapture({ model, canManage }: { model: ZonesModel; canManage: boolean }) {
  const running = model.status === "running";
  return (
    <div className="space-y-4">
      <ScarcityBar model={model} />
      <div className="rounded-lg border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold">
          Gruppen-Erfassung & Zonen{" "}
          <span className="text-xs font-normal text-muted-foreground">
            (Konsens/Ablehnung nicht diskutieren — nur die Streuzone)
          </span>
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-1 pr-3">Epic</th>
                <th className="py-1 pr-3 text-right">Kosten</th>
                {model.groups.map((g) => (
                  <th key={g.id} className="px-2 py-1 text-center">{g.name}</th>
                ))}
                <th className="py-1 pl-3">Zone</th>
              </tr>
            </thead>
            <tbody>
              {model.epics.map((e) => (
                <tr key={e.epicId} className="border-b last:border-0">
                  <td className="py-1.5 pr-3 font-medium">{e.title}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{EUR(e.cost)}</td>
                  {model.groups.map((g) => (
                    <td key={g.id} className="px-2 py-1.5 text-center">
                      <Cell
                        roundId={model.roundId}
                        groupId={g.id}
                        epicId={e.epicId}
                        funded={!!model.votes[`${g.id}:${e.epicId}`]}
                        disabled={!running || !canManage}
                      />
                    </td>
                  ))}
                  <td className="py-1.5 pl-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ZONE_BADGE[e.zone]}`}>
                      {ZONE_LABEL[e.zone]} {e.yes}/{e.total}
                    </span>
                  </td>
                </tr>
              ))}
              {model.epics.length === 0 && (
                <tr>
                  <td colSpan={model.groups.length + 3} className="py-3 text-center text-xs text-muted-foreground">
                    Keine Ballot-Kandidaten — Epics vormerken (vollständige Einreichung).
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Cell({
  roundId,
  groupId,
  epicId,
  funded,
  disabled,
}: {
  roundId: string;
  groupId: string;
  epicId: string;
  funded: boolean;
  disabled: boolean;
}) {
  const [, action, pending] = useActionState(setGroupAllocationAction, {});
  if (disabled) {
    return <span className={funded ? "text-emerald-600" : "text-muted-foreground/40"}>{funded ? "✓" : "–"}</span>;
  }
  return (
    <form action={action} className="inline">
      <input type="hidden" name="roundId" value={roundId} />
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="epicId" value={epicId} />
      <input type="hidden" name="funded" value={funded ? "false" : "true"} />
      <button
        type="submit"
        disabled={pending}
        aria-pressed={funded}
        className={`grid size-6 place-items-center rounded border text-xs ${
          funded
            ? "border-emerald-300 bg-emerald-50 text-emerald-700"
            : "border-gray-200 text-muted-foreground hover:bg-muted"
        }`}
      >
        {funded ? "✓" : "–"}
      </button>
    </form>
  );
}

function ScarcityBar({ model }: { model: ZonesModel }) {
  const s = model.scarcity;
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-lg border bg-card px-4 py-2 text-xs">
      <Stat label="Nachfrage" value={EUR(s.demand)} />
      <Stat label="Verteilbar" value={EUR(s.distributable)} />
      <div>
        <dt className="text-muted-foreground">Knappheitsfaktor</dt>
        <dd className="font-medium tabular-nums">
          {s.factor === Infinity ? "∞" : s.factor.toFixed(2)}{" "}
          {s.passes ? (
            <span className="text-emerald-600">✓ ≥ 1,3</span>
          ) : (
            <span className="text-amber-700">&lt; 1,3 — kein echter Trade-off</span>
          )}
        </dd>
      </div>
      <Stat label="Konsens" value={EUR(model.consensusSum)} />
      <Stat label="Streuzone" value={EUR(model.spreadSum)} />
      <Stat label="Ablehnung" value={`${model.rejectionCount} Epic(s)`} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}
