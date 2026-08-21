/**
 * PI rules — the canonical, pure model for a Program Increment: its status
 * machine + closure-readiness rule (formerly `pi-lifecycle.ts`) AND its
 * date-window validity (formerly `pi-planning.ts`). One home for "which PI
 * transition/date is legal", so the service (and readers) don't hunt across
 * files.
 *
 * No I/O, no Date-now: the service loads the PI + counts open Issues and
 * persists transitions; this module owns only the rules. `pi-standard.ts`
 * stays separate — that is calendar *provisioning*, not a rule.
 */

import { ok, err, type Result } from "@/modules/core/kernel/domain/errors";
import { piWindowsOverlap } from "@/modules/drumbeat/domain/timeline-grid";

// ---------------------------------------------------------------------------
// Status machine
// ---------------------------------------------------------------------------

export type PiStatus = "planned" | "active" | "completed";

/** All PI statuses, in lifecycle order. */
export const PI_STATUSES = ["planned", "active", "completed"] as const satisfies readonly PiStatus[];

/**
 * Allowed PI status transitions. A PI moves strictly forward:
 * planned → active (startPi), active → completed (completePi). `completed` is
 * terminal. The DB-dependent guards (one active PI per Timeline, closure
 * readiness) stay in the service — this table encodes only transition validity.
 */
export const PI_TRANSITIONS: Record<PiStatus, readonly PiStatus[]> = {
  planned: ["active"],
  active: ["completed"],
  completed: [],
};

/** True when `to` is a permitted next status from `from`. */
export function canTransition(from: PiStatus, to: PiStatus): boolean {
  return PI_TRANSITIONS[from].includes(to);
}

// ---------------------------------------------------------------------------
// Closure readiness
// ---------------------------------------------------------------------------

/**
 * The projection a closure check reads: the number of open, un-ROAMed Issues
 * across the PI's ARTs, plus the three closure-ceremony stamps. Built by the
 * service from either the read client (`db`) or the write client (`tx`).
 */
export interface PiClosureSnapshot {
  openUnroamedIssues: number;
  systemDemoAt: Date | null;
  inspectAdaptAt: Date | null;
  retrospectiveNotes: string | null;
}

/**
 * Closure readiness as a list of human-readable blocking reasons (German).
 * Empty list = ready for `completePi`. One rule; the read path (wizard
 * pre-check) and the write path (belt & suspenders in `completePi`) both build
 * a snapshot and call this.
 */
export function evaluateClosure(snapshot: PiClosureSnapshot): string[] {
  const reasons: string[] = [];
  if (snapshot.openUnroamedIssues > 0) {
    reasons.push(`${snapshot.openUnroamedIssues} offene Issue(s) ohne ROAM`);
  }
  if (!snapshot.systemDemoAt) reasons.push("System-Demo-Termin fehlt");
  if (!snapshot.inspectAdaptAt) reasons.push("Inspect & Adapt-Termin fehlt");
  if (!snapshot.retrospectiveNotes || snapshot.retrospectiveNotes.trim() === "") {
    reasons.push("Retrospektive-Notizen fehlen");
  }
  return reasons;
}

// ---------------------------------------------------------------------------
// Cadence derivation (next PI)
// ---------------------------------------------------------------------------

/** Eine PI-Zeile, wie die Kadenz-Ableitung sie braucht. */
export interface PiCadenceRow {
  name: string;
  startDate: Date;
  endDate: Date;
}

/** Das Spezifikat des nächsten PI (noch ohne Id). */
export interface NextPiSpec {
  name: string;
  startDate: Date;
  endDate: Date;
}

const DAY_MS = 86_400_000;

/**
 * Leitet das **nächste** PI aus der Kadenz ab: kontiguierlich nach dem spätesten
 * PI (`+1 Tag`), gleiche Dauer wie dieses, Name „PI n+1" (n = höchste vorhandene
 * PI-Nummer, sonst Anzahl). Rein; braucht keinen `PiStandard` — die Kadenz steckt
 * in der Länge des letzten PI. `null` bei leerer Liste.
 */
export function nextPiFromCadence(pis: readonly PiCadenceRow[]): NextPiSpec | null {
  if (pis.length === 0) return null;
  const last = pis.reduce((m, p) => (p.endDate.getTime() > m.endDate.getTime() ? p : m), pis[0]!);
  const durationMs = last.endDate.getTime() - last.startDate.getTime();
  const startDate = new Date(last.endDate.getTime() + DAY_MS);
  const endDate = new Date(startDate.getTime() + durationMs);
  const maxNum = pis.reduce((m, p) => {
    const n = Number.parseInt(p.name.replace(/^\D+/, ""), 10);
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  const num = maxNum > 0 ? maxNum + 1 : pis.length + 1;
  return { name: `PI ${num}`, startDate, endDate };
}

// ---------------------------------------------------------------------------
// Date-window validity (PI planning)
// ---------------------------------------------------------------------------

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
