"use client";

import { useActionState } from "react";
import {
  linkGoalEpicAction,
  unlinkGoalEpicAction,
} from "@/features/transformation/actions/target-goal";

interface Props {
  epicId: string;
  goals: { id: string; title: string }[];
  linkedIds: string[];
}

/** Manage which strategic goals an Epic realises — toggle from the Epic detail. */
export function EpicGoalsLinker({ epicId, goals, linkedIds }: Props) {
  const [, link, linking] = useActionState(linkGoalEpicAction, {});
  const [, unlink, unlinking] = useActionState(unlinkGoalEpicAction, {});
  const busy = linking || unlinking;
  const linked = new Set(linkedIds);

  function toggle(goalId: string, on: boolean) {
    const fd = new FormData();
    fd.set("goalId", goalId);
    fd.set("epicId", epicId);
    (on ? link : unlink)(fd);
  }

  return (
    <section>
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">
        Realisiert strategische Ziele
      </p>
      {goals.length === 0 ? (
        <p className="text-xs text-muted-foreground">Noch keine Ziele definiert.</p>
      ) : (
        <ul className="space-y-1">
          {goals.map((g) => (
            <li key={g.id}>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={linked.has(g.id)}
                  disabled={busy}
                  onChange={(e) => toggle(g.id, e.target.checked)}
                />
                <span>{g.title}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
