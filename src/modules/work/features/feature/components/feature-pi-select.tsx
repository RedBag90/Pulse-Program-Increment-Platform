"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { setFeaturePiAction } from "@/modules/work/features/feature/actions/feature";
import { setFeaturePi } from "@/modules/work/features/feature/lib/feature-actions-client";

interface Pi {
  id: string;
  name: string;
}

interface Props {
  featureId: string;
  artId: string;
  currentPiId: string | null;
  pis: Pi[];
  /**
   * `false`, solange das Epic noch kein Budget hat (unter L3).
   *
   * Dann steht die Zuordnung als Text da statt als Auswahl. Der Server lehnt
   * die Zuweisung ohnehin ab (`featurePlanningBlockedKey`) — ein Feld
   * anzubieten, das jedes Mal in eine Fehlermeldung läuft, ist schlechter als
   * keines. Anders als in der Planungsübersicht verschwindet die **Zeile**
   * hier nicht: der Breakdown-Reiter zeigt die Features seines Epics, auch die,
   * für die es noch keinen Termin geben darf.
   */
  canSchedule?: boolean;
}

/** Inline PI assignment dropdown for a feature row in the backlog list. */
export function FeaturePiSelect({ featureId, artId, currentPiId, pis, canSchedule = true }: Props) {
  const t = useTranslations();
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState(currentPiId ?? "");
  const [error, setError] = useState<string | null>(null);

  function handleChange(next: string) {
    setValue(next);
    setError(null);
    startTransition(async () => {
      const result = await setFeaturePi(setFeaturePiAction, {
        featureIds: [featureId],
        piId: next,
        artId,
      });
      if (result.error) {
        setError(result.error);
        setValue(currentPiId ?? "");
      }
    });
  }

  if (!canSchedule) {
    return (
      <span className="text-xs text-muted-foreground" title={t("work.errors.epicNotBudgetDecided")}>
        {pis.find((p) => p.id === currentPiId)?.name ?? t("work.feature.backlog")}
      </span>
    );
  }

  return (
    <div className="space-y-0.5">
      <select
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        disabled={isPending}
        className="rounded-md border px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
      >
        <option value="">{t("work.feature.backlog")}</option>
        {pis.map((pi) => (
          <option key={pi.id} value={pi.id}>
            {pi.name}
          </option>
        ))}
      </select>
      {error && <p className="text-label text-destructive">{error}</p>}
    </div>
  );
}
