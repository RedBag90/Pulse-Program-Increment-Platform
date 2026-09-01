"use client";

import { useActionState } from "react";
import { Link } from "@/i18n/navigation";
import type {
  PeriodDetailModel,
  PeriodGroupView,
} from "@/modules/budgeting/server/views/period-detail";
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
import { checkGroupCut } from "@/modules/budgeting/domain/group-cut";
import { CandidateWorksheet } from "@/modules/budgeting/features/components/period/candidate-worksheet";
import type { BallotEntry } from "@/modules/budgeting/server/views/period-detail";

const input =
  "rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
const btn =
  "rounded bg-blue-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50";
const btnGhost = "rounded border px-2 py-1 text-xs text-muted-foreground hover:text-foreground";
const EUR = (n: number) => `${n.toLocaleString("de-DE")} €`;
const day = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : "");

/**
 * Reiter „Setup" als **geordnete Liste**: Rahmen → Ballot → Beteiligte &
 * Gruppen → Runde starten.
 *
 * Vorher standen die vier Blöcke gleichrangig nebeneinander, jeder mit eigenem
 * Speichern-Knopf, und „Runde starten" steckte mitten im ersten — ohne Bezug zu
 * dem, was noch fehlte. Jetzt trägt jeder Schritt seinen Zustand, und der Start
 * steht am Ende und nennt seine Vorbedingung.
 */
export function PeriodSetupTab({ model }: { model: PeriodDetailModel }) {
  const draft = model.round.status === "draft";
  const r = model.round;
  const staffedGroups = model.groups.filter((g) => g.members.length > 0).length;

  return (
    <ol className="divide-y rounded-lg border bg-card">
      <Step
        n={1}
        title="Rahmen"
        desc="Topf, Zeitraum und Abgabe-Deadline dieser Kachel."
        done={r.poolTotal > 0 && r.startDate != null && r.endDate != null}
        state={draft ? "offen" : "festgeschrieben"}
      >
        <Frame model={model} draft={draft} />
      </Step>

      <Step
        n={2}
        title="Ballot"
        desc="Was zur Abstimmung steht: vorgemerkte Epics plus die aktiven Run-the-Business-Positionen, die beim Start dazukommen."
        done={model.epicCandidates.length > 0}
        state={
          model.rtbCandidates.length > 0
            ? `${model.epicCandidates.length} Epics · ${model.rtbCandidates.length} RtB`
            : `${model.epicCandidates.length} Epics`
        }
      >
        <Ballot model={model} draft={draft} />
      </Step>

      <Step
        n={3}
        title="Beteiligte & Gruppen"
        desc="Wer verteilt, und in welcher Gruppe."
        done={staffedGroups > 0}
        state={`${model.participants.length} Beteiligte · ${model.groups.length} Gruppen`}
      >
        <div className="space-y-4">
          <Participants model={model} draft={draft} />
          <Groups model={model} draft={draft} />
          <GroupCutWarnings model={model} />
        </div>
      </Step>

      <Step
        n={4}
        title="Runde starten"
        desc="Friert den Ballot ein (inklusive der Run-the-Business-Positionen) und schaltet die Gruppen-Verteilung frei."
        done={!draft}
        state={draft ? "ausstehend" : "gestartet"}
      >
        <StartRound model={model} draft={draft} staffedGroups={staffedGroups} />
      </Step>
    </ol>
  );
}

/** Ein Schritt der Setup-Liste: Nummer, Zustand, Inhalt. */
function Step({
  n,
  title,
  desc,
  done,
  state,
  children,
}: {
  n: number;
  title: string;
  desc: string;
  done: boolean;
  state: string;
  children: React.ReactNode;
}) {
  return (
    <li className="grid grid-cols-[28px_1fr] gap-x-3 p-4">
      <span
        className={`mt-0.5 grid size-6 place-items-center rounded-full text-[11px] font-bold ${
          done
            ? "bg-emerald-500 text-white"
            : "border-[1.5px] border-dashed border-border text-muted-foreground"
        }`}
      >
        {done ? "✓" : n}
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold">{title}</h2>
          <span className="text-xs text-muted-foreground">{state}</span>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
        <div className="mt-3">{children}</div>
      </div>
    </li>
  );
}

