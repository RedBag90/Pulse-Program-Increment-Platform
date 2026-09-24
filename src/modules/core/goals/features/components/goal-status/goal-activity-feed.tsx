"use client";

import { useTranslations } from "next-intl";
import { useActionState, startTransition, useEffect, useRef, useState } from "react";
import { Pencil, Trash2, X } from "lucide-react";
import {
  addGoalCommentAction,
  updateGoalCheckinAction,
  deleteGoalCheckinAction,
  updateGoalCommentAction,
  deleteGoalCommentAction,
} from "@/modules/core/goals/features/actions/ziele";
import { goalStatusKey, type GoalStatus } from "@/modules/core/goals/domain/goal-status";
import { goalEntryPermissions } from "@/modules/core/goals/domain/goal-entry-access";
import type { GoalUpdateSection } from "@/modules/core/goals/domain/goal-activity";
import { GoalStatusSelect } from "@/modules/core/goals/features/components/goal-status/goal-status-select";
import type { GoalActivityEntry, GoalTarget } from "@/modules/core/goals/server/views/ziele-view";

const ACTION_LABELS: Record<string, string> = {
  "goal.checkin": "Status-Check-in",
  "goal.progress": "hat den Fortschritt aktualisiert",
  "goal.progress.updated": "hat den Fortschritt aktualisiert",
  "goal.comment": "kommentierte",
  "goal.comment.added": "kommentierte",
  "objective.created": "hat das Ziel angelegt",
  "objective.updated": "hat das Ziel aktualisiert",
  "key_result.created": "hat das Key Result angelegt",
  "key_result.updated": "hat das Key Result aktualisiert",
};

function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60_000);
  if (min < 1) return "gerade eben";
  if (min < 60) return `vor ${min} Min`;
  const hrs = Math.round(min / 60);
  if (hrs < 24) return `vor ${hrs} Std`;
  const day = Math.round(hrs / 24);
  return `vor ${day} Tag${day === 1 ? "" : "en"}`;
}

interface Props {
  target: GoalTarget;
  id: string;
  activity: GoalActivityEntry[];
  userLabels: Record<string, string>;
  canComment: boolean;
  /** Wer gerade liest — entscheidet, welche Einträge Affordances zeigen. */
  viewerId: string;
  /** Der Leser hält `target.manage` (darf fremde Einträge entfernen). */
  canManage: boolean;
  /** Nach einer Änderung neu laden (der Verlauf kommt aus einem Loader). */
  onChanged?: (() => void) | undefined;
}

/**
 * Goal activity feed — merged audit events, check-ins and comments (newest
 * first) plus a comment box. Mirrors the Epic activity sidebar, goal-scoped.
 *
 * **Bearbeiten und Löschen** hängen an der Regel in `goal-entry-access.ts`: der
 * Verfasser darf beides, die Ziel-Pflege nur entfernen. Audit-Zeilen sind
 * Protokoll und tragen keine Affordance.
 */
