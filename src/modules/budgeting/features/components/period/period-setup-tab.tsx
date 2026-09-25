"use client";

import { useTranslations } from "next-intl";
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
import { updatePeriodTimeframeAction } from "@/modules/budgeting/features/actions/period";
import {
  addGroupAction,
  removeGroupAction,
  updateGroupAction,
  addGroupMemberAction,
  removeGroupMemberAction,
} from "@/modules/budgeting/features/actions/round";
import { checkGroupCut } from "@/modules/budgeting/domain/group-cut";
import { CandidateWorksheet } from "@/modules/budgeting/features/components/period/candidate-worksheet";
import type { PbListEntry } from "@/modules/budgeting/server/views/period-detail";

const input =
  "rounded-md border border-input bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
const btn =
  "rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50";
const btnGhost = "rounded-md border px-2 py-1 text-xs text-muted-foreground hover:text-foreground";
const EUR = (n: number) => `${n.toLocaleString("de-DE")} €`;
const day = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : "");

/**
 * Reiter „Setup" als **geordnete Liste**: Rahmen → PB-Liste → Beteiligte &
 * Gruppen → Runde starten.
 *
 * Vorher standen die vier Blöcke gleichrangig nebeneinander, jeder mit eigenem
 * Speichern-Knopf, und „Runde starten" steckte mitten im ersten — ohne Bezug zu
 * dem, was noch fehlte. Jetzt trägt jeder Schritt seinen Zustand, und der Start
 * steht am Ende und nennt seine Vorbedingung.
 */
