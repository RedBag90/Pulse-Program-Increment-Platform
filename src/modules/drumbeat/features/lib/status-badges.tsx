/**
 * Geteilte Status-/Dependency-/WSJF-Badges — die **eine** Präsentations-Schicht
 * der Drumbeat-Status-Registry (`domain/status.ts`). Farb-Token je Status leben
 * ausschließlich hier (kein verstreutes `bg-*-100 text-*-700` mehr); Labels aus
 * der Registry. Über Board, Tabelle, Fahrplan, Netzwerk, Detail identisch.
 *
 * a11y: jedes Badge trägt sein **Text-Label** (nicht nur Farbe).
 */

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  FEATURE_STATUS_KEYS,
  DEPENDENCY_TYPE_KEYS,
  type FeatureStatus,
  type DependencyType,
} from "@/modules/drumbeat/domain/status";

/** Farb-Token je Feature-Delivery-Status (SSOT). */
export const FEATURE_STATUS_CLASS: Record<FeatureStatus, string> = {
  approved: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300",
  in_progress: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  blocked: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  cancelled: "bg-slate-100 text-slate-600 dark:bg-slate-800/50 dark:text-slate-300",
};

/** Dot-/Punkt-Farbe (Tailwind `bg-*-500`) je Status — kanonischer Hue, geteilt
 *  von Board, Netzwerk-Graph und Gantt (Ende der Board-vs-Graph-Farbdrift). */
export const FEATURE_STATUS_DOT: Record<FeatureStatus, string> = {
  approved: "bg-indigo-500",
  in_progress: "bg-amber-500",
  blocked: "bg-red-500",
  completed: "bg-emerald-500",
  cancelled: "bg-slate-400",
};

/**
 * Lane-Tint des Boards je Status — dieselbe Achse, eine Stufe blasser als das
 * Badge. Stand vorher als rohe Palette **ohne** `dark:`-Partner im Board; im
 * Dunkelmodus waren die Spalten fast weiß.
 */
export const FEATURE_STATUS_LANE: Record<FeatureStatus, string> = {
  approved: "bg-indigo-50 dark:bg-indigo-950/30",
  in_progress: "bg-amber-50 dark:bg-amber-950/30",
  blocked: "bg-red-50 dark:bg-red-950/30",
  completed: "bg-emerald-50 dark:bg-emerald-950/30",
  cancelled: "bg-slate-50 dark:bg-slate-900/40",
};

/** Farb-Token je Dependency-Typ (SSOT). */
export const DEPENDENCY_TYPE_CLASS: Record<DependencyType, string> = {
  blocks: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  relates_to: "bg-slate-100 text-slate-600 dark:bg-slate-800/50 dark:text-slate-300",
};

export function StatusBadge({ status, className }: { status: FeatureStatus; className?: string }) {
  const t = useTranslations();
  return (
    <Badge className={cn("border-transparent", FEATURE_STATUS_CLASS[status], className)}>
      {t(FEATURE_STATUS_KEYS[status])}
    </Badge>
  );
}

export function DependencyBadge({
  type,
  count,
  className,
}: {
  type: DependencyType;
  /** Optionaler Zähler, z. B. „blockiert 1". */
  count?: number;
  className?: string;
}) {
  const t = useTranslations();
  return (
    <Badge className={cn("border-transparent", DEPENDENCY_TYPE_CLASS[type], className)}>
      {t(DEPENDENCY_TYPE_KEYS[type])}
      {count != null ? ` ${count}` : ""}
    </Badge>
  );
}

export function WsjfBadge({ value, className }: { value: number | null; className?: string }) {
  const t = useTranslations();
  return (
    <Badge variant="outline" className={cn("font-mono tabular-nums", className)}>
      {value == null
        ? t("drumbeat.ui.wsjfLeer")
        : t("drumbeat.ui.wsjfWert", { score: value.toFixed(1) })}
    </Badge>
  );
}
