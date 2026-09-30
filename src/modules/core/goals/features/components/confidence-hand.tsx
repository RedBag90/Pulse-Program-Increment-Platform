"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import {
  CONFIDENCE_KEYS,
  CONFIDENCE_MAX,
  needsReplan,
  type ConfidenceValue,
} from "@/modules/core/goals/domain/goal-confidence";
import { GOAL_STATUS_TIER_HEX, type GoalStatusTier } from "@/modules/core/goals/domain/goal-status";

/**
 * **Der Confidence Vote als Hand** — so viele Finger gestreckt wie der Wert.
 *
 * Eine Zahl „3 / 5" neben einem halb gefüllten Balken liest sich als „halb
 * fertig"; eine Hand mit drei Fingern liest sich als das, was sie ist: eine
 * Faust-zu-Fünf. Zeigefinger zuerst, bei 5 kommt der Daumen dazu. Eine
 * gefüllte, weiche Silhouette (runde Finger, runde Handfläche) — gewählt aus
 * einem Vergleich gegen Umriss-, Zahl- und Balken-Varianten.
 *
 * **Farbe nach dem Vote**, in den hellen Tönen des Status (dieselben wie die
 * Punkte der Status-Pill und die Status-Ringe, `GOAL_STATUS_TIER_HEX`): unter
 * 3 (`needsReplan`) rot, 3 gelb, 4–5 grün (`confidenceTone`). Die dunklen
 * Textfarben (`text-warning` & Co.) wirkten an einer gefüllten Hand braun und
 * schwer. Bewusst nicht
 * primär: das Blau war die Farbe der Kopfziel-Schiene und las sich wie deren
 * Zugehörigkeit. `tone="current"` übernimmt stattdessen die Textfarbe, etwa im
 * gefärbten Auswahlknopf.
 *
 * Ein eigenes `<svg>`: es steht in HTML ebenso wie in einem umgebenden SVG
 * (dort mit `x`/`y`).
 */

/**
 * Zeige-, Mittel-, Ring-, kleiner Finger: Mitte (x) und Spitze (y), wenn
 * gestreckt. Die Finger sind runde Striche, die in der Handfläche beginnen —
 * so wirkt die Hand weich statt wie aus Klötzen gebaut. Gebeugt endet der
 * Strich knapp über der Handfläche, als Knöchel.
 */
const FINGER = [
  { x: 8, spitze: 4.5 },
  { x: 11, spitze: 3 },
  { x: 14, spitze: 4.5 },
  { x: 17, spitze: 6.5 },
] as const;
/** Status-Stufe eines Votes — dieselben drei Stufen wie der Goal-Status. */
export function confidenceTone(value: ConfidenceValue): Exclude<GoalStatusTier, "neutral"> {
  if (needsReplan(value)) return "rose";
  return value === 3 ? "amber" : "green";
}

const FINGER_ANSATZ = 13;
const KNOECHEL = 10;
const STRICH = 2.8;

export function ConfidenceHand({
  value,
  size = 20,
  tone = "auto",
  x,
  y,
  className,
}: {
  value: ConfidenceValue;
  size?: number;
  tone?: "auto" | "current";
  x?: number;
  y?: number;
  className?: string;
}) {
  const t = useTranslations();
  const label = t("goals.confidenceHand.label", {
    value,
    max: CONFIDENCE_MAX,
    meaning: t(CONFIDENCE_KEYS[value]),
  });
  const daumen = value >= 5;
  return (
    <svg
      x={x}
      y={y}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      role="img"
      aria-label={label}
      data-confidence={value}
      data-tone={tone === "current" ? undefined : confidenceTone(value)}
      className={cn("shrink-0", className)}
      style={
        tone === "current" ? undefined : { color: GOAL_STATUS_TIER_HEX[confidenceTone(value)] }
      }
    >
      <title>{label}</title>
      <rect x="6" y="11" width="13.5" height="11" rx="5" />
      <g fill="none" stroke="currentColor" strokeWidth={STRICH} strokeLinecap="round">
        {FINGER.map((f, i) => {
          const oben = i < value;
          return (
            <path
              key={i}
              data-finger
              data-raised={oben || undefined}
              d={`M${f.x} ${FINGER_ANSATZ}V${oben ? f.spitze : KNOECHEL}`}
            />
          );
        })}
        {daumen ? (
          <path data-finger data-raised d="M7 16.5 4 11.5" />
        ) : (
          <path data-finger d="M7 16.5l2-1.2" />
        )}
      </g>
    </svg>
  );
}
