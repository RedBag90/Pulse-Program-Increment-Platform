"use client";

import { useActionState } from "react";
import type { DecisionsModel, DecisionGroupView } from "@/modules/budgeting/server/views/decisions-view";
import { setReportOutAction } from "@/modules/budgeting/features/actions/round";

const input =
  "rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
const btn =
  "rounded bg-blue-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50";

/**
 * Report-out je Gruppe (F-B4): teuerste Zusage, klarstes Nein und größter
 * Streitpunkt — jeweils Epic + Begründung. Macht das mündliche Report-out der
 * Gruppen protokollierbar. `budget.round.manage`-gegated.
 */
export function RoundReportOut({ model }: { model: DecisionsModel }) {
  if (model.groups.length === 0) return null;

  return (
    <div className="rounded-lg border bg-card p-4">
      <h2 className="text-sm font-semibold">Report-out der Gruppen</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Je Gruppe: teuerste Zusage, klarstes Nein, größter Streitpunkt — mit kurzer Begründung.
      </p>
      <div className="mt-3 space-y-3">
        {model.groups.map((g) => (
          <GroupReportOut key={g.id} group={g} epics={model.epics} canManage={model.canManage} />
        ))}
      </div>
    </div>
  );
}

function GroupReportOut({
  group,
  epics,
  canManage,
}: {
  group: DecisionGroupView;
  epics: { id: string; title: string }[];
  canManage: boolean;
}) {
  const [state, action, pending] = useActionState(setReportOutAction, {});
  const r = group.reportOut;
  const titleOf = (id: string | null) => epics.find((e) => e.id === id)?.title ?? "—";

  if (!canManage) {
    return (
      <div className="rounded-md border bg-muted/20 p-3 text-xs">
        <p className="text-sm font-medium">{group.name}</p>
        {r ? (
          <dl className="mt-1 space-y-0.5">
            <ReadRow label="Teuerste Zusage" epic={titleOf(r.costliestYesEpicId)} reason={r.costliestYesReason} />
            <ReadRow label="Klarstes Nein" epic={titleOf(r.clearestNoEpicId)} reason={r.clearestNoReason} />
            <ReadRow label="Größter Streitpunkt" epic={titleOf(r.biggestDisputeEpicId)} reason={r.disputeReason} />
          </dl>
        ) : (
          <p className="mt-1 text-muted-foreground">Noch kein Report-out.</p>
        )}
      </div>
    );
  }

  return (
    <form action={action} className="rounded-md border bg-muted/20 p-3">
      <input type="hidden" name="groupId" value={group.id} />
      <p className="text-sm font-medium">{group.name}</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        <EpicReason
          label="Teuerste Zusage"
          epicName="costliestYesEpicId"
          reasonName="costliestYesReason"
          epics={epics}
          epicValue={r?.costliestYesEpicId ?? ""}
          reasonValue={r?.costliestYesReason ?? ""}
        />
        <EpicReason
          label="Klarstes Nein"
          epicName="clearestNoEpicId"
          reasonName="clearestNoReason"
          epics={epics}
          epicValue={r?.clearestNoEpicId ?? ""}
          reasonValue={r?.clearestNoReason ?? ""}
        />
        <EpicReason
          label="Größter Streitpunkt"
          epicName="biggestDisputeEpicId"
          reasonName="disputeReason"
          epics={epics}
          epicValue={r?.biggestDisputeEpicId ?? ""}
          reasonValue={r?.disputeReason ?? ""}
        />
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button type="submit" disabled={pending} className={btn}>
          {pending ? "…" : "Report-out speichern"}
        </button>
        {state.error && <span className="text-xs text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}

function EpicReason({
  label,
  epicName,
  reasonName,
  epics,
  epicValue,
  reasonValue,
}: {
  label: string;
  epicName: string;
  reasonName: string;
  epics: { id: string; title: string }[];
  epicValue: string;
  reasonValue: string;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-xs text-muted-foreground">{label}</label>
      <select name={epicName} defaultValue={epicValue} className={`block w-full ${input}`}>
        <option value="">— Epic wählen —</option>
        {epics.map((e) => (
          <option key={e.id} value={e.id}>
            {e.title}
          </option>
        ))}
      </select>
      <input
        name={reasonName}
        defaultValue={reasonValue}
        placeholder="Begründung"
        className={`block w-full ${input}`}
      />
    </div>
  );
}

function ReadRow({ label, epic, reason }: { label: string; epic: string; reason: string | null }) {
  return (
    <div className="flex flex-wrap gap-x-2">
      <dt className="text-muted-foreground">{label}:</dt>
      <dd className="font-medium">{epic}</dd>
      {reason && <dd className="text-muted-foreground">— {reason}</dd>}
    </div>
  );
}
