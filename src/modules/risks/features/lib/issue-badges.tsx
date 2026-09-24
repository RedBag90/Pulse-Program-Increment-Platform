/**
 * Die Badges der Issue-Achsen — **Farbe mit Wort**, nie Farbe allein
 * (ADR-0021 §1).
 *
 * **Die Farbtabellen liegen nicht mehr hier.** Bis September 2026 standen vier
 * parallele Exposure-Maps in dieser Datei (`CLASS` · `DOT` · `HEX` · `CELL`) mit
 * unterschiedlichen Stufen, eine davon ohne Aufrufer — und ausserhalb des
 * Moduls zwei Nachbauten mit anderer Skala, weil ADR-0013 `work` den Import
 * verbietet. Die Skala samt Palette steht jetzt im Kernel
 * (`core/kernel/domain/exposure.ts`), dort, wo ROAM längst steht; hier bleiben
 * die Bausteine, die sie anziehen.
 */

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  EXPOSURE_KEYS,
  EXPOSURE_TONE,
  type ExposureBand,
} from "@/modules/core/kernel/domain/exposure";
import { ROAM_KEYS, type RoamStatus } from "@/modules/core/kernel/domain/roam";

/**
 * ROAM als Pille — kühle Palette, deckungsgleich zu `ROAM_DOT`/`ROAM_HEX`
 * (Kernel-SSOT) und bewusst disjunkt von der warmen Exposure-Skala.
 *
 * Dass `owned` und `resolved` einander farblich nahe stehen, ist hier
 * unschädlich: die Pille trägt ihr Wort. Wo die Farbe **allein** steht — auf dem
 * Punkt in der Matrix —, trennt zusätzlich die Form.
 */
export const ROAM_CLASS: Record<RoamStatus, string> = {
  open: "bg-slate-100 text-slate-600 dark:bg-slate-800/50 dark:text-slate-300",
  resolved: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300",
  owned: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
  accepted: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300",
  mitigated: "bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300",
};

export function ExposureBadge({ band, className }: { band: ExposureBand; className?: string }) {
  const t = useTranslations();
  return (
    <Badge className={cn("border-transparent", EXPOSURE_TONE[band].badge, className)}>
      {t(EXPOSURE_KEYS[band])}
    </Badge>
  );
}

export function RoamBadge({ status, className }: { status: RoamStatus; className?: string }) {
  const t = useTranslations();
  return (
    <Badge className={cn("border-transparent", ROAM_CLASS[status], className)}>
      {t(ROAM_KEYS[status])}
    </Badge>
  );
}
