"use client";

import { useActionState } from "react";
import type { PeriodDetailModel, PeriodGroupView } from "@/modules/budgeting/server/views/period-detail";
import {
  addParticipantAction,
  removeParticipantAction,
  addEpicCandidateAction,
  removeCandidateAction,
  updatePeriodFrameAction,
  startPeriodAction,
} from "@/modules/budgeting/features/actions/period-setup";
import {
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
const EUR = (n: number) => `${n.toLocaleString("de-DE")} €`;
const day = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : "");

export function PeriodSetupTab({ model }: { model: PeriodDetailModel }) {
  const draft = model.round.status === "draft";
  return (
    <div className="space-y-6">
      <Frame model={model} draft={draft} />
      <Ballot model={model} draft={draft} />
      <Participants model={model} draft={draft} />
      <Groups model={model} draft={draft} />
    </div>
  );
}

function Frame({ model, draft }: { model: PeriodDetailModel; draft: boolean }) {
  const [state, action, pending] = useActionState(updatePeriodFrameAction, {});
  const [startState, startAction, startPending] = useActionState(startPeriodAction, {});
  const r = model.round;
  return (
    <section className="rounded-lg border bg-card p-4">
      <h2 className="text-sm font-semibold">Rahmen</h2>
      <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-xs md:grid-cols-4">
        <Stat label="Topf" value={EUR(r.poolTotal)} />
        <Stat label="Pflichtvorhaben" value={`${model.mandatoryCount} · ${EUR(model.mandatorySum)}`} />
        <Stat label="Verteilbar" value={EUR(model.distributable)} />
        <Stat label="Zeitraum" value={`${day(r.startDate) || "—"} – ${day(r.endDate) || "—"}`} />
      </dl>
      {draft && model.canManage && (
        <form action={action} className="mt-3 flex flex-wrap items-end gap-2">
          <input type="hidden" name="id" value={r.id} />
          <label className="text-xs">
            Topf (€)
            <input name="poolTotal" type="number" min={0} step={1000} defaultValue={r.poolTotal} className={`block ${input}`} />
          </label>
          <label className="text-xs">
            Abgabe-Deadline
            <input name="submissionDeadline" type="date" defaultValue={day(r.submissionDeadline)} className={`block ${input}`} />
          </label>
          <button type="submit" disabled={pending} className={btn}>
            {pending ? "…" : "Rahmen speichern"}
          </button>
          {state.error && <span className="text-xs text-red-600">{state.error}</span>}
        </form>
      )}

      {draft && model.canManage && (
        <form action={startAction} className="mt-3 border-t pt-3">
          <input type="hidden" name="id" value={r.id} />
          <button type="submit" disabled={startPending} className={btn}>
            {startPending ? "…" : "Runde starten (Entwurf → läuft)"}
          </button>
          <p className="mt-1 text-xs text-muted-foreground">
            Friert den Ballot ein (inkl. Run-the-Business-Positionen) und schaltet die Gruppen-Verteilung frei.
          </p>
          {startState.error && <span className="mt-1 block text-xs text-red-600">{startState.error}</span>}
        </form>
      )}
    </section>
  );
}

function Ballot({ model, draft }: { model: PeriodDetailModel; draft: boolean }) {
  const [addState, addAction] = useActionState(addEpicCandidateAction, {});
  const [, removeAction] = useActionState(removeCandidateAction, {});
  return (
    <section className="rounded-lg border bg-card p-4">
      <h2 className="text-sm font-semibold">Ballot · {model.epicCandidates.length} Epics</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Wähle die Epics dieser Kachel aus dem budgeting-reifen Pool. Run-the-Business-Positionen kommen beim Start automatisch dazu.
      </p>

      <ul className="mt-2 divide-y divide-border text-sm">
        {model.epicCandidates.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-2 py-1.5">
            <span className="truncate">{c.title}</span>
            <span className="flex items-center gap-2">
              <span className="shrink-0 tabular-nums text-muted-foreground">{EUR(c.ask)}</span>
              {draft && model.canManage && (
                <form action={removeAction}>
                  <input type="hidden" name="id" value={c.id} />
                  <button type="submit" className={`${btnGhost} text-red-600`}>entfernen</button>
                </form>
              )}
            </span>
          </li>
        ))}
        {model.epicCandidates.length === 0 && (
          <li className="py-1.5 text-xs text-muted-foreground">Noch keine Epics auf dem Ballot.</li>
        )}
      </ul>

      {draft && model.canManage && model.eligibleEpics.length > 0 && (
        <form action={addAction} className="mt-3 flex flex-wrap items-end gap-2 border-t pt-3">
          <input type="hidden" name="roundId" value={model.round.id} />
          <label className="text-xs">
            Epic aufnehmen
            <select name="epicId" required defaultValue="" className={`block ${input} w-64`}>
              <option value="" disabled>Budgeting-reifes Epic wählen…</option>
              {model.eligibleEpics.map((e) => (
                <option key={e.id} value={e.id}>{e.title} · {EUR(e.cost)}</option>
              ))}
            </select>
          </label>
          <button type="submit" className={btnGhost}>+ auf den Ballot</button>
          {addState.error && <span className="text-xs text-red-600">{addState.error}</span>}
        </form>
      )}
    </section>
  );
}

