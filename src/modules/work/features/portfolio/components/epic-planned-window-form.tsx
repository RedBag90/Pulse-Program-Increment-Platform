import { Link } from "@/i18n/navigation";

/** ISO yyyy-mm-dd extractor for display (UTC-safe). */
function toIsoDate(d: Date | null): string {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

interface Props {
  /** Kept on the prop interface for callers; unused now that the form is read-only. */
  epicId: string;
  plannedStartAt: Date | null;
  plannedEndAt: Date | null;
  /** The derived "Ist"-Fenster from the Features' PIs, or null when nothing is scheduled. */
  derived: { start: Date; end: Date } | null;
  /** Kept for caller symmetry; the read-only display is identical for every role. */
  canEdit: boolean;
}

/**
 * "Geplantes Zeitfenster" on the Epic Overview tab — now **read-only**.
 *
 * The Soll-Fenster is derived from where the participatory-budget money lands
 * (first funded half-year → last funded half-year). It's written by
 * `saveBudgetAllocation` in the same transaction as the allocations, so it
 * stays in lock-step. To change it, the user adjusts the budget allocation.
 */
export function EpicPlannedWindowForm({ plannedStartAt, plannedEndAt, derived }: Props) {
  const startStr = toIsoDate(plannedStartAt);
  const endStr = toIsoDate(plannedEndAt);
  const hasPlanned = startStr !== "" && endStr !== "";

  // Divergenz > 30 Tage zwischen Soll (= Budget-Fenster) und Ist (Features) → kleiner Hinweis.
  const diverged =
    hasPlanned &&
    derived &&
    (Math.abs(derived.start.getTime() - plannedStartAt!.getTime()) > 30 * 86_400_000 ||
      Math.abs(derived.end.getTime() - plannedEndAt!.getTime()) > 30 * 86_400_000);

  return (
    <div className="space-y-1.5 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
      {hasPlanned ? (
        <p>
          <span className="font-medium">{startStr}</span> →{" "}
          <span className="font-medium">{endStr}</span>
        </p>
      ) : (
        <p className="text-muted-foreground">
          Noch keine Budget-Zuteilung — Zeitfenster wird gesetzt, sobald Geld verteilt ist.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Automatisch aus der{" "}
        <Link href="/controlling/budgeting" className="text-primary hover:underline">
          Budget-Zuteilung
        </Link>{" "}
        abgeleitet — erste finanzierte Periode bis letzte finanzierte Periode.
      </p>
      {derived && (
        <p className="text-xs text-muted-foreground">
          Ableitung aus Features: {toIsoDate(derived.start)} → {toIsoDate(derived.end)}
        </p>
      )}
      {diverged && (
        <p className="text-xs text-amber-700">
          Ist-Fenster (Feature-PIs) weicht vom Budget-Fenster ab — Feature-PIs ggf. umplanen oder
          Budget-Zuteilung anpassen.
        </p>
      )}
    </div>
  );
}
