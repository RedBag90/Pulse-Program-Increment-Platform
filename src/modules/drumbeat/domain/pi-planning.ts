import { ok, err, type Result } from "@/modules/core/kernel/domain/errors";
import { piWindowsOverlap } from "@/modules/drumbeat/domain/timeline-grid";

/** Existing PI for overlap-check. */
export interface ExistingPi {
  id: string;
  startDate: Date;
  endDate: Date;
  name?: string | undefined;
}

export function validateDateRange(start: Date, end: Date): Result<void> {
  if (end <= start) {
    return err({ kind: "conflict" as const, reason: "End date must be after start date" });
  }
  return ok(undefined);
}

export interface PiDateValidationInput {
  /** When updating, exclude self from overlap check. */
  id?: string | undefined;
  /** Optional new name; pruefen wir gegen den Timeline-scope. */
  name?: string | undefined;
  start: Date;
  end: Date;
  otherPis: ReadonlyArray<ExistingPi>;
  /** "today" — fuer past-date-check (test-injectable). */
  now: Date;
}

/**
 * Validiert PI-Daten gegen die Domain-Regeln:
 *  - Start ≤ Ende
 *  - Keine Ueberlappung mit anderen PIs derselben Timeline (own ID exkludieren)
 *  - Start-Datum nicht > 30 Tage in der Vergangenheit
 *  - Name (falls gesetzt) eindeutig in der Timeline
 */
export function validatePiDates(input: PiDateValidationInput): Result<void> {
  const { id, name, start, end, otherPis, now } = input;

  const range = validateDateRange(start, end);
  if (!range.ok) return range;

  for (const other of otherPis) {
    if (other.id === id) continue;
    const overlaps = piWindowsOverlap({ startDate: start, endDate: end }, other);
    if (overlaps) {
      return err({
        kind: "conflict" as const,
        reason: `PI-Daten ueberlappen mit "${other.name ?? other.id}"`,
      });
    }
  }

  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  if (start < thirtyDaysAgo) {
    return err({
      kind: "conflict" as const,
      reason: "Start-Datum darf nicht mehr als 30 Tage in der Vergangenheit liegen",
    });
  }

  if (name !== undefined) {
    for (const other of otherPis) {
      if (other.id === id) continue;
      if (other.name === name) {
        return err({
          kind: "conflict" as const,
          reason: `PI-Name "${name}" existiert bereits in dieser Timeline`,
        });
      }
    }
  }

  return ok(undefined);
}
