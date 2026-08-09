"use client";

import { useActionState, startTransition, useState } from "react";
import { addGoalCommentAction } from "@/features/ziele/actions/ziele";
import { goalStatusLabel } from "@/modules/core/goals/domain/goal-status";
import type { GoalActivityEntry, GoalTarget } from "@/server/views/ziele-view";

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
}

/**
 * Goal activity feed — merged audit events, check-ins and comments (newest
 * first) plus a comment box. Mirrors the Epic activity sidebar, goal-scoped.
 */
export function GoalActivityFeed({ target, id, activity, userLabels, canComment }: Props) {
  const [body, setBody] = useState("");
  const [state, run, pending] = useActionState(addGoalCommentAction, {});

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
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Aktivität
      </h3>

      {canComment && (
        <div className="space-y-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={2}
            placeholder="Frage stellen oder Kommentar hinterlassen…"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="flex items-center justify-between">
            {state.error && <span className="text-xs text-destructive">{state.error}</span>}
            <button
              type="button"
              onClick={post}
              disabled={pending || body.trim() === ""}
              className="ml-auto rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              Kommentieren
            </button>
          </div>
        </div>
      )}

      {activity.length === 0 ? (
        <p className="text-sm text-muted-foreground">Noch keine Aktivität.</p>
      ) : (
        <ul className="space-y-3">
          {activity.map((e) => {
            const who = e.by ? (userLabels[e.by] ?? e.by) : null;
            const detail =
              e.action === "goal.checkin" && e.detail
                ? goalStatusLabel(e.detail)
                : e.action === "goal.progress"
                  ? (e.detail ?? null)
                  : null;
            return (
              <li key={e.id} className="text-sm">
                <p className="leading-snug">
                  {who && <span className="font-medium text-foreground">{who}</span>}{" "}
                  <span className="text-muted-foreground">{actionLabel(e.action)}</span>
                  {detail && (
                    <span className="ml-1 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                      {detail}
                    </span>
                  )}
                  <span className="ml-1 text-xs text-muted-foreground">· {relTime(e.at)}</span>
                </p>
                {e.sections && e.sections.length > 0 ? (
                  <div className="mt-1 space-y-1 border-l-2 border-border pl-2">
                    {e.sections.map((s, i) => (
                      <div key={i} className="text-sm">
                        {s.title && <p className="font-medium text-foreground">{s.title}</p>}
                        {s.body && (
                          <p className="whitespace-pre-wrap text-foreground/80">{s.body}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  e.comment && (
                    <p className="mt-1 whitespace-pre-wrap border-l-2 border-border pl-2 text-sm text-foreground/80">
                      {e.comment}
                    </p>
                  )
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
