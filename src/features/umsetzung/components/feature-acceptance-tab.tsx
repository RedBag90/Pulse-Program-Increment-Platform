"use client";

import { useActionState, useState, useEffect } from "react";
import { CheckCircle2 } from "lucide-react";
import { updateFeatureAction } from "@/modules/core/org/features/art/actions/feature";

interface Props {
  featureId: string;
  artId: string | null;
  initialCriteria: string[];
  canEdit: boolean;
}

/**
 * Acceptance-Criteria-Editor als eigener Tab. Eine Zeile = ein
 * Kriterium (so wie auch der Create-Feature-Dialog speichert).
 * Verdrahtet gegen `updateFeatureAction`, die `acceptanceCriteria`
 * server-seitig auf Zeilen splittet.
 */
export function FeatureAcceptanceTab({ featureId, artId, initialCriteria, canEdit }: Props) {
  const [text, setText] = useState(() => initialCriteria.join("\n"));
  const [state, dispatch, pending] = useActionState(updateFeatureAction, {});

  useEffect(() => {
    if (state.success) {
      // Server-Revalidate hat die neuen Initialdaten geladen; nichts
      // weiter zu tun.
    }
  }, [state.success]);

  if (!artId) {
    return (
      <section className="rounded-lg border bg-card p-6">
        <p className="text-sm text-muted-foreground">
          Feature ohne ART-Zuordnung — Acceptance Criteria sind aktuell nicht editierbar.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border bg-card p-6">
      <h2 className="text-lg font-medium">Acceptance Criteria</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Eine Zeile = ein Kriterium. Leere Zeilen werden verworfen.
      </p>

      <form action={dispatch} className="mt-4 space-y-3">
        <input type="hidden" name="id" value={featureId} />
        <input type="hidden" name="artId" value={artId} />

        <textarea
          name="acceptanceCriteria"
          rows={Math.max(6, initialCriteria.length + 2)}
          disabled={!canEdit || pending}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            "z. B.\n- Nutzer:in kann das Feature unter dem Settings-Menü aktivieren\n- Bei aktivem Feature werden Erinnerungen automatisch verschickt"
          }
          className="w-full rounded-md border border-input bg-card px-3 py-2 font-mono text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        />

        {state.error && (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}
        {state.success && (
          <p role="status" className="inline-flex items-center gap-1.5 text-sm text-emerald-700">
            <CheckCircle2 className="size-4" /> Acceptance Criteria gespeichert.
          </p>
        )}

        {canEdit && (
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
            >
              {pending ? "Speichere…" : "Speichern"}
            </button>
          </div>
        )}
      </form>
    </section>
  );
}
