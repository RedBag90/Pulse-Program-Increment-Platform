import { Link } from "@/i18n/navigation";

/** ISO yyyy-mm-dd extractor for display (UTC-safe). */
function toIsoDate(d: Date | null): string {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

interface Props {
  /** Links to the Epic's timeline tab, where the window is planned. */
  epicId: string;
  plannedStartAt: Date | null;
  plannedEndAt: Date | null;
  /** The derived "Ist"-Fenster from the Features' PIs, or null when nothing is scheduled. */
  derived: { start: Date; end: Date } | null;
  /** Kept for caller symmetry; the read-only display is identical for every role. */
  canEdit: boolean;
}

/**
 * "Geplantes Zeitfenster" on the Epic Overview tab — **read-only**.
 *
 * The Soll-Fenster is derived from the owner's Reifegrad-Plan: the Implementation
 * phase estimates L4.1 (Umsetzung gestartet) → L4.2 (Umsetzung fertig). It's
 * written by `saveTimeline` from the "Reifegrad-Phasen und Timeline" tab, so it
 * stays in lock-step with the plan. To change it, the owner edits those dates.
 */
export function EpicPlannedWindowForm({ epicId, plannedStartAt, plannedEndAt, derived }: Props) {
  const startStr = toIsoDate(plannedStartAt);
  const endStr = toIsoDate(plannedEndAt);
  const hasPlanned = startStr !== "" && endStr !== "";

  // Divergenz > 30 Tage zwischen Plan-Fenster (L4.1/L4.2) und Ist (Features) → kleiner Hinweis.
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
          Noch kein Umsetzungstermin geplant — setze L4.1/L4.2 im{" "}
          <Link
            href={`/portfolio/epics/${epicId}?tab=timeline`}
            className="text-primary hover:underline"
          >
            Reifegrad-Plan
          </Link>
          .
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Aus dem{" "}
        <Link
          href={`/portfolio/epics/${epicId}?tab=timeline`}
          className="text-primary hover:underline"
        >
          Reifegrad-Plan
        </Link>{" "}
        abgeleitet — geplanter Umsetzungsstart (L4.1) bis Umsetzungsende (L4.2).
      </p>
      {derived && (
        <p className="text-xs text-muted-foreground">
          Ableitung aus Features: {toIsoDate(derived.start)} → {toIsoDate(derived.end)}
        </p>
      )}
      {diverged && (
        <p className="text-xs text-amber-700">
          Ist-Fenster (Feature-PIs) weicht vom Plan-Fenster ab — Feature-PIs ggf. umplanen oder den
          Reifegrad-Plan (L4.1/L4.2) anpassen.
        </p>
      )}
    </div>
  );
}
