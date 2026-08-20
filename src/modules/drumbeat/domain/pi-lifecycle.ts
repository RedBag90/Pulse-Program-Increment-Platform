/**
 * PI lifecycle — the canonical, pure model for a Program Increment's status
 * machine and its closure readiness rule.
 *
 * No I/O, no Date-now: the service layer loads the PI + counts open Issues and
 * persists transitions; this module owns *which* status transitions are legal
 * and *what makes* a PI ready to close. Mirrors the style of
 * `STAGE_GATE_TRANSITIONS` in `src/modules/work/domain/stage-gate.ts`.
 */

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
