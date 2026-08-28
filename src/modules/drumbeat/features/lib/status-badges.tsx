/**
 * Geteilte Status-/Dependency-/WSJF-Badges — die **eine** Präsentations-Schicht
 * der Drumbeat-Status-Registry (`domain/status.ts`). Farb-Token je Status leben
 * ausschließlich hier (kein verstreutes `bg-*-100 text-*-700` mehr); Labels aus
 * der Registry. Über Board, Tabelle, Fahrplan, Netzwerk, Detail identisch.
 *
 * a11y: jedes Badge trägt sein **Text-Label** (nicht nur Farbe).
 */

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  FEATURE_STATUS_LABELS,
  DEPENDENCY_TYPE_LABELS,
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

/** Farb-Token je Dependency-Typ (SSOT). */
export const DEPENDENCY_TYPE_CLASS: Record<DependencyType, string> = {
  blocks: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  depends_on: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  relates_to: "bg-slate-100 text-slate-600 dark:bg-slate-800/50 dark:text-slate-300",
};

export function StatusBadge({ status, className }: { status: FeatureStatus; className?: string }) {
  return (
    <Badge className={cn("border-transparent", FEATURE_STATUS_CLASS[status], className)}>
      {FEATURE_STATUS_LABELS[status]}
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
  return (
    <Badge className={cn("border-transparent", DEPENDENCY_TYPE_CLASS[type], className)}>
      {DEPENDENCY_TYPE_LABELS[type]}
      {count != null ? ` ${count}` : ""}
    </Badge>
  );
}

export function WsjfBadge({ value, className }: { value: number | null; className?: string }) {
  return (
    <Badge variant="outline" className={cn("font-mono tabular-nums", className)}>
      {value == null ? "WSJF —" : `WSJF ${value.toFixed(1)}`}
    </Badge>
  );
}