export function PeriodSetupTab({ model }: { model: PeriodDetailModel }) {
  const t = useTranslations();
  const draft = model.round.status === "draft";
  const r = model.round;
  const staffedGroups = model.groups.filter((g) => g.members.length > 0).length;
  // **Ein Kandidat ist ein Epic ODER eine Run-the-Business-Position** — so
  // definiert es die Spezifikation, und so baut `PbList` die Liste auch.
  //
  // Bis September 2026 zaehlten Haken und Sperre nur die Epics. Das ging lange
  // gut, weil fast jede Kachel Epics traegt; bei einer Kachel mit „0 Epics ·
  // 1 RtB" stand dann aber „Die PB-Liste ist leer" ueber einer Liste mit
  // 147.500 € darin.
  //
  // Die RtB-Zeilen sind im Entwurf eine **Vorschau** (`rtbIsPreview`): sie
  // materialisieren erst beim Start. Genau sie zu zaehlen ist trotzdem richtig
  // — es ist das, was beim Start entsteht.
  const candidates = model.epicCandidates.length + model.rtbCandidates.length;

  return (
    <ol className="divide-y rounded-lg bg-card shadow-card">
      <Step
        n={1}
        title={t("budgeting.period.rahmen")}
        desc={t("budgeting.period.rahmenBeschreibung")}
        done={r.poolTotal > 0 && r.startDate != null && r.endDate != null}
        state={draft ? "offen" : "festgeschrieben"}
      >
        <Frame model={model} draft={draft} />
      </Step>

      <Step
        n={2}
        title={t("budgeting.period.pbListe")}
        desc="Was zur Abstimmung steht: vorgemerkte Epics plus die aktiven Run-the-Business-Positionen, die beim Start dazukommen."
        done={candidates > 0}
        state={
          model.rtbCandidates.length > 0
            ? `${model.epicCandidates.length} Epics · ${model.rtbCandidates.length} RtB`
            : `${model.epicCandidates.length} Epics`
        }
      >
        <PbList model={model} draft={draft} />
      </Step>

      <Step
        n={3}
        title={t("budgeting.period.beteiligteGruppen")}
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
        title={t("budgeting.period.rundeStarten")}
        desc="Friert die PB-Liste ein (inklusive der Run-the-Business-Positionen) und schaltet die Gruppen-Verteilung frei."
        done={!draft}
        state={draft ? "ausstehend" : "gestartet"}
      >
        <StartRound
          model={model}
          draft={draft}
          staffedGroups={staffedGroups}
          candidates={candidates}
        />
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
        className={`mt-0.5 grid size-6 place-items-center rounded-full text-meta font-bold ${
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

/**
 * **Zwei Formulare, und das ist die Aussage — nicht ein Notbehelf.**
 *
 * Der Abschnitt versprach „Topf, **Zeitraum** und Abgabe-Deadline dieser
 * Kachel", bot aber nur zwei Eingaben; der Zeitraum stand als Text daneben.
 * Dabei war alles da: `updateRoundFrame` schreibt `startDate`/`endDate` seit
 * jeher, und `updatePeriodTimeframeAction` existierte vollständig — ohne einen
 * einzigen Aufrufer im ganzen Baum.
 *
 * Angeschlossen ist jetzt genau diese Aktion, denn für die beiden Hälften
 * gelten **verschiedene Regeln**, und ein gemeinsamer Knopf würde sie unter
 * einer Beschriftung verstecken:
 *
 *  - Der **Topf** ist nur im Entwurf änderbar (`draft`).
 *  - Der **Zeitraum** folgt der Geltung (`timeframeEditDeniedReason`): in der
 *    Ausarbeitung alles, bei einer geltenden Kachel nur das Verlängern des
 *    Endes, bei einer abgelaufenen nichts. Er steht deshalb auch dann offen,
 *    wenn der Entwurf längst vorbei ist — der Dienst entscheidet und begründet.
 */
function Frame({ model, draft }: { model: PeriodDetailModel; draft: boolean }) {
  const t = useTranslations();
  const [potState, potAction, potPending] = useActionState(updatePeriodFrameAction, {});
  const [zeitState, zeitAction, zeitPending] = useActionState(updatePeriodTimeframeAction, {});
  const r = model.round;
  return (
    <div className="space-y-3">
      {/* Der Zeitraum stand hier als dritte Kachel. Er ist jetzt ein Feld —
          beides nebeneinander wäre dieselbe Angabe zweimal. */}
      <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
        <Stat label={t("budgeting.period.topf")} value={EUR(r.poolTotal)} />
        <Stat label={t("budgeting.period.verteilbar")} value={EUR(model.distributable)} />
      </dl>

      {draft && model.canManage && (
        <form action={potAction} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="id" value={r.id} />
          <label className="text-xs">
            {t("budgeting.period.topf2")}
            <input
              name="poolTotal"
              type="number"
              min={0}
              step={1000}
              defaultValue={r.poolTotal}
              className={`block ${input}`}
            />
          </label>
          <button type="submit" disabled={potPending} className={btn}>
            {potPending ? "…" : t("budgeting.period.topfSpeichern")}
          </button>
          {potState.error && <span className="text-xs text-destructive">{potState.error}</span>}
        </form>
      )}

      {model.canManage && (
        <form action={zeitAction} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="id" value={r.id} />
          <label className="text-xs">
            {t("budgeting.period.zeitraumVon")}
            <input
              name="periodStart"
              type="date"
              required
              defaultValue={day(r.startDate)}
              className={`block ${input}`}
            />
          </label>
          <label className="text-xs">
            {t("budgeting.period.zeitraumBis")}
            <input
              name="periodEnd"
              type="date"
              required
              defaultValue={day(r.endDate)}
              className={`block ${input}`}
            />
          </label>
          <label className="text-xs">
            {t("budgeting.period.abgabeDeadline")}
            <input
              name="submissionDeadline"
              type="date"
              defaultValue={day(r.submissionDeadline)}
              className={`block ${input}`}
            />
          </label>
          <button type="submit" disabled={zeitPending} className={btn}>
            {zeitPending ? "…" : t("budgeting.period.zeitraumSpeichern")}
          </button>
          {zeitState.error && <span className="text-xs text-destructive">{zeitState.error}</span>}
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
  candidates,
}: {
  model: PeriodDetailModel;
  draft: boolean;
  staffedGroups: number;
  /** Epics **und** Run-the-Business-Positionen — siehe `PeriodSetupTab`. */
  candidates: number;
}) {
  const t = useTranslations();
  const [state, action, pending] = useActionState(startPeriodAction, {});

  if (!draft) {
    return (
      <p className="text-xs text-muted-foreground">
        Die Runde läuft — die PB-Liste ist eingefroren. Der Fortgang steht im Reiter „Verteilung".
      </p>
    );
  }
  if (!model.canManage) {
    return (
      <p className="text-xs text-muted-foreground">{t("budgeting.period.startenDarfWerDie")}</p>
    );
  }

  const blocked =
    staffedGroups === 0
      ? "Erst möglich, wenn mindestens eine Gruppe ein Mitglied hat."
      : candidates === 0
        ? "Die PB-Liste ist leer — ohne Kandidaten gibt es nichts zu verteilen."
        : null;

  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="id" value={model.round.id} />
      <button type="submit" disabled={pending || blocked !== null} className={btn}>
        {pending ? "…" : "Runde starten"}
      </button>
      {blocked && <span className="text-xs text-warning dark:text-amber-300">{blocked}</span>}
      {state.error && <span className="text-xs text-destructive">{state.error}</span>}
    </form>
  );
}

function PbList({ model, draft }: { model: PeriodDetailModel; draft: boolean }) {
  const t = useTranslations();
  const [addState, addAction] = useActionState(addEpicCandidateAction, {});
  const [, removeAction] = useActionState(removeCandidateAction, {});
  const all = [...model.epicCandidates, ...model.rtbCandidates];

  return (
    <div>
      <CandidateWorksheet
        items={all}
        sortBy={(c: PbListEntry) => c.ask}
        columns={[
          { key: "ask", label: "Anfrage", value: (c: PbListEntry) => c.ask, width: "140px" },
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
              <button type="submit" className={`${btnGhost} text-destructive`}>
                {t("budgeting.period.entfernen")}
              </button>
            </form>
          ) : null
        }
        empty="Noch nichts auf der PB-Liste."
      />

      <p className="mt-2 flex flex-wrap items-baseline gap-x-3 text-meta text-muted-foreground">
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
            {t("budgeting.period.runTheBusinessPositionen")}
          </Link>
        )}
      </p>

      {draft && model.canManage && model.eligibleEpics.length > 0 && (
        <form action={addAction} className="mt-3 flex flex-wrap items-end gap-2 border-t pt-3">
          <input type="hidden" name="roundId" value={model.round.id} />
          <label className="text-xs">
            {t("budgeting.period.epicAufnehmen")}
            <select name="epicId" required defaultValue="" className={`block ${input} w-64`}>
              <option value="" disabled>
                {t("budgeting.period.budgetingReifesEpicWaehlen")}
              </option>
              {model.eligibleEpics.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title} · {EUR(e.cost)}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className={btnGhost}>
            {t("budgeting.period.aufDiePbListe")}
          </button>
          {addState.error && <span className="text-xs text-destructive">{addState.error}</span>}
          {model.artEpicsFilteredOut > 0 && (
            <p className="w-full text-xs text-muted-foreground">
              {model.artEpicsFilteredOut} vorgemerkte Epics stehen nicht zur Wahl: sie liegen unter
              dem Portfolio-Limit und werden vom jeweiligen ART aus dessen Rahmen finanziert.
            </p>
          )}
        </form>
      )}
    </div>
  );
}

function Participants({ model, draft }: { model: PeriodDetailModel; draft: boolean }) {
  const t = useTranslations();
  const [addState, addAction] = useActionState(addParticipantAction, {});
  const [, removeAction] = useActionState(removeParticipantAction, {});
  const participantIds = new Set(model.participants.map((p) => p.userId));

  return (
    <div>
      <h3 className="text-xs font-medium text-muted-foreground">
        {t("budgeting.period.beteiligte")}
      </h3>
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
                <button type="submit" className="text-destructive hover:text-destructive/80">
                  ×
                </button>
              </form>
            )}
          </li>
        ))}
        {model.participants.length === 0 && (
          <li className="text-xs text-muted-foreground">
            {t("budgeting.period.nochKeineBeteiligten")}
          </li>
        )}
      </ul>

      {draft && model.canManage && (
        <form action={addAction} className="mt-3 flex items-end gap-2 border-t pt-3">
          <input type="hidden" name="roundId" value={model.round.id} />
          <select name="userId" required defaultValue="" className={`${input} w-64`}>
            <option value="" disabled>
              {t("budgeting.period.personEMailHinzufuegen")}
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
            {t("budgeting.period.beteiligte2")}
          </button>
          {addState.error && <span className="text-xs text-destructive">{addState.error}</span>}
        </form>
      )}
    </div>
  );
}

function Groups({ model, draft }: { model: PeriodDetailModel; draft: boolean }) {
  const t = useTranslations();
  const [addState, addAction] = useActionState(addGroupAction, {});
  return (
    <div>
      <h3 className="text-xs font-medium text-muted-foreground">{t("budgeting.period.gruppen")}</h3>
      <div className="mt-1.5 space-y-3">
        {model.groups.map((g) => (
          <GroupCard key={g.id} group={g} model={model} draft={draft} />
        ))}
      </div>
      {draft && model.canManage && (
        <form action={addAction} className="mt-3 flex items-end gap-2 border-t pt-3">
          <input type="hidden" name="roundId" value={model.round.id} />
          <label className="text-xs">
            {t("budgeting.period.neueGruppe")}
            <input
              name="name"
              required
              placeholder={t("budgeting.period.zBGruppeA")}
              className={`block ${input}`}
            />
          </label>
          <button type="submit" className={btn}>
            {t("budgeting.period.gruppeHinzufuegen")}
          </button>
          {addState.error && <span className="text-xs text-destructive">{addState.error}</span>}
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
  const t = useTranslations();
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
        {t("budgeting.period.derGruppenSchnittIst")}
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
  const t = useTranslations();
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
              {t("budgeting.period.umbenennen")}
            </button>
          </form>
        ) : (
          <span className="text-sm font-medium">{group.name}</span>
        )}
        {draft && model.canManage && (
          <form action={delAction}>
            <input type="hidden" name="id" value={group.id} />
            <button type="submit" className={`${btnGhost} text-destructive`}>
              {t("budgeting.period.gruppeEntfernen")}
            </button>
          </form>
        )}
      </div>

      {draft && model.canManage && (
        <form action={spokesAction} className="mt-2 flex items-center gap-1.5">
          <input type="hidden" name="id" value={group.id} />
          <label className="text-xs text-muted-foreground">{t("budgeting.period.sprecher")}</label>
          <select
            name="spokespersonId"
            defaultValue={group.spokespersonId ?? ""}
            className={`${input} w-56`}
          >
            <option value="">{t("budgeting.period.keinSprecher")}</option>
            {group.members.map((m) => (
              <option key={m.id} value={m.userId}>
                {m.label}
              </option>
            ))}
          </select>
          <button type="submit" className={btnGhost}>
            {t("budgeting.period.setzen")}
          </button>
        </form>
      )}

      <ul className="mt-2 space-y-1">
        {group.members.map((m) => (
          <li key={m.id} className="flex items-center justify-between gap-2 text-xs">
            <span>
              {m.label}
              {group.spokespersonId === m.userId && (
                <span className="ml-1 rounded-sm bg-violet-100 px-1 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                  {t("budgeting.period.sprecher")}
                </span>
              )}
              {m.hasRead && (
                <span className="ml-1 text-success">{t("budgeting.period.gelesen")}</span>
              )}
            </span>
            {draft && model.canManage && (
              <form action={delMemberAction}>
                <input type="hidden" name="id" value={m.id} />
                <button type="submit" className={`${btnGhost} text-destructive`}>
                  ×
                </button>
              </form>
            )}
          </li>
        ))}
        {group.members.length === 0 && (
          <li className="text-xs text-muted-foreground">
            {t("budgeting.period.nochKeineMitglieder")}
          </li>
        )}
      </ul>

      {draft && model.canManage && (
        <form action={addMemberAction} className="mt-2 flex flex-wrap items-end gap-1.5">
          <input type="hidden" name="groupId" value={group.id} />
          <select name="userId" required defaultValue="" className={`${input} w-56`}>
            <option value="" disabled>
              {t("budgeting.period.beteiligteZuweisen")}
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
            {t("budgeting.period.mitglied")}
          </button>
          {memberState.error && (
            <span className="text-xs text-destructive">{memberState.error}</span>
          )}
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
