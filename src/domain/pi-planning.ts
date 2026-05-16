import { ok, err, type Result } from "@/domain/errors";

export interface SprintDraft {
  teamId: string;
  indexInPi: number;
  startDate: Date;
  endDate: Date;
}

export function validateDateRange(start: Date, end: Date): Result<void> {
  if (end <= start) {
    return err({ kind: "conflict" as const, reason: "End date must be after start date" });
  }
  return ok(undefined);
}

export function generateSprints(
  startDate: Date,
  endDate: Date,
  teams: ReadonlyArray<{ id: string }>,
): SprintDraft[] {
  const durationDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const sprintCount = Math.max(1, Math.ceil(durationDays / 14));

  return teams.flatMap((team) =>
    Array.from({ length: sprintCount }, (_, i) => {
      const sprintStart = new Date(startDate);
      sprintStart.setDate(sprintStart.getDate() + i * 14);
      const sprintEnd = new Date(startDate);
      sprintEnd.setDate(sprintEnd.getDate() + (i + 1) * 14 - 1);
      return {
        teamId: team.id,
        indexInPi: i + 1,
        startDate: sprintStart,
        endDate: sprintEnd > endDate ? endDate : sprintEnd,
      };
    }),
  );
}
