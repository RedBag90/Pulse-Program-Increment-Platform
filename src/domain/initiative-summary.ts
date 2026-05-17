import type { StageGate, InitiativeStatus } from "@/domain/types";

// ---------------------------------------------------------------------------
// Initiative summary — the one-line status band on the Overview tab.
//
// Pure, in-process: every input is passed explicitly, so the derived summary
// is deterministic and unit-testable. No new storage — the band is computed
// from data the Epic already carries.
// ---------------------------------------------------------------------------

const DAY_MS = 1000 * 60 * 60 * 24;

/** Days of inactivity after which the summary flags the Epic as stale. */
export const STALE_AFTER_DAYS = 14;

export interface InitiativeSummaryInput {
  stageGate: StageGate;
  status: InitiativeStatus;
  childCount: number;
  completedChildCount: number;
  approvedAt: Date | null;
  updatedAt: Date;
  /** Defaults to the current time; injectable for deterministic tests. */
  now?: Date;
}

const STATUS_TEXT: Record<InitiativeStatus, string> = {
  draft: "Entwurf",
  in_review: "in Prüfung",
  approved: "freigegeben",
  in_progress: "in Umsetzung",
  blocked: "blockiert",
  completed: "abgeschlossen",
  cancelled: "abgebrochen",
};

/**
 * Builds the Overview status band: a few short clauses joined by " — ",
 * mirroring the screenshot's grey summary box. Clauses are only added when
 * they carry information, so the band stays terse.
 */
export function buildInitiativeSummary(input: InitiativeSummaryInput): string {
  const now = input.now ?? new Date();
  const clauses: string[] = [`Stage ${input.stageGate}`, STATUS_TEXT[input.status] ?? input.status];

  if (input.childCount > 0) {
    clauses.push(
      `${input.completedChildCount} von ${input.childCount} untergeordneten Initiativen abgeschlossen`,
    );
  }

  if (input.approvedAt) {
    clauses.push("freigegeben");
  }

  const daysSinceUpdate = Math.floor((now.getTime() - input.updatedAt.getTime()) / DAY_MS);
  if (daysSinceUpdate >= STALE_AFTER_DAYS) {
    clauses.push(`seit ${daysSinceUpdate} Tagen unverändert`);
  }

  return clauses.join(" — ");
}
