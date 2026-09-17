"use client";

import { useActionState, startTransition, useState } from "react";
import { Save, Star, Trash2 } from "lucide-react";
import type { SavedFilterDTO, FilterCriteria } from "@/server/services/saved-filter";
import type { ActionState } from "@/server/http/server-action";

/** Was eine Server-Action hier mitbringen muss — die Hausform aus `createServerAction`. */
type FilterAction = (prev: ActionState, fd: FormData) => Promise<ActionState>;

/**
 * **Persönlich gespeicherte Filter — Auswahlliste, Chips, Speichern-Formular.**
 *
 * Bis hierher stand das als Inline-JSX in `portfolio-filter-bar.tsx`. Die
 * Ziele-Fläche braucht dasselbe, und eine zweite Abschrift wäre die dritte
 * gewesen, sobald eine weitere Fläche Filter speichern will. Beide Leisten
 * teilen sich schon heute `MultiSelectFilter` — das hier ist dasselbe Prinzip.
 *
 * Die Fläche behält, was ihr gehört: **welche** Facetten es gibt und wie sie in
 * die URL geschrieben werden (`onApply`). Der Baustein kennt nur Name, Nutzlast
 * und Standard-Häkchen.
 *
 * Zwei Eigenheiten sind mitgewandert und stehen hier bewusst benannt:
 *
 *  - **Löschen fragt nicht nach.** Ein Klick auf den Papierkorb ist endgültig.
 *  - **Das Formular schliesst optimistisch**, bevor der Server geantwortet hat;
 *    der Aktionszustand wird verworfen. Schlägt das Speichern fehl, sieht man
 *    nichts. Beides war vorher so und bleibt es — eine Änderung daran wäre ein
 *    eigener Zug an einer Fläche, die niemand gemeldet hat.
 */
export function SavedFilterControls({
  filters,
  criteria,
  anyActive,
  onApply,
  saveAction,
  deleteAction,
}: {
  filters: SavedFilterDTO[];
  /** Was gerade eingestellt ist — die Nutzlast des nächsten „Speichern". */
  criteria: FilterCriteria;
  /** Ohne aktive Facette gibt es nichts zu speichern. */
  anyActive: boolean;
  onApply: (criteria: FilterCriteria) => void;
  saveAction: FilterAction;
  deleteAction: FilterAction;
}) {
  const [saveOpen, setSaveOpen] = useState(false);
  const [, submitSave, savingBusy] = useActionState(saveAction, {});
  const [, submitDelete] = useActionState(deleteAction, {});

  function handleSave(formData: FormData) {
    formData.set("criteria", JSON.stringify(criteria));
    startTransition(() => submitSave(formData));
    setSaveOpen(false);
  }

  function handleDelete(id: string) {
    const fd = new FormData();
    fd.set("id", id);
    startTransition(() => submitDelete(fd));
  }

  return (
    <>
      <div className="ml-auto flex items-center gap-2">
        {filters.length > 0 && (
          <select
            aria-label="Gespeicherten Filter anwenden"
            defaultValue=""
            onChange={(e) => {
              const f = filters.find((x) => x.id === e.target.value);
              if (f) onApply(f.criteria);
              e.currentTarget.value = "";
            }}
            className="rounded-md border bg-background px-2 py-1.5 text-xs"
          >
            <option value="" disabled>
              Gespeicherte Filter…
            </option>
            {filters.map((f) => (
              <option key={f.id} value={f.id}>
                {f.isDefault ? "★ " : ""}
                {f.name}
              </option>
            ))}
          </select>
        )}

        {anyActive && !saveOpen && (
          <button
            type="button"
            onClick={() => setSaveOpen(true)}
            className="inline-flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs font-medium hover:bg-muted"
          >
            <Save className="size-3.5" /> Speichern
          </button>
        )}

        {saveOpen && (
          <form action={handleSave} className="flex items-center gap-1.5">
            <input
              name="name"
              required
              maxLength={80}
              placeholder="Filter-Name"
              autoFocus
              className="w-36 rounded-md border bg-background px-2 py-1.5 text-xs"
            />
            <label className="flex items-center gap-1 text-xs text-muted-foreground">
              <input type="checkbox" name="isDefault" value="true" /> Standard
            </label>
            <button
              type="submit"
              disabled={savingBusy}
              className="rounded-md bg-primary px-2 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              OK
            </button>
            <button
              type="button"
              onClick={() => setSaveOpen(false)}
              className="rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              Abbrechen
            </button>
          </form>
        )}
      </div>

      {filters.length > 0 && (
        <div className="flex w-full flex-wrap items-center gap-1.5">
          {filters.map((f) => (
            <span
              key={f.id}
              className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2 py-0.5 text-xs"
            >
              {f.isDefault && <Star className="size-3 fill-amber-400 text-amber-500" />}
              <button
                type="button"
                onClick={() => onApply(f.criteria)}
                className="hover:text-primary hover:underline"
              >
                {f.name}
              </button>
              <button
                type="button"
                aria-label={`Filter „${f.name}" löschen`}
                onClick={() => handleDelete(f.id)}
                className="text-muted-foreground hover:text-rose-500"
              >
                <Trash2 className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </>
  );
}