function Frame({ model, draft }: { model: PeriodDetailModel; draft: boolean }) {
  const [state, action, pending] = useActionState(updatePeriodFrameAction, {});
  const r = model.round;
  return (
    <div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs md:grid-cols-3">
        <Stat label="Topf" value={EUR(r.poolTotal)} />
        <Stat label="Verteilbar" value={EUR(model.distributable)} />
        <Stat label="Zeitraum" value={`${day(r.startDate) || "—"} – ${day(r.endDate) || "—"}`} />
      </dl>
      {draft && model.canManage && (
        <form action={action} className="mt-3 flex flex-wrap items-end gap-2">
          <input type="hidden" name="id" value={r.id} />
          <label className="text-xs">
            Topf (€)
            <input
              name="poolTotal"
              type="number"
              min={0}
              step={1000}
              defaultValue={r.poolTotal}
              className={`block ${input}`}
            />
          </label>
          <label className="text-xs">
            Abgabe-Deadline
            <input
              name="submissionDeadline"
              type="date"
              defaultValue={day(r.submissionDeadline)}
              className={`block ${input}`}
            />
          </label>
          <button type="submit" disabled={pending} className={btn}>
            {pending ? "…" : "Rahmen speichern"}
          </button>
          {state.error && <span className="text-xs text-red-600">{state.error}</span>}
        </form>
      )}
    </div>
  );
}

/**
 * Der Start steht am Ende der Liste, nicht mehr mitten im Rahmen-Abschnitt, und
 * nennt seine Vorbedingung: ohne eine besetzte Gruppe kann niemand verteilen.
 */
function StartRound({
  model,
  draft,
  staffedGroups,
}: {
  model: PeriodDetailModel;
  draft: boolean;
  staffedGroups: number;
}) {
  const [state, action, pending] = useActionState(startPeriodAction, {});

  if (!draft) {
    return (
      <p className="text-xs text-muted-foreground">
        Die Runde läuft — der Ballot ist eingefroren. Der Fortgang steht im Reiter „Verteilung".
      </p>
    );
  }
  if (!model.canManage) {
    return <p className="text-xs text-muted-foreground">Starten darf, wer die Kachel verwaltet.</p>;
  }

  const blocked =
    staffedGroups === 0
      ? "Erst möglich, wenn mindestens eine Gruppe ein Mitglied hat."
      : model.epicCandidates.length === 0
        ? "Der Ballot ist leer — ohne Kandidaten gibt es nichts zu verteilen."
        : null;

  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="id" value={model.round.id} />
      <button type="submit" disabled={pending || blocked !== null} className={btn}>
        {pending ? "…" : "Runde starten"}
      </button>
      {blocked && <span className="text-xs text-amber-700 dark:text-amber-300">{blocked}</span>}
      {state.error && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  );
}

