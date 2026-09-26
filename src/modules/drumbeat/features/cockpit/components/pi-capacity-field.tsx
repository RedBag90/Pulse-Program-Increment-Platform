"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setPiCapacityAction } from "@/modules/drumbeat/features/cockpit/actions/pi";

/**
 * **Die Kapazität eines PI in Job Size — endlich eintragbar.**
 *
 * Die Server-Aktion dafür gab es seit jeher; sie hatte nur nie einen
 * Aufrufer. Was unter dem PI-Titel als „158 / 79 JS" stand, war Saat: die
 * Kapazität kam aus einer Index-Formel im Seed, die Last aus den Features —
 * zwei Zahlen ohne gemeinsamen Ursprung. Das Wiki behauptete eine Fläche, die
 * es nicht gab.
 *
 * Es gibt **keine** Ableitung. Kein Begriff im System — keine Velocity, keine
 * Teamgrösse — aus dem die Zahl folgen könnte. Sie ist eine Setzung, und
 * deshalb steht sie hier als Feld.
 *
 * Leer = keine Kapazität. Dann steht unter dem Titel nur die Last („18 JS"),
 * ohne Nenner und ohne Rot — eine Grenze zu behaupten, die niemand gesetzt
 * hat, wäre schlimmer als keine.
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
    const getrimmt = text.trim();
    const neu = getrimmt === "" ? null : Number(getrimmt);
    if (neu === value) return;
    if (neu != null && (!Number.isInteger(neu) || neu < 0)) {
      toast.error(t("drumbeat.errors.jobSizeNegative"));
      setText(value == null ? "" : String(value));
      return;
    }
    const fd = new FormData();
    fd.set("id", piId);
    fd.set("artId", artId);
    // Gesendet und leer = bewusst gelöscht; `capacityAmount` wird nicht
    // gesendet und bleibt damit, wie es ist.
    fd.set("capacityJobSize", neu == null ? "" : String(neu));
    startTransition(async () => {
      const res = await setPiCapacityAction({}, fd);
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
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        value={text}
        placeholder="—"
        disabled={pending}
        onChange={(e) => setText(e.target.value)}
        onBlur={speichern}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        aria-label={t("drumbeat.ui.kapazitaetJsErklaerung")}
        title={t("drumbeat.ui.kapazitaetJsErklaerung")}
        className="h-7 w-16 rounded-md border border-input bg-background px-2 text-right text-xs tabular-nums focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
      />
    </label>
  );
}
