"use client";

import { useState, useActionState } from "react";
import { updateEpicAction } from "@/modules/work/features/portfolio/actions/epic";
import { useEntityOptions, optionsEndpoint } from "@/features/create/use-entity-options";

interface ValueStreamOption {
  id: string;
  name: string;
}

interface ArtOption {
  id: string;
  name: string;
  valueStream?: { id: string } | null;
}

interface EpicEditFormProps {
  id: string;
  currentTitle: string;
  currentDescription: string;
  /** Aktuelle Zuordnung — Startwerte der Wertstrom-/ART-Selects. */
  currentValueStreamId: string;
  currentArtId: string;
}

const SELECT_CLASS =
  "w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50";

/**
 * Beschreibungs-Formular des Overview-Tabs: Titel, Description sowie die
 * Wertstrom-/ART-Zuordnung (kaskadiert wie im Create-Dialog — nur ARTs des
 * gewählten Wertstroms; der Service validiert das Paar final). Ein
 * Wertstrom-Wechsel löst eine nicht mehr passende Primär-Solution.
 */
export function EpicEditForm({
  id,
  currentTitle,
  currentDescription,
  currentValueStreamId,
  currentArtId,
}: EpicEditFormProps) {
  const [state, action, isPending] = useActionState(updateEpicAction, {});
  const valueStreams = useEntityOptions<ValueStreamOption>(optionsEndpoint("valueStream"), true);
  const arts = useEntityOptions<ArtOption>(optionsEndpoint("art"), true);

  const [vsId, setVsId] = useState(currentValueStreamId);
  const [artId, setArtId] = useState(currentArtId);
  const artOptions = arts.data.filter((a) => a.valueStream?.id === vsId);
  const vsChanged = vsId !== currentValueStreamId;

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={id} />

      <div>
        <label htmlFor="epic-title" className="block text-sm font-medium mb-1">
          Title
        </label>
        <input
          id="epic-title"
          name="title"
          defaultValue={currentTitle}
          required
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="epic-vs" className="block text-sm font-medium mb-1">
            Wertstrom
          </label>
          <select
            id="epic-vs"
            name="valueStreamId"
            required
            value={vsId}
            onChange={(e) => {
              setVsId(e.target.value);
              // ART gehört fest zum Wertstrom — bei Wechsel neu wählen.
              setArtId(e.target.value === currentValueStreamId ? currentArtId : "");
            }}
            disabled={valueStreams.loading}
            className={SELECT_CLASS}
          >
            {valueStreams.loading && <option value={vsId}>Lade…</option>}
            {valueStreams.data.map((vs) => (
              <option key={vs.id} value={vs.id}>
                {vs.name}
              </option>
            ))}
          </select>
          {valueStreams.error && <p className="text-red-600 text-xs mt-1">{valueStreams.error}</p>}
        </div>

        <div>
          <label htmlFor="epic-art" className="block text-sm font-medium mb-1">
            ART
          </label>
          <select
            id="epic-art"
            name="artId"
            required
            value={artId}
            onChange={(e) => setArtId(e.target.value)}
            disabled={arts.loading || !vsId}
            className={SELECT_CLASS}
          >
            <option value="">
              {arts.loading
                ? "Lade…"
                : artOptions.length === 0
                  ? "Keine ARTs in diesem Wertstrom"
                  : "ART wählen…"}
            </option>
            {artOptions.map((art) => (
              <option key={art.id} value={art.id}>
                {art.name}
              </option>
            ))}
          </select>
          {arts.error && <p className="text-red-600 text-xs mt-1">{arts.error}</p>}
        </div>
      </div>

      {vsChanged && (
        <p className="text-xs text-amber-700">
          Hinweis: Beim Wertstrom-Wechsel wird eine Primär-Solution, die nicht zum neuen Wertstrom
          gehört, vom Epic gelöst.
        </p>
      )}

      <div>
        <label htmlFor="epic-description" className="block text-sm font-medium mb-1">
          Description
        </label>
        <textarea
          id="epic-description"
          name="description"
          defaultValue={currentDescription}
          rows={5}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {state.error && (
        <p role="alert" className="text-red-600 text-sm">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="text-green-600 text-sm">
          Saved successfully.
        </p>
      )}

      <button
        type="submit"
        disabled={isPending || !artId}
        className="rounded bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
      >
        {isPending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
