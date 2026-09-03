import type { EpicClass } from "@/modules/work/domain/pb-submission";
import type { ClassFilterState } from "@/modules/work/server/views/portfolio-overview";

/**
 * Das gemeinsame Aussehen der Zusammenfassungen — vier Blöcke fassen dieselbe
 * Menge zusammen und müssen dabei gleich aussehen.
 *
 * Eine Sammelzeile darf **nicht** wie eine Zeile aussehen: gestrichelter
 * Rahmen, eingefärbter Grund, kein Datum, keine Person. Sonst liest man sie als
 * Epic und fragt sich, warum die Hälfte der Spalten leer ist. Die Farben sind
 * dieselben wie im `EpicClassBadge` — blau Portfolio, smaragd ART.
 */
export function rollupTone(cls: EpicClass | null): string {
  return cls === "portfolio"
    ? "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300"
    : "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
}

/** Nur die Grundfläche — für Tabellenzeilen, die keinen eigenen Rahmen tragen. */
export function rollupCellTone(cls: EpicClass | null): string {
  return cls === "portfolio"
    ? "bg-blue-500/[0.07] text-blue-700 dark:text-blue-300"
    : "bg-emerald-500/[0.07] text-emerald-700 dark:text-emerald-300";
}

/**
 * Die Zeile im Klartext über einem Block. Ohne sie wirkt die erste Sammelzeile
 * wie ein Datenfehler — man sieht eine Solution, wo man ein Epic erwartet.
 */
export function RollupHint({
  classFilter,
  detail,
}: {
  classFilter: ClassFilterState;
  /** Was der Block zusätzlich erklären muss (z. B. wie summiert wird). */
  detail?: string;
}) {
  if (classFilter.hiddenLabel == null) return null;
  return (
    <p className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
      <span
        className={`inline-block size-2 shrink-0 rounded-[2px] border ${rollupTone(classFilter.hiddenClass)}`}
      />
      <span>
        {classFilter.hiddenLabel} je Solution zusammengefasst
        {detail ? ` · ${detail}` : ""}
      </span>
    </p>
  );
}
