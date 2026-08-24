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
  setMemberReadAction,
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
  return (
    <div className="space-y-6">
      <BallotMirror model={model} />
      {!model.round ? (
        <CreateRound cycleKey={model.cycleKey} canManage={model.canManage} />
      ) : (
        <>
          <RoundFrame model={model} />
          {model.round.status === "draft" ? (
            <GroupsEditor model={model} />
          ) : (
            <GroupsReadonly model={model} />
          )}
        </>
      )}
    </div>
  );
}

/**
 * Ballot-Spiegelung (F-B1): die **tatsächlichen** vorgemerkten Epics mit Kosten,
 * plus die Pflichtvorhaben separat. Vormerken bleibt am Epic — die Runde spiegelt.
 */
function BallotMirror({ model }: { model: RoundSetupModel }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Ballot · {model.ballot.length} Epics</h2>
        <span className="text-xs text-muted-foreground">
          Pflichtvorhaben: {model.mandatoryCount} · {model.mandatorySum.toLocaleString("de-DE")} €
          (nicht auf dem Ballot, ziehen den Topf ab)
        </span>
      </div>
      {model.ballot.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Noch keine Epics vorgemerkt. Vorgemerkt wird am Epic (einreichungsbereit) — dann erscheinen
          sie hier auf dem Ballot.
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-border text-sm">
          {model.ballot.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-2 py-1.5">
              <span className="truncate">{e.title}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {e.cost.toLocaleString("de-DE")} €
              </span>
            </li>
          ))}
        </ul>
      )}
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
            Empfohlen: Topf &gt; 0 und ≥ 3 Gruppen (keine harte Voraussetzung — s. Warnungen).
            Verbindlichkeit: <strong>beratend</strong> — die Gruppenverteilung berät die
            Entscheidungsinstanz.
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
          <GroupCard key={g.id} group={g} users={model.users} />
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

