"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DEPENDENCY_TYPE_KEYS } from "@/modules/drumbeat/domain/status";
import { useDependencyEdgeEditing } from "@/modules/drumbeat/features/dependencies/hooks/use-dependency-edge-editing";

/**
 * **Eine Abhängigkeit im Feature-Detail bearbeiten** — Typ wechseln und
 * entfernen, für ein- und ausgehende Kanten. Native Auswahl und ein Knopf mit
 * voller Höhe: auf Touch treffbar, was der alte Text-Knopf „lösen" nicht war.
 *
 * `artId` ist das ART der **Quelle** — daran hängt die Rechte-Prüfung, wie im
 * Netzplan (`useDependencyEdgeEditing`).
 */
export function DependencyRowControls({
  id,
  fromId,
  toId,
  type,
  artId,
  otherTitle,
}: {
  id: string;
  fromId: string;
  toId: string;
  type: "blocks" | "relates_to";
  artId: string;
  otherTitle: string;
}) {
  const t = useTranslations();
  const router = useRouter();
  const { error, callChangeType, callUnlink } = useDependencyEdgeEditing(artId, [
    { id, fromId, toId, type },
  ]);
  // Bis die Liste neu geladen ist, bleibt die Zeile gesperrt und sagt, dass
  // etwas läuft — sonst tippt man ein zweites Mal.
  const [laeuft, setLaeuft] = useState(false);
  const danach = (err: string | null) => {
    if (err) setLaeuft(false);
    else router.refresh();
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {error && <span className="text-label text-destructive">{error}</span>}
      <select
        aria-label={t("drumbeat.touchLink.typFuer", { titel: otherTitle })}
        value={type}
        disabled={laeuft}
        onChange={(e) => {
          setLaeuft(true);
          callChangeType(id, e.target.value as "blocks" | "relates_to", danach);
        }}
        className="h-8 rounded-md border border-input bg-background px-2 text-xs [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:text-sm"
      >
        {(["blocks", "relates_to"] as const).map((typ) => (
          <option key={typ} value={typ}>
            {t(DEPENDENCY_TYPE_KEYS[typ])}
          </option>
        ))}
      </select>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="text-destructive hover:text-destructive [@media(pointer:coarse)]:h-11"
        disabled={laeuft}
        onClick={() => {
          setLaeuft(true);
          callUnlink(id, danach);
        }}
      >
        {laeuft ? "…" : t("drumbeat.touchLink.entfernen")}
      </Button>
    </div>
  );
}