function Participants({ model, draft }: { model: PeriodDetailModel; draft: boolean }) {
  const [addState, addAction] = useActionState(addParticipantAction, {});
  const [, removeAction] = useActionState(removeParticipantAction, {});
  const participantIds = new Set(model.participants.map((p) => p.userId));

  return (
    <section className="rounded-lg border bg-card p-4">
      <h2 className="text-sm font-semibold">Beteiligte ({model.participants.length})</h2>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {model.participants.map((p) => (
          <li key={p.id} className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs">
            {p.label}
            {draft && model.canManage && (
              <form action={removeAction} className="inline">
                <input type="hidden" name="id" value={p.id} />
                <button type="submit" className="text-red-600 hover:text-red-700">×</button>
              </form>
            )}
          </li>
        ))}
        {model.participants.length === 0 && (
          <li className="text-xs text-muted-foreground">Noch keine Beteiligten.</li>
        )}
      </ul>

      {draft && model.canManage && (
        <form action={addAction} className="mt-3 flex items-end gap-2 border-t pt-3">
          <input type="hidden" name="roundId" value={model.round.id} />
          <select name="userId" required defaultValue="" className={`${input} w-64`}>
            <option value="" disabled>Person (E-Mail) hinzufügen…</option>
            {model.users
              .filter((u) => !participantIds.has(u.id))
              .map((u) => (
                <option key={u.id} value={u.id}>{u.label}</option>
              ))}
          </select>
          <button type="submit" className={btnGhost}>+ Beteiligte</button>
          {addState.error && <span className="text-xs text-red-600">{addState.error}</span>}
        </form>
      )}
    </section>
  );
}

function Groups({ model, draft }: { model: PeriodDetailModel; draft: boolean }) {
  const [addState, addAction] = useActionState(addGroupAction, {});
  return (
    <section className="rounded-lg border bg-card p-4">
      <h2 className="text-sm font-semibold">Gruppen ({model.groups.length})</h2>
      <div className="mt-3 space-y-3">
        {model.groups.map((g) => (
          <GroupCard key={g.id} group={g} model={model} draft={draft} />
        ))}
      </div>
      {draft && model.canManage && (
        <form action={addAction} className="mt-3 flex items-end gap-2 border-t pt-3">
          <input type="hidden" name="roundId" value={model.round.id} />
          <label className="text-xs">
            Neue Gruppe
            <input name="name" required placeholder="z. B. Gruppe A" className={`block ${input}`} />
          </label>
          <button type="submit" className={btn}>Gruppe hinzufügen</button>
          {addState.error && <span className="text-xs text-red-600">{addState.error}</span>}
        </form>
      )}
    </section>
  );
}

function GroupCard({
  group,
  model,
  draft,
}: {
  group: PeriodGroupView;
  model: PeriodDetailModel;
  draft: boolean;
}) {
  const [, renameAction] = useActionState(updateGroupAction, {});
  const [, spokesAction] = useActionState(updateGroupAction, {});
  const [, delAction] = useActionState(removeGroupAction, {});
  const [memberState, addMemberAction] = useActionState(addGroupMemberAction, {});
  const [, delMemberAction] = useActionState(removeGroupMemberAction, {});
  const memberUserIds = new Set(group.members.map((m) => m.userId));
  const labelOf = (userId: string) => model.users.find((u) => u.id === userId)?.label ?? userId;

  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-2">
        {draft && model.canManage ? (
          <form action={renameAction} className="flex items-center gap-1">
            <input type="hidden" name="id" value={group.id} />
            <input type="hidden" name="spokespersonId" value={group.spokespersonId ?? ""} />
            <input name="name" defaultValue={group.name} className={`${input} w-40`} />
            <button type="submit" className={btnGhost}>umbenennen</button>
          </form>
        ) : (
          <span className="text-sm font-medium">{group.name}</span>
        )}
        {draft && model.canManage && (
          <form action={delAction}>
            <input type="hidden" name="id" value={group.id} />
            <button type="submit" className={`${btnGhost} text-red-600`}>Gruppe entfernen</button>
          </form>
        )}
      </div>

      {draft && model.canManage && (
        <form action={spokesAction} className="mt-2 flex items-center gap-1.5">
          <input type="hidden" name="id" value={group.id} />
          <label className="text-xs text-muted-foreground">Sprecher</label>
          <select name="spokespersonId" defaultValue={group.spokespersonId ?? ""} className={`${input} w-56`}>
            <option value="">— kein Sprecher —</option>
            {group.members.map((m) => (
              <option key={m.id} value={m.userId}>{m.label}</option>
            ))}
          </select>
          <button type="submit" className={btnGhost}>setzen</button>
        </form>
      )}

      <ul className="mt-2 space-y-1">
        {group.members.map((m) => (
          <li key={m.id} className="flex items-center justify-between gap-2 text-xs">
            <span>
              {m.label}
              {group.spokespersonId === m.userId && (
                <span className="ml-1 rounded bg-violet-100 px-1 text-violet-700 dark:bg-violet-950 dark:text-violet-300">Sprecher</span>
              )}
              {m.hasRead && <span className="ml-1 text-emerald-600">✓ gelesen</span>}
            </span>
            {draft && model.canManage && (
              <form action={delMemberAction}>
                <input type="hidden" name="id" value={m.id} />
                <button type="submit" className={`${btnGhost} text-red-600`}>×</button>
              </form>
            )}
          </li>
        ))}
        {group.members.length === 0 && <li className="text-xs text-muted-foreground">Noch keine Mitglieder.</li>}
      </ul>

      {draft && model.canManage && (
        <form action={addMemberAction} className="mt-2 flex flex-wrap items-end gap-1.5">
          <input type="hidden" name="groupId" value={group.id} />
          <select name="userId" required defaultValue="" className={`${input} w-56`}>
            <option value="" disabled>Beteiligte zuweisen…</option>
            {model.participants
              .filter((p) => !memberUserIds.has(p.userId))
              .map((p) => (
                <option key={p.id} value={p.userId}>{labelOf(p.userId)}</option>
              ))}
          </select>
          <button type="submit" className={btnGhost}>+ Mitglied</button>
          {memberState.error && <span className="text-xs text-red-600">{memberState.error}</span>}
        </form>
      )}
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
