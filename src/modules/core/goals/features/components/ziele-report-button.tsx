"use client";

import { useSearchParams } from "next/navigation";
import { FileText } from "lucide-react";
import { GOAL_FILTER_KEYS } from "@/modules/core/goals/domain/goal-filter";

/**
 * **Die Ziele-Übersicht als PDF.**
 *
 * Ein schlichter Anker, kein Blob-Tanz wie beim CSV-Export: die Route setzt
 * `Content-Disposition: attachment`, der Browser lädt von selbst. Damit bleibt
 * der Knopf auch das, was er ist — ein Link, den man kopieren, in einem neuen
 * Reiter öffnen oder als Lesezeichen behalten kann.
 *
 * **Er reicht die aktiven Filter weiter**, und das ist der Punkt: der Bericht
 * bildet denselben Ausschnitt ab wie der Bildschirm. Weitergereicht werden
 * genau die vier Facetten aus `GOAL_FILTER_KEYS` — Darstellungs-Parameter wie
 * `layout` oder `tab` haben auf Papier keine Bedeutung und blieben sonst als
 * Rauschen in der URL stehen.
 */
export function ZieleReportButton() {
  const sp = useSearchParams();

  const query = new URLSearchParams();
  for (const key of GOAL_FILTER_KEYS) {
    const value = sp.get(key);
    if (value) query.set(key, value);
  }
  const qs = query.toString();

  return (
    <a
      href={`/api/v1/goals/report${qs ? `?${qs}` : ""}`}
      // Der Download ersetzt die Seite nicht — ohne das bliebe der Nutzer bei
      // langsamer Erzeugung auf einer leeren Navigation sitzen.
      target="_blank"
      rel="noopener"
      className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted"
    >
      <FileText className="size-3.5" aria-hidden />
      Als PDF
    </a>
  );
}