export function GoalActivityFeed({
  target,
  id,
  activity,
  userLabels,
  canComment,
  viewerId,
  canManage,
  onChanged,
}: Props) {
  const t = useTranslations();
  const [body, setBody] = useState("");
  const [state, run, pending] = useActionState(addGoalCommentAction, {});
  const [editing, setEditing] = useState<string | null>(null);

  function post() {
    const text = body.trim();
    if (!text) return;
    const fd = new FormData();
    fd.set("target", target);
    fd.set("id", id);
    fd.set("body", text);
    startTransition(() => run(fd));
    setBody("");
  }

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {t("goals.feed.title")}
      </h3>

      {canComment && (
        <div className="space-y-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={2}
            placeholder={t("goals.feed.placeholder")}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <div className="flex items-center justify-between">
            {state.error && <span className="text-xs text-destructive">{state.error}</span>}
            <button
              type="button"
              onClick={post}
              disabled={pending || body.trim() === ""}
              className="ml-auto rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              {t("goals.feed.comment")}
            </button>
          </div>
        </div>
      )}

      {activity.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("goals.feed.empty")}</p>
      ) : (
        <ul className="space-y-3">
          {activity.map((e) => (
            <ActivityRow
              key={e.id}
              entry={e}
              userLabels={userLabels}
              viewerId={viewerId}
              canManage={canManage}
              editing={editing === e.id}
              onEdit={() => setEditing(e.id)}
              onDone={() => {
                setEditing(null);
                onChanged?.();
              }}
              onCancel={() => setEditing(null)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function ActivityRow({
  entry,
  userLabels,
  viewerId,
  canManage,
  editing,
  onEdit,
  onDone,
  onCancel,
}: {
  entry: GoalActivityEntry;
  userLabels: Record<string, string>;
  viewerId: string;
  canManage: boolean;
  editing: boolean;
  onEdit: () => void;
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations();
  const who = entry.by ? (userLabels[entry.by] ?? entry.by) : null;
  const detail =
    entry.action === "goal.checkin" && entry.detail
      ? t(goalStatusKey(entry.detail))
      : entry.action === "goal.progress"
        ? (entry.detail ?? null)
        : null;
  // Audit-Zeilen sind Protokoll — sie gehören niemandem und ändert niemand.
  const perms =
    entry.kind === "audit" || !entry.by || !entry.entryId
      ? { mayEdit: false, mayDelete: false }
      : goalEntryPermissions({ authorId: entry.by, actorId: viewerId, mayManage: canManage });

  if (editing && entry.entryId) {
    return (
      <li className="rounded-md border bg-muted/30 p-2">
        <EntryEditor entry={entry} entryId={entry.entryId} onDone={onDone} onCancel={onCancel} />
      </li>
    );
  }

  return (
    <li className="group text-sm">
      <p className="flex flex-wrap items-center gap-x-1 leading-snug">
        {who && <span className="font-medium text-foreground">{who}</span>}
        <span className="text-muted-foreground">{actionLabel(entry.action)}</span>
        {detail && (
          <span className="rounded-sm bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            {detail}
          </span>
        )}
        <span className="text-xs text-muted-foreground">· {relTime(entry.at)}</span>
        {(perms.mayEdit || perms.mayDelete) && entry.entryId && (
          <EntryActions
            entry={entry}
            entryId={entry.entryId}
            mayEdit={perms.mayEdit}
            mayDelete={perms.mayDelete}
            onEdit={onEdit}
            onDeleted={onDone}
          />
        )}
      </p>
      {entry.sections && entry.sections.length > 0 ? (
        <div className="mt-1 space-y-1 border-l-2 border-border pl-2">
          {entry.sections.map((s, i) => (
            <div key={i} className="text-sm">
              {s.title && <p className="font-medium text-foreground">{s.title}</p>}
              {s.body && <p className="whitespace-pre-wrap text-foreground/80">{s.body}</p>}
            </div>
          ))}
        </div>
      ) : (
        entry.comment && (
          <p className="mt-1 whitespace-pre-wrap border-l-2 border-border pl-2 text-sm text-foreground/80">
            {entry.comment}
          </p>
        )
      )}
    </li>
  );
}

/**
 * Die beiden Schaltflächen erscheinen erst im Hover bzw. Tastatur-Fokus —
 * der Verlauf soll sich lesen lassen, nicht nach Werkzeugleiste aussehen.
 */
function EntryActions({
  entry,
  entryId,
  mayEdit,
  mayDelete,
  onEdit,
  onDeleted,
}: {
  entry: GoalActivityEntry;
  entryId: string;
  mayEdit: boolean;
  mayDelete: boolean;
  onEdit: () => void;
  onDeleted: () => void;
}) {
  const t = useTranslations();
  const isCheckin = entry.kind === "checkin";
  const deleteAction = isCheckin ? deleteGoalCheckinAction : deleteGoalCommentAction;
  const [state, run, pending] = useActionState(deleteAction, {});
  useSettled(state, onDeleted);

  function remove() {
    const was = isCheckin ? "Dieses Status-Update" : "Diesen Kommentar";
    if (
      !window.confirm(`${was} aus dem Verlauf entfernen? Das lässt sich nicht rückgängig machen.`)
    )
      return;
    const fd = new FormData();
    fd.set("id", entryId);
    startTransition(() => run(fd));
  }

  return (
    <span className="ml-auto inline-flex items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
      {state.error && <span className="mr-1 text-xs text-destructive">{state.error}</span>}
      {mayEdit && (
        <button
          type="button"
          onClick={onEdit}
          aria-label={t("goals.feed.editEntry")}
          className="rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Pencil className="size-3.5" />
        </button>
      )}
      {mayDelete && (
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          aria-label={t("goals.feed.removeEntry")}
          className="rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-destructive disabled:opacity-50 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Trash2 className="size-3.5" />
        </button>
      )}
    </span>
  );
}

/**
 * Bearbeiten an Ort und Stelle. **Das Datum bleibt, wie es war** — der Slot ist
 * nach Tag verschlüsselt, ein Umdatieren liefe auf einen womöglich belegten Tag.
 */
function EntryEditor({
  entry,
  entryId,
  onDone,
  onCancel,
}: {
  entry: GoalActivityEntry;
  entryId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations();
  const isCheckin = entry.kind === "checkin";
  const [status, setStatus] = useState<string | null>(
    entry.action === "goal.checkin" ? (entry.detail ?? null) : null,
  );
  const [sections, setSections] = useState<GoalUpdateSection[]>(
    entry.sections && entry.sections.length > 0
      ? entry.sections.map((s) => ({ ...s }))
      : [{ title: "", body: entry.comment ?? "" }],
  );
  const [commentBody, setCommentBody] = useState(entry.comment ?? "");
  const [state, run, pending] = useActionState(
    isCheckin ? updateGoalCheckinAction : updateGoalCommentAction,
    {},
  );
  useSettled(state, onDone);

  function patch(i: number, part: Partial<GoalUpdateSection>) {
    setSections((prev) => prev.map((s, j) => (j === i ? { ...s, ...part } : s)));
  }

  function save() {
    const fd = new FormData();
    fd.set("id", entryId);
    if (isCheckin) {
      if (status) fd.set("status", status);
      const clean = sections.filter((s) => s.title.trim() !== "" || s.body.trim() !== "");
      fd.set("sections", JSON.stringify(clean));
    } else {
      const text = commentBody.trim();
      if (!text) return;
      fd.set("body", text);
    }
    startTransition(() => run(fd));
  }

  return (
    <div className="space-y-2">
      {isCheckin ? (
        <>
          {status !== null && (
            <GoalStatusSelect
              value={status}
              onChange={(s: GoalStatus) => setStatus(s)}
              disabled={pending}
            />
          )}
          {sections.map((s, i) => (
            <div key={i} className="space-y-1">
              <div className="flex items-center gap-1">
                <input
                  value={s.title}
                  onChange={(e) => patch(i, { title: e.target.value })}
                  placeholder={t("goals.feed.heading")}
                  className="w-full rounded-md border bg-background px-2 py-1 text-sm font-medium focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                />
                {sections.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setSections((prev) => prev.filter((_, j) => j !== i))}
                    aria-label={t("goals.feed.removeBlock")}
                    className="rounded-sm p-1 text-muted-foreground hover:text-destructive"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
              <textarea
                value={s.body}
                onChange={(e) => patch(i, { body: e.target.value })}
                rows={3}
                placeholder={t("goals.feed.text")}
                className="w-full rounded-md border bg-background px-2 py-1 text-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() => setSections((prev) => [...prev, { title: "", body: "" }])}
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            {t("goals.feed.addBlock")}
          </button>
        </>
      ) : (
        <textarea
          value={commentBody}
          onChange={(e) => setCommentBody(e.target.value)}
          rows={3}
          className="w-full rounded-md border bg-background px-2 py-1 text-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      )}

      <div className="flex items-center gap-2">
        {state.error && <span className="text-xs text-destructive">{state.error}</span>}
        <button
          type="button"
          onClick={onCancel}
          className="ml-auto rounded-md border px-2.5 py-1 text-xs hover:bg-muted"
        >
          {t("goals.shared.cancel")}
        </button>
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
        >
          {t("goals.shared.save")}
        </button>
      </div>
    </div>
  );
}

/**
 * Meldet **nach** dem Ergebnis, nicht beim Absenden. `useActionState` liefert
 * bei jedem abgeschlossenen Aufruf ein neues Zustandsobjekt; der erste Durchlauf
 * ist der Anfangszustand und zählt nicht. Ein Fehler lässt den Eintrag offen,
 * damit der Text nicht verloren geht.
 */
function useSettled(state: { error?: string }, onOk: () => void) {
  const first = useRef(true);
  // Der Rückruf ist bei jedem Rendern neu; Auslöser ist allein die
  // Zustandsidentität. Über die Referenz bleibt trotzdem die frische Fassung
  // in der Hand, statt einer eingefrorenen aus dem ersten Rendern.
  const latest = useRef(onOk);
  latest.current = onOk;
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!state.error) latest.current();
  }, [state]);
}
