"use client";

import { useTranslations } from "next-intl";
import { createPortal } from "react-dom";
import type { LinkPreview } from "@/modules/drumbeat/features/dependencies/hooks/use-long-press-link";

/**
 * **Die Linie am Finger** während einer Touch-Verbindung
 * (`use-long-press-link.ts`): vom festen Punkt zum Finger, mit Pfeil in
 * Richtung der Abhängigkeit, dazu ein Schild, was beim Loslassen geschieht.
 * Liegt über allem und fängt keine Ereignisse.
 */
export function LinkPreviewOverlay({
  preview,
  labelOf,
}: {
  preview: LinkPreview | null;
  /** Titel eines Features für das Schild. */
  labelOf: (featureId: string) => string;
}) {
  const t = useTranslations();
  if (!preview || typeof document === "undefined") return null;
  const { gesture, anchor, finger, targetId } = preview;

  // Der Pfeil zeigt immer zum Ziel der Abhängigkeit: beim Versetzen der Quelle
  // vom Finger zum festen Ende.
  const zumFinger = gesture.kind === "create" || gesture.end === "to";
  const [a, b] = zumFinger ? [anchor, finger] : [finger, anchor];

  const schild =
    targetId == null
      ? t("drumbeat.touchLink.aufZiel")
      : gesture.kind === "create"
        ? t("drumbeat.touchLink.anlegen", { ziel: labelOf(targetId) })
        : t("drumbeat.touchLink.versetzen", { ziel: labelOf(targetId) });

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[60]" aria-live="polite">
      <svg className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <marker
            id="touch-link-arrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" className="fill-primary" />
          </marker>
        </defs>
        <line
          x1={a.x}
          y1={a.y}
          x2={b.x}
          y2={b.y}
          className="stroke-primary"
          strokeWidth={2.5}
          strokeDasharray="6 4"
          markerEnd="url(#touch-link-arrow)"
        />
        <circle cx={anchor.x} cy={anchor.y} r={5} className="fill-primary" />
      </svg>
      <div
        className="absolute max-w-64 -translate-x-1/2 truncate rounded-md bg-foreground px-2.5 py-1 text-sm text-background shadow-lg"
        style={{ left: finger.x, top: finger.y - 56 }}
      >
        {schild}
      </div>
    </div>,
    document.body,
  );
}
