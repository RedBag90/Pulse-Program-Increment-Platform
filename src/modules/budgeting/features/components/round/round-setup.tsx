"use client";

import { useActionState } from "react";
import type { RoundSetupModel } from "@/modules/budgeting/server/views/round-view";
import {
  createRoundAction,
  updateRoundFrameAction,
  transitionRoundAction,
  addGroupAction,
  removeGroupAction,
  updateGroupAction,
  addGroupMemberAction,
  removeGroupMemberAction,
} from "@/modules/budgeting/features/actions/round";

const input =
  "rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
const btn = "rounded bg-blue-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50";
const btnGhost = "rounded border px-2 py-1 text-xs text-muted-foreground hover:text-foreground";

const STATUS_LABEL: Record<string, string> = {
  draft: "Entwurf",
  running: "läuft",
  decided: "entschieden",
  closed: "abgeschlossen",
};

export function RoundSetup({ model }: { model: RoundSetupModel }) {
  if (!model.round) {
    return <CreateRound cycleKey={model.cycleKey} canManage={model.canManage} />;
  }
  return (
    <div className="space-y-6">
      <RoundFrame model={model} />
      {model.round.status === "draft" && <GroupsEditor model={model} />}
      {model.round.status !== "draft" && <GroupsReadonly model={model} />}
    </div>
  );
}

function CreateRound({ cycleKey, canManage }: { cycleKey: string; canManage: boolean }) {
  const [state, action, pending] = useActionState(createRoundAction, {});
  return (
    <div className="rounded-lg border bg-card p-4">
      <h2 className="text-sm font-semibold">Neue PB-Runde für {cycleKey}</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Für dieses Halbjahr gibt es noch keine Runde. Lege den Rahmen an (Topf), dann Gruppen.
      </p>
      {canManage ? (
        <form action={action} className="mt-3 flex flex-wrap items-end gap-2">
          <input type="hidden" name="cycleKey" value={cycleKey} />
          <label className="text-xs">
            Topf (€)
            <input name="poolTotal" type="number" min={0} step={1000} required className={`block ${input}`} />
          </label>
          <button type="submit" disabled={pending} className={btn}>
            {pending ? "…" : "Runde anlegen"}
          </button>
          {state.error && <span className="text-xs text-red-600">{state.error}</span>}
        </form>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">Keine Berechtigung, eine Runde anzulegen.</p>
      )}
    </div>
  );
}

function RoundFrame({ model }: { model: RoundSetupModel }) {
  const round = model.round!;
  const [frameState, frameAction, framePending] = useActionState(updateRoundFrameAction, {});
  const [, startAction, startPending] = useActionState(transitionRoundAction, {});
  const distributable = round.poolTotal - model.mandatorySum;

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">
          Rahmen · {model.cycleKey}{" "}
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
            {STATUS_LABEL[round.status] ?? round.status}
          </span>
        </h2>
      </div>

      <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-xs md:grid-cols-4">
        <Stat label="Topf" value={`${round.poolTotal.toLocaleString("de-DE")} €`} />
        <Stat label="Pflichtvorhaben" value={`${model.mandatoryCount} · ${model.mandatorySum.toLocaleString("de-DE")} €`} />
        <Stat label="Verteilbar" value={`${distributable.toLocaleString("de-DE")} €`} />
        <Stat label="Ballot-Kandidaten" value={String(model.ballotCount)} />
      </dl>

      {round.status === "draft" && model.canManage && (
        <form action={frameAction} className="mt-3 flex flex-wrap items-end gap-2">
          <input type="hidden" name="id" value={round.id} />
          <label className="text-xs">
            Topf (€)
            <input name="poolTotal" type="number" min={0} step={1000} defaultValue={round.poolTotal} className={`block ${input}`} />
          </label>
          <label className="text-xs">
            Termin
            <input name="plannedAt" type="date" defaultValue={round.plannedAt ? round.plannedAt.toISOString().slice(0, 10) : ""} className={`block ${input}`} />
          </label>
          <button type="submit" disabled={framePending} className={btn}>
            {framePending ? "…" : "Rahmen speichern"}
          </button>
          {frameState.error && <span className="text-xs text-red-600">{frameState.error}</span>}
        </form>
      )}

      {model.canManage && round.status === "draft" && (
        <form action={startAction} className="mt-3 border-t pt-3">
          <input type="hidden" name="id" value={round.id} />
          <input type="hidden" name="to" value="running" />
          <button type="submit" disabled={startPending} className={btn}>
            {startPending ? "…" : "Runde starten (draft → läuft)"}
          </button>
          <p className="mt-1 text-xs text-muted-foreground">
            Erfordert Topf &gt; 0 und ≥ 3 Gruppen. Verbindlichkeit: <strong>beratend</strong> — die
            Gruppenverteilung berät die Entscheidungsinstanz.
          </p>
        </form>
      )}

      {model.canManage && round.status === "running" && (
        <form action={startAction} className="mt-3 border-t pt-3">
          <input type="hidden" name="id" value={round.id} />
          <input type="hidden" name="to" value="decided" />
          <button type="submit" disabled={startPending} className={btn}>
            {startPending ? "…" : "Erfassung abschließen → Entscheidung"}
          </button>
        </form>
      )}

      {model.canManage && round.status === "decided" && (
        <form action={startAction} className="mt-3 border-t pt-3">
          <input type="hidden" name="id" value={round.id} />
          <input type="hidden" name="to" value="closed" />
          <button type="submit" disabled={startPending} className={btn}>
            {startPending ? "…" : "Runde abschließen (Protokoll einfrieren)"}
          </button>
          <p className="mt-1 text-xs text-muted-foreground">
            Reserve wird berechnet und in die Folgerunde übertragen.
          </p>
        </form>
      )}
    </div>
  );
}

