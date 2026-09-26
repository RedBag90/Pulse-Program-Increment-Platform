"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setArtPiCapacityAction } from "@/modules/drumbeat/features/cockpit/actions/pi";

/**
 * **Die Kapazitätszahl des ARTs in diesem PI.**
 *
 * Bis September 2026 stand hier das Job-Size-Ziel selbst als Eingabe — eine
 * Setzung ohne Herleitung. Jetzt wird die **Kapazität** eingetragen (Personen,
 * Personentage: die Einheit ist frei, sie muss nur über die PIs gleich
 * bleiben), und das Ziel errechnet sich daraus
 * (`drumbeat/domain/pi-job-size-target.ts`).
 *
 * Dezimalzahlen sind erlaubt (7,5 Personen). Leer = keine Kapazität: dann
 * gibt es für dieses PI kein Ziel, und es geht auch nicht in die Ziele der
 * folgenden PIs ein.
 */
export function PiCapacityField({
  piId,
  artId,
  value,
}: {
  piId: string;
  artId: string;
  value: number | null;
}) {
  const t = useTranslations();
  const [text, setText] = useState(value == null ? "" : String(value));
  const [pending, startTransition] = useTransition();

  function speichern() {
    // Das Komma ist in der deutschen Eingabe die Regel, nicht die Ausnahme.
    const getrimmt = text.trim().replace(",", ".");
    const neu = getrimmt === "" ? null : Number(getrimmt);
    if (neu === value) return;
    if (neu != null && (!Number.isFinite(neu) || neu < 0)) {
      toast.error(t("drumbeat.errors.kapazitaetNegativ"));
      setText(value == null ? "" : String(value));
      return;
    }
    const fd = new FormData();
    fd.set("piId", piId);
    fd.set("artId", artId);
    fd.set("capacity", neu == null ? "" : String(neu));
    startTransition(async () => {
      const res = await setArtPiCapacityAction({}, fd);
      if (res?.error) {
        toast.error(res.error);
        setText(value == null ? "" : String(value));
        return;
      }
      toast.success(t("drumbeat.ui.kapazitaetGespeichert"));
    });
  }

  return (
    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span>{t("drumbeat.ui.kapazitaetJs")}</span>
      <input
        type="text"
        inputMode="decimal"
        value={text}
        placeholder="—"
        disabled={pending}
        onChange={(e) => setText(e.target.value)}
        onBlur={speichern}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        aria-label={t("drumbeat.ui.kapazitaetErklaerung")}
        title={t("drumbeat.ui.kapazitaetErklaerung")}
        className="h-7 w-16 rounded-md border border-input bg-background px-2 text-right text-xs tabular-nums focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
      />
    </label>
  );
}
