"use client";

import { useActionState, useState, startTransition } from "react";
import { Pencil, X } from "lucide-react";
import { updateTimelineAction } from "@/modules/core/org/features/structure/actions/timeline";
import type { ActionState } from "@/server/http/server-action";

interface Props {
  timelineId: string;
  name: string;
}

const initialState: ActionState = {};

/**
 * Inline-Edit-Form fuer den Timeline-Namen. Klick auf Pencil → Edit-Modus mit
 * Input + Save/Cancel. Bei Erfolg schliesst sich der Edit-Modus, bei Fehler
 * bleibt er offen und zeigt den Fehler.
 */
export function EditTimelineForm({ timelineId, name }: Props) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(updateTimelineAction, initialState);
  const [draftName, setDraftName] = useState(name);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraftName(name);
          setEditing(true);
        }}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        aria-label="Timeline bearbeiten"
      >
        <Pencil className="size-3.5" />
        Bearbeiten
      </button>
    );
  }

  const onSubmit = (fd: FormData) => {
    startTransition(() => action(fd));
  };

  return (
    <form
      action={onSubmit}
      onKeyDown={(e) => {
        if (e.key === "Escape") setEditing(false);
      }}
      className="space-y-2"
    >
      <input type="hidden" name="id" value={timelineId} />
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[200px] space-y-1">
          <label htmlFor="tl-name" className="text-xs text-muted-foreground">
            Name
          </label>
          <input
            id="tl-name"
            name="name"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            required
            maxLength={100}
            disabled={pending}
            className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          onClick={() => {
            // close edit-mode after the action resolves; if there's no error
            // by next tick, hide. Done via a timeout-trigger pattern.
            setTimeout(() => {
              if (!state?.error) setEditing(false);
            }, 0);
          }}
          className="h-7 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-50"
        >
          {pending ? "Speichere…" : "Speichern"}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          disabled={pending}
          className="inline-flex items-center gap-1 h-7 rounded-md px-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <X className="size-3.5" />
          Abbrechen
        </button>
        {state?.error && <span className="text-xs text-destructive">{state.error}</span>}
      </div>
    </form>
  );
}