function Ballot({ model, draft }: { model: PeriodDetailModel; draft: boolean }) {
  const [addState, addAction] = useActionState(addEpicCandidateAction, {});
  const [, removeAction] = useActionState(removeCandidateAction, {});
  const all = [...model.epicCandidates, ...model.rtbCandidates];

  return (
    <div>
      <CandidateWorksheet
        items={all}
        sortBy={(c: BallotEntry) => c.ask}
        columns={[
          { key: "ask", label: "Anfrage", value: (c: BallotEntry) => c.ask, width: "140px" },
        ]}
        title={(c) => <span className="truncate">{c.title}</span>}
        // Im Entwurf sind die Run-Positionen noch keine Kandidaten und hier
        // nicht bearbeitbar — der Abschnitt startet eingeklappt, seine Summe
        // zählt aber in die Fußzeile, damit die Σ gegen den Topf stimmt.
        collapsedByDefault={(sec) => model.rtbIsPreview && sec.kind === "run"}
        action={(c) =>
          draft && model.canManage && c.kind === "epic" ? (
            <form action={removeAction}>
              <input type="hidden" name="id" value={c.id} />
              <button type="submit" className={`${btnGhost} text-red-600`}>
                entfernen
              </button>
            </form>
          ) : null
        }
        empty="Noch nichts auf dem Ballot."
      />

      <p className="mt-2 flex flex-wrap items-baseline gap-x-3 text-[11px] text-muted-foreground">
        <span>
          Σ Anfragen{" "}
          <span className="font-medium tabular-nums text-foreground">
            {EUR(all.reduce((s, c) => s + c.ask, 0))}
          </span>{" "}
          gegen einen Topf von{" "}
          <span className="font-medium tabular-nums text-foreground">
            {EUR(model.round.poolTotal)}
          </span>
        </span>
        {model.rtbIsPreview && model.rtbCandidates.length > 0 && (
          <Link href="/budgeting/run-the-business" className="text-primary hover:underline">
            Run-the-Business-Positionen pflegen →
          </Link>
        )}
      </p>

      {draft && model.canManage && model.eligibleEpics.length > 0 && (
        <form action={addAction} className="mt-3 flex flex-wrap items-end gap-2 border-t pt-3">
          <input type="hidden" name="roundId" value={model.round.id} />
          <label className="text-xs">
            Epic aufnehmen
            <select name="epicId" required defaultValue="" className={`block ${input} w-64`}>
              <option value="" disabled>
                Budgeting-reifes Epic wählen…
              </option>
              {model.eligibleEpics.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title} · {EUR(e.cost)}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className={btnGhost}>
            + auf den Ballot
          </button>
          {addState.error && <span className="text-xs text-red-600">{addState.error}</span>}
        </form>
      )}
    </div>
  );
}

function Participants({ model, draft }: { model: PeriodDetailModel; draft: boolean }) {
  const [addState, addAction] = useActionState(addParticipantAction, {});
  const [, removeAction] = useActionState(removeParticipantAction, {});
  const participantIds = new Set(model.participants.map((p) => p.userId));

  return (
    <div>
      <h3 className="text-xs font-medium text-muted-foreground">Beteiligte</h3>
      <ul className="mt-1.5 flex flex-wrap gap-1.5">
        {model.participants.map((p) => (
          <li
            key={p.id}
            className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs"
          >
            {p.label}
            {draft && model.canManage && (
              <form action={removeAction} className="inline">
                <input type="hidden" name="id" value={p.id} />
                <button type="submit" className="text-red-600 hover:text-red-700">
                  ×
                </button>
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
            <option value="" disabled>
              Person (E-Mail) hinzufügen…
            </option>
            {model.users
              .filter((u) => !participantIds.has(u.id))
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                </option>
              ))}
          </select>
          <button type="submit" className={btnGhost}>
            + Beteiligte
          </button>
          {addState.error && <span className="text-xs text-red-600">{addState.error}</span>}
        </form>
      )}
    </div>
  );
}

function Groups({ model, draft }: { model: PeriodDetailModel; draft: boolean }) {
  const [addState, addAction] = useActionState(addGroupAction, {});
  return (
    <div>
      <h3 className="text-xs font-medium text-muted-foreground">Gruppen</h3>
      <div className="mt-1.5 space-y-3">
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
          <button type="submit" className={btn}>
            Gruppe hinzufügen
          </button>
          {addState.error && <span className="text-xs text-red-600">{addState.error}</span>}
        </form>
      )}
    </div>
  );
}

