/**
 * PI-standard calendars — pure date maths for provisioning a year's worth of
 * Program Increments from a named, reusable standard. A standard is uniform:
 * an anchor day/month, a cadence in weeks, and a PI count. Applying it to a
 * year yields contiguous, equal-length PIs named "PI 1" … "PI n".
 *
 * No I/O. The service layer ([pi-standard.ts](src/server/services/pi-standard.ts))
 * builds on this; the overlap filter (`selectFreeStandardPis`) makes re-applying
 * a standard idempotent — each standard PI overlaps its own prior copy.
 */

/** A reusable PI calendar: uniform cadence × count anchored at a day/month. */
export interface PiStandardSpec {
  /** 1–12. */
  anchorMonth: number;
  /** 1–31. */
  anchorDay: number;
  /** Length of every PI, in weeks (e.g. 8). */
  cadenceWeeks: number;
  /** Number of PIs the standard produces (e.g. 6). */
  piCount: number;
}

export interface StandardPi {
  /** "PI 1" … "PI n". */
  name: string;
  /** UTC midnight, inclusive. */
  startDate: Date;
  /** UTC midnight, inclusive (= start + cadence − 1 day). */
  endDate: Date;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Contiguous PI schedule for `year`: PI i starts `i × cadence` days after the
 * anchor and runs `cadenceWeeks × 7` days inclusive. `Date.UTC` normalises the
 * day overflow, so PIs roll across month and year boundaries cleanly.
 */
export function standardPiSchedule(spec: PiStandardSpec, year: number): StandardPi[] {
  const len = spec.cadenceWeeks * 7;
  const pis: StandardPi[] = [];
  for (let i = 0; i < spec.piCount; i++) {
    const startMs = Date.UTC(year, spec.anchorMonth - 1, spec.anchorDay + i * len);
    pis.push({
      name: `PI ${i + 1}`,
      startDate: new Date(startMs),
      endDate: new Date(startMs + (len - 1) * MS_PER_DAY),
    });
  }
  return pis;
}

/** Inclusive interval overlap: `aStart ≤ bEnd && bStart ≤ aEnd`. */
function overlaps(
  a: { startDate: Date; endDate: Date },
  b: { startDate: Date; endDate: Date },
): boolean {
  return (
    a.startDate.getTime() <= b.endDate.getTime() && b.startDate.getTime() <= a.endDate.getTime()
  );
}

/**
 * The schedule entries whose date range is free — i.e. does not overlap any
 * `existing` PI. Skipping overlapping PIs lets a standard be applied alongside
 * manually-added PIs and makes re-applying it a no-op.
 */
export function selectFreeStandardPis(
  schedule: StandardPi[],
  existing: { startDate: Date; endDate: Date }[],
): StandardPi[] {
  return schedule.filter((pi) => !existing.some((e) => overlaps(pi, e)));
}
