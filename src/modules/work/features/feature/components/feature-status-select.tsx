"use client";

import { useState, useTransition } from "react";
import { setFeatureDeliveryStatusAction } from "@/modules/work/features/feature/actions/feature";
import { STATUS_LABELS } from "@/components/detail/initiative-labels";
import {
  DELIVERY_STATUSES,
  canDeliveryTransition,
} from "@/modules/core/kernel/domain/initiative-status";

/**
 * Der Lieferstatus eines Features — **eine** Bedienung für alle Flächen.
 *
 * Vorher gab es zwei: auf der Detailansicht eine Knopfleiste, die ausschließlich
 * die gerade erlaubten Übergänge zeigte, und im Deliverables-Reiter ein Dropdown
 * über alle fünf Zustände, das den Server ablehnen ließ. Vereinheitlicht wird auf
 * das Dropdown, weil es den *aktuellen* Zustand mitzeigt — die Knopfleiste verriet
 * ihn nur implizit über die angebotenen Übergänge.
 *
 * Die Stärke der Knopfleiste geht dabei nicht verloren: nicht erlaubte Zustände
 * werden **deaktiviert statt versteckt** (`canDeliveryTransition`). Man sieht also,
 * dass es sie gibt, und dass sie von hier aus nicht erreichbar sind — aus
 * `completed` und `cancelled` führt gar keine Kante mehr heraus.
 *
 * Beschriftet wird aus `STATUS_LABELS`, derselben Quelle wie die Statuspille und
 * die Filterchips der Features-Übersicht. Der Reiter führte dafür bis eben eine
 * dritte Schreibweise („Bereit", „Fertig") — die ist damit weg.
 */

interface Props {
  featureId: string;
  status: string;
  /** Für das Vorlesefeld: der Titel des Features, damit Zeilen unterscheidbar bleiben. */
  label: string;
  /** Kompakt für Tabellenzellen, normal für die Detailansicht. */
  size?: "sm" | "md";
  disabled?: boolean;
}

const SIZE: Record<"sm" | "md", string> = {
  sm: "px-1.5 py-0.5 text-xs",
  md: "px-2.5 py-1.5 text-sm",
};

function isDeliveryStatus(s: string): boolean {
  return (DELIVERY_STATUSES as readonly string[]).includes(s);
}

export function FeatureStatusSelect({ featureId, status, label, size = "sm", disabled }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function change(to: string) {
    setError(null);
    const fd = new FormData();
    fd.set("id", featureId);
    fd.set("to", to);
    startTransition(async () => {
      const res = await setFeatureDeliveryStatusAction({}, fd);
      if (res.error) setError(res.error);
    });
  }

  // `draft` und `in_review` gehoeren zur Qualitaetssicherung, nicht zur
  // Liefer-FSM. Ein `<select>` ohne passende Option zeigt stumm den ersten
  // Eintrag — hier stuende dann „Freigegeben", obwohl das Feature Entwurf ist.
  if (!isDeliveryStatus(status)) {
    return <span className="text-sm text-muted-foreground">{STATUS_LABELS[status] ?? status}</span>;
  }

  return (
    <select
      aria-label={`Status für ${label}`}
      value={status}
      disabled={disabled || pending}
      onChange={(e) => change(e.target.value)}
      title={error ?? undefined}
      className={`rounded border bg-background disabled:opacity-50 ${SIZE[size]} ${
        error ? "border-destructive" : "border-input"
      }`}
    >
      {DELIVERY_STATUSES.map((s) => (
        <option
          key={s}
          value={s}
          // Der aktuelle Zustand bleibt wählbar, sonst zeigte das Feld ihn nicht an.
          disabled={s !== status && !canDeliveryTransition(status, s)}
        >
          {STATUS_LABELS[s] ?? s}
        </option>
      ))}
    </select>
  );
}