/**
 * Schnitt-Warnungen (C-01..C-03): mindestens drei Gruppen, 4–6 Personen, ein
 * Sprecher je Gruppe, Einreicher gleichmäßig verteilt. Bewusst Warnungen und
 * keine harten Fehler — der Moderator entscheidet.
 *
 * Die Prüfung gab es längst; sie hing an der abgelösten Runden-Fläche und war
 * damit unsichtbar geworden. Sie steht jetzt dort, wo die Gruppen entstehen.
 */
function GroupCutWarnings({ model }: { model: PeriodDetailModel }) {
  if (model.groups.length === 0) return null;
  const warnings = checkGroupCut(
    model.groups.map((g) => ({ id: g.id, name: g.name, spokespersonId: g.spokespersonId })),
    model.groups.flatMap((g) =>
      g.members.map((m) => ({ groupId: g.id, userId: m.userId, isSubmitter: m.isSubmitter })),
    ),
  );
  if (warnings.length === 0) {
    return (
      <p className="text-xs text-emerald-700 dark:text-emerald-300">
        ✓ Der Gruppen-Schnitt ist ausgewogen.
      </p>
    );
  }
  return (
    <ul className="space-y-1 rounded-md border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
      {warnings.map((w, i) => (
        <li key={`${w.code}-${w.groupId ?? i}`}>{w.message}</li>
      ))}
    </ul>
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
            <button type="submit" className={btnGhost}>
              umbenennen
            </button>
          </form>
        ) : (
          <span className="text-sm font-medium">{group.name}</span>
        )}
        {draft && model.canManage && (
          <form action={delAction}>
            <input type="hidden" name="id" value={group.id} />
            <button type="submit" className={`${btnGhost} text-red-600`}>
              Gruppe entfernen
            </button>
          </form>
        )}
      </div>

      {draft && model.canManage && (
        <form action={spokesAction} className="mt-2 flex items-center gap-1.5">
          <input type="hidden" name="id" value={group.id} />
          <label className="text-xs text-muted-foreground">Sprecher</label>
          <select
            name="spokespersonId"
            defaultValue={group.spokespersonId ?? ""}
            className={`${input} w-56`}
          >
            <option value="">— kein Sprecher —</option>
            {group.members.map((m) => (
              <option key={m.id} value={m.userId}>
                {m.label}
              </option>
            ))}
          </select>
          <button type="submit" className={btnGhost}>
            setzen
          </button>
        </form>
      )}

      <ul className="mt-2 space-y-1">
        {group.members.map((m) => (
          <li key={m.id} className="flex items-center justify-between gap-2 text-xs">
            <span>
              {m.label}
              {group.spokespersonId === m.userId && (
                <span className="ml-1 rounded bg-violet-100 px-1 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                  Sprecher
                </span>
              )}
              {m.hasRead && <span className="ml-1 text-emerald-600">✓ gelesen</span>}
            </span>
            {draft && model.canManage && (
              <form action={delMemberAction}>
                <input type="hidden" name="id" value={m.id} />
                <button type="submit" className={`${btnGhost} text-red-600`}>
                  ×
                </button>
              </form>
            )}
          </li>
        ))}
        {group.members.length === 0 && (
          <li className="text-xs text-muted-foreground">Noch keine Mitglieder.</li>
        )}
      </ul>

      {draft && model.canManage && (
        <form action={addMemberAction} className="mt-2 flex flex-wrap items-end gap-1.5">
          <input type="hidden" name="groupId" value={group.id} />
          <select name="userId" required defaultValue="" className={`${input} w-56`}>
            <option value="" disabled>
              Beteiligte zuweisen…
            </option>
            {model.participants
              .filter((p) => !memberUserIds.has(p.userId))
              .map((p) => (
                <option key={p.id} value={p.userId}>
                  {labelOf(p.userId)}
                </option>
              ))}
          </select>
          <button type="submit" className={btnGhost}>
            + Mitglied
          </button>
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