function GroupCard({
  group,
  users,
}: {
  group: RoundSetupModel["groups"][number];
  users: RoundSetupModel["users"];
}) {
  const [, renameAction] = useActionState(updateGroupAction, {});
  const [, spokesAction] = useActionState(updateGroupAction, {});
  const [, delAction] = useActionState(removeGroupAction, {});
  const [memberState, addMemberAction, addMemberPending] = useActionState(addGroupMemberAction, {});
  const [, delMemberAction] = useActionState(removeGroupMemberAction, {});
  const [, readAction] = useActionState(setMemberReadAction, {});
  const emailOf = (id: string) => users.find((u) => u.id === id)?.label ?? id;
  const memberIds = new Set(group.members.map((m) => m.userId));

  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <form action={renameAction} className="flex items-center gap-1">
          <input type="hidden" name="id" value={group.id} />
          {/* Sprecher beim Umbenennen bewahren (die Action nullt fehlende Felder). */}
          <input type="hidden" name="spokespersonId" value={group.spokespersonId ?? ""} />
          <input name="name" defaultValue={group.name} className={`${input} w-40`} />
          <button type="submit" className={btnGhost}>umbenennen</button>
        </form>
        <form action={delAction}>
          <input type="hidden" name="id" value={group.id} />
          <button type="submit" className={`${btnGhost} text-red-600`}>Gruppe entfernen</button>
        </form>
      </div>

      {/* Sprecher-Picker (F-B2) — aus den Gruppenmitgliedern. */}
      <form action={spokesAction} className="mt-2 flex items-center gap-1.5">
        <input type="hidden" name="id" value={group.id} />
        <label className="text-xs text-muted-foreground">Sprecher</label>
        <select name="spokespersonId" defaultValue={group.spokespersonId ?? ""} className={`${input} w-56`}>
          <option value="">— kein Sprecher —</option>
          {group.members.map((m) => (
            <option key={m.id} value={m.userId}>
              {emailOf(m.userId)}
            </option>
          ))}
        </select>
        <button type="submit" className={btnGhost}>setzen</button>
      </form>

      <ul className="mt-2 space-y-1">
        {group.members.map((m) => (
          <li key={m.id} className="flex items-center justify-between gap-2 text-xs">
            <span>
              {emailOf(m.userId)} {m.team && <span className="text-muted-foreground">· {m.team}</span>}
              {group.spokespersonId === m.userId && (
                <span className="ml-1 rounded bg-violet-100 px-1 text-violet-700 dark:bg-violet-950 dark:text-violet-300">Sprecher</span>
              )}
              {m.isSubmitter && <span className="ml-1 rounded bg-sky-100 px-1 text-sky-700">Einreicher</span>}
            </span>
            <div className="flex items-center gap-1">
              {/* Pre-Read-Toggle (F-B2, C-05) — auch in running setzbar. */}
              <form action={readAction}>
                <input type="hidden" name="id" value={m.id} />
                {!m.hasRead && <input type="hidden" name="hasRead" value="1" />}
                <button
                  type="submit"
                  className={m.hasRead ? `${btnGhost} text-emerald-600` : btnGhost}
                >
                  {m.hasRead ? "✓ gelesen" : "als gelesen markieren"}
                </button>
              </form>
              <form action={delMemberAction}>
                <input type="hidden" name="id" value={m.id} />
                <button type="submit" className={`${btnGhost} text-red-600`}>×</button>
              </form>
            </div>
          </li>
        ))}
        {group.members.length === 0 && <li className="text-xs text-muted-foreground">Noch keine Mitglieder.</li>}
      </ul>

      <form action={addMemberAction} className="mt-2 flex flex-wrap items-end gap-1.5">
        <input type="hidden" name="groupId" value={group.id} />
        <select name="userId" required defaultValue="" className={`${input} w-56`}>
          <option value="" disabled>
            Person (E-Mail) wählen…
          </option>
          {users
            .filter((u) => !memberIds.has(u.id))
            .map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
        </select>
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
  const [, readAction] = useActionState(setMemberReadAction, {});
  const running = model.round?.status === "running";
  const emailOf = (id: string) => model.users.find((u) => u.id === id)?.label ?? id;
  const readyCount = model.groups.reduce(
    (s, g) => s + g.members.filter((m) => m.hasRead).length,
    0,
  );
  const memberCount = model.groups.reduce((s, g) => s + g.members.length, 0);

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Gruppen ({model.groups.length})</h2>
        <span className="text-xs text-muted-foreground">
          Pre-Read: {readyCount} / {memberCount} gelesen
        </span>
      </div>
      <div className="mt-3 space-y-3">
        {model.groups.map((g) => (
          <div key={g.id} className="rounded-md border bg-muted/20 p-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-medium">{g.name}</span>
              <span className="text-xs text-muted-foreground">
                {g.spokespersonId ? `Sprecher: ${emailOf(g.spokespersonId)}` : "kein Sprecher"}
              </span>
            </div>
            <ul className="mt-1.5 space-y-1">
              {g.members.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 text-xs">
                  <span>
                    {emailOf(m.userId)}
                    {g.spokespersonId === m.userId && (
                      <span className="ml-1 rounded bg-violet-100 px-1 text-violet-700 dark:bg-violet-950 dark:text-violet-300">Sprecher</span>
                    )}
                    {m.isSubmitter && <span className="ml-1 rounded bg-sky-100 px-1 text-sky-700">Einreicher</span>}
                  </span>
                  {running && model.canManage ? (
                    <form action={readAction}>
                      <input type="hidden" name="id" value={m.id} />
                      {!m.hasRead && <input type="hidden" name="hasRead" value="1" />}
                      <button type="submit" className={m.hasRead ? `${btnGhost} text-emerald-600` : btnGhost}>
                        {m.hasRead ? "✓ gelesen" : "als gelesen markieren"}
                      </button>
                    </form>
                  ) : (
                    m.hasRead && <span className="text-emerald-600">✓ gelesen</span>
                  )}
                </li>
              ))}
              {g.members.length === 0 && (
                <li className="text-xs text-muted-foreground">Keine Mitglieder.</li>
              )}
            </ul>
          </div>
        ))}
      </div>
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