function GroupsEditor({ model }: { model: RoundSetupModel }) {
  const round = model.round!;
  const [addState, addAction, addPending] = useActionState(addGroupAction, {});

  return (
    <div className="rounded-lg border bg-card p-4">
      <h2 className="text-sm font-semibold">Gruppen ({model.groups.length})</h2>

      {model.cutWarnings.length > 0 && (
        <ul className="mt-2 space-y-1">
          {model.cutWarnings.map((w, i) => (
            <li key={i} className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              {w.message}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 space-y-3">
        {model.groups.map((g) => (
          <GroupCard key={g.id} group={g} />
        ))}
      </div>

      {model.canManage && (
        <form action={addAction} className="mt-3 flex items-end gap-2 border-t pt-3">
          <input type="hidden" name="roundId" value={round.id} />
          <label className="text-xs">
            Neue Gruppe
            <input name="name" required placeholder="z. B. Gruppe A" className={`block ${input}`} />
          </label>
          <button type="submit" disabled={addPending} className={btn}>
            {addPending ? "…" : "Gruppe hinzufügen"}
          </button>
          {addState.error && <span className="text-xs text-red-600">{addState.error}</span>}
        </form>
      )}
    </div>
  );
}

function GroupCard({ group }: { group: RoundSetupModel["groups"][number] }) {
  const [, renameAction] = useActionState(updateGroupAction, {});
  const [, delAction] = useActionState(removeGroupAction, {});
  const [memberState, addMemberAction, addMemberPending] = useActionState(addGroupMemberAction, {});
  const [, delMemberAction] = useActionState(removeGroupMemberAction, {});

  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <form action={renameAction} className="flex items-center gap-1">
          <input type="hidden" name="id" value={group.id} />
          <input name="name" defaultValue={group.name} className={`${input} w-40`} />
          <button type="submit" className={btnGhost}>umbenennen</button>
        </form>
        <form action={delAction}>
          <input type="hidden" name="id" value={group.id} />
          <button type="submit" className={`${btnGhost} text-red-600`}>Gruppe entfernen</button>
        </form>
      </div>

      <ul className="mt-2 space-y-1">
        {group.members.map((m) => (
          <li key={m.id} className="flex items-center justify-between gap-2 text-xs">
            <span>
              {m.userId.slice(0, 8)}… {m.team && <span className="text-muted-foreground">· {m.team}</span>}
              {m.isSubmitter && <span className="ml-1 rounded bg-sky-100 px-1 text-sky-700">Einreicher</span>}
              {m.hasRead && <span className="ml-1 text-emerald-600">✓ gelesen</span>}
            </span>
            <form action={delMemberAction}>
              <input type="hidden" name="id" value={m.id} />
              <button type="submit" className={`${btnGhost} text-red-600`}>×</button>
            </form>
          </li>
        ))}
        {group.members.length === 0 && <li className="text-xs text-muted-foreground">Noch keine Mitglieder.</li>}
      </ul>

      <form action={addMemberAction} className="mt-2 flex flex-wrap items-end gap-1.5">
        <input type="hidden" name="groupId" value={group.id} />
        <input name="userId" required placeholder="User-Id (uuid)" className={`${input} w-56`} />
        <input name="team" placeholder="Team" className={`${input} w-28`} />
        <label className="flex items-center gap-1 text-xs">
          <input type="checkbox" name="isSubmitter" className="accent-primary" /> Einreicher
        </label>
        <button type="submit" disabled={addMemberPending} className={btnGhost}>+ Mitglied</button>
        {memberState.error && <span className="text-xs text-red-600">{memberState.error}</span>}
      </form>
    </div>
  );
}

function GroupsReadonly({ model }: { model: RoundSetupModel }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <h2 className="text-sm font-semibold">Gruppen ({model.groups.length})</h2>
      <ul className="mt-2 space-y-1 text-sm">
        {model.groups.map((g) => (
          <li key={g.id}>
            <span className="font-medium">{g.name}</span>{" "}
            <span className="text-xs text-muted-foreground">· {g.members.length} Mitglieder</span>
          </li>
        ))}
      </ul>
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
