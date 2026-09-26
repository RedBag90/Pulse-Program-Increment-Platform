"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { setArtJobSizeRateEstimateAction } from "@/modules/budgeting/features/actions/art-rate-estimate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * **Den €-Satz je Job Size schätzen** — wenn die Historie keinen hergibt.
 *
 * Ein Feld, zwei Wege: „Übernehmen" setzt die Schätzung, „Entfernen" nimmt sie
 * wieder weg (leeres Feld). Die Rechte prüft der Dienst; die Karte zeigt das
 * Formular nur, wenn die Seite `canEstimate` gereicht hat.
 */
export function RateEstimateForm({
  artId,
  current,
}: {
  artId: string;
  /** Die gespeicherte Schätzung; `null` = keine. */
  current: number | null;
}) {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState(setArtJobSizeRateEstimateAction, {});
  const [, removeAction, removing] = useActionState(setArtJobSizeRateEstimateAction, {});

  return (
    <div className="space-y-2 border-t px-3 py-2">
      <form action={formAction} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="artId" value={artId} />
        <label className="flex flex-col gap-1 text-meta text-muted-foreground">
          {t("budgeting.art.euroJeJobSizePunkt")}
          <Input
            name="estimate"
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            required
            defaultValue={current ?? ""}
            className="h-8 w-40"
          />
        </label>
        <Button type="submit" size="sm" disabled={pending}>
          {current == null
            ? t("budgeting.art.schaetzungUebernehmen")
            : t("budgeting.art.schaetzungAendern")}
        </Button>
      </form>
      {current != null && (
        <form action={removeAction}>
          <input type="hidden" name="artId" value={artId} />
          <input type="hidden" name="estimate" value="" />
          <Button type="submit" size="sm" variant="ghost" disabled={removing}>
            {t("budgeting.art.schaetzungEntfernen")}
          </Button>
        </form>
      )}
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
    </div>
  );
}
