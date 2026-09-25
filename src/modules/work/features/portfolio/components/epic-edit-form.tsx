"use client";

import { useTranslations } from "next-intl";
import { useState, useActionState, startTransition } from "react";
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
  /** Name des gespeicherten ARTs — die Vorauswahl, solange die Liste lädt. */
  currentArtName?: string | null;
}

const SELECT_CLASS =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50";

const TEXT_CLASS =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

/**
 * Beschreibungs-Formular des Overview-Tabs: Titel, Description sowie die
 * Wertstrom-/ART-Zuordnung (kaskadiert wie im Create-Dialog — nur ARTs des
 * gewählten Wertstroms; der Service validiert das Paar final). Ein
 * Wertstrom-Wechsel löst eine nicht mehr passende Primär-Solution.
 *
 * **Kein `<form action={…}>`, und das ist der Punkt.**
 *
 * React setzt nach Abschluss einer Action aus `useActionState` ein
 * **Form-Reset** ab. Titel und Beschreibung überstehen das, weil sie
 * `defaultValue` tragen — das Attribut steht im DOM und ist genau das, worauf
 * ein Reset zurücksetzt. Die beiden `<select>` sind dagegen **kontrolliert**:
 * ihr Wert steht als DOM-Eigenschaft, keine `<option>` trägt `selected`. Der
 * Reset sprang deshalb auf die erste Option — beim ART der Platzhalter „ART
 * wählen…" —, und weil sich der State dabei nicht änderte, rendert React nicht
 * neu und schreibt den Wert nicht zurück. Der ART war gespeichert und sah
 * gelöscht aus, bis irgendwann ein RSC-Refresh eintraf.
 *
 * Die FormData wird deshalb von Hand gebaut und in einer Transition
 * abgeschickt — dasselbe Muster wie in `epic-classification-form.tsx`.
 */
export function EpicEditForm({
  id,
  currentTitle,
  currentDescription,
  currentValueStreamId,
  currentArtId,
  currentArtName,
}: EpicEditFormProps) {
  const t = useTranslations();
  const [state, submit, isPending] = useActionState(updateEpicAction, {});
  const valueStreams = useEntityOptions<ValueStreamOption>(optionsEndpoint("valueStream"), true);
  const arts = useEntityOptions<ArtOption>(optionsEndpoint("art"), true);

  const [vsId, setVsId] = useState(currentValueStreamId);
  const [artId, setArtId] = useState(currentArtId);
  const [title, setTitle] = useState(currentTitle);
  const [description, setDescription] = useState(currentDescription);
  const artOptions = arts.data.filter((a) => a.valueStream?.id === vsId);
  const vsChanged = vsId !== currentValueStreamId;

  /**
   * **Die Vorauswahl muss den Ladezustand überstehen.**
   *
   * `useEntityOptions` setzt beim Mount `data: []` und füllt erst nach dem
   * Fetch. Solange enthält `artOptions` den gespeicherten ART nicht, und ein
   * kontrolliertes `<select>` ohne passende Option fällt auf den Platzhalter —
   * derselbe leere Eindruck wie beim Form-Reset, nur aus anderem Grund. Der
   * gespeicherte ART steht deshalb so lange als eigene Option da.
   */
  const zeigeUebergang =
    arts.loading &&
    artId !== "" &&
    !artOptions.some((a) => a.id === artId) &&
    artId === currentArtId;

  function speichern() {
    const fd = new FormData();
    fd.set("id", id);
    fd.set("title", title);
    fd.set("description", description);
    fd.set("valueStreamId", vsId);
    fd.set("artId", artId);
    startTransition(() => submit(fd));
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        speichern();
      }}
    >
      <div>
        <label htmlFor="epic-title" className="block text-sm font-medium mb-1">
          {t("work.epic.title")}
        </label>
        <input
          id="epic-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className={TEXT_CLASS}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="epic-vs" className="block text-sm font-medium mb-1">
            {t("work.epic.wertstrom")}
          </label>
          <select
            id="epic-vs"
            value={vsId}
            onChange={(e) => {
              setVsId(e.target.value);
              // ART gehört fest zum Wertstrom — bei Wechsel neu wählen.
              setArtId(e.target.value === currentValueStreamId ? currentArtId : "");
            }}
            disabled={valueStreams.loading}
            className={SELECT_CLASS}
          >
            {valueStreams.loading && <option value={vsId}>{t("work.epic.lade")}</option>}
            {valueStreams.data.map((vs) => (
              <option key={vs.id} value={vs.id}>
                {vs.name}
              </option>
            ))}
          </select>
          {valueStreams.error && (
            <p className="mt-1 text-xs text-destructive">{valueStreams.error}</p>
          )}
        </div>

        <div>
          <label htmlFor="epic-art" className="block text-sm font-medium mb-1">
            {t("work.common.art")}
          </label>
          <select
            id="epic-art"
            value={artId}
            onChange={(e) => setArtId(e.target.value)}
            disabled={arts.loading || !vsId}
            className={SELECT_CLASS}
          >
            <option value="">
              {arts.loading
                ? t("work.epic.lade")
                : artOptions.length === 0
                  ? t("work.epic.keineArtsImWertstrom")
                  : t("work.epic.artWaehlen")}
            </option>
            {zeigeUebergang && (
              <option value={artId}>{currentArtName ?? t("work.epic.lade")}</option>
            )}
            {artOptions.map((art) => (
              <option key={art.id} value={art.id}>
                {art.name}
              </option>
            ))}
          </select>
          {arts.error && <p className="mt-1 text-xs text-destructive">{arts.error}</p>}
        </div>
      </div>

      {vsChanged && (
        <p className="text-xs text-warning">{t("work.epic.hinweisBeimWertstromWechsel")}</p>
      )}

      <div>
        <label htmlFor="epic-description" className="block text-sm font-medium mb-1">
          {t("work.epic.description")}
        </label>
        <textarea
          id="epic-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={5}
          className={TEXT_CLASS}
        />
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="text-sm text-emerald-600 dark:text-emerald-400">
          {t("work.epic.savedSuccessfully")}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending || !artId}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {isPending ? t("common.ui.speichernLaeuft") : t("common.ui.aenderungenSpeichern")}
      </button>
    </form>
  );
}
