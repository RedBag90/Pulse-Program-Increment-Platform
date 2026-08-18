/**
 * Freigabe-Primitive — das Vokabular, das **beide** Abnahme-Achsen teilen:
 *
 *   - die Business-Case-Mehrparteien-Freigabe (`epic-approval.ts`, `EpicApproval`)
 *   - die Reifegrad-Abnahme (`gate-transition.ts`, `StageGateApproval`)
 *
 * Beide brauchen dieselben drei Dinge: „welchen Status hat eine Entscheidung",
 * „darf dieser Actor diese Zeile entscheiden" und „ist die Menge durch". Vor
 * dieser Datei lag das alles in `epic-approval.ts` — die Gate-Achse hätte dann
 * die komplette BC-Phasenmaschine (`nextPhaseFor`, `APPROVAL_PHASES`) mit
 * importieren müssen, um an `assertAssignedApprover` zu kommen. Das Vokabular
 * wandert hierher, `epic-approval.ts` re-exportiert es, seine Aufrufstellen
 * bleiben unangetastet — und die Achsen bleiben trotzdem orthogonal (ADR-0003).
 *
 * Rein, kein I/O, keine Uhr.
 */

import { ok, err, type Result } from "@/modules/core/kernel/domain/errors";

/** Die Entscheidung eines Abnehmers zu einer einzelnen Zeile. */
export type ApprovalDecision = "approve" | "reject";

/** Der Zustand einer einzelnen Abnahme-Zeile. */
export type ApprovalStatus = "pending" | "approved" | "rejected";

/** Der aggregierte Zustand einer Menge von Abnahme-Zeilen. */
export type RollupStatus = "unassigned" | "pending" | "approved" | "rejected";

/** Der Status, den eine Entscheidung auf ihrer Zeile erzeugt. */
export function decisionStatus(decision: ApprovalDecision): ApprovalStatus {
  return decision === "approve" ? "approved" : "rejected";
}

/**
 * Zeilen-Eigentums-Guard: eine Abnahme darf **nur** von der Person entschieden
 * werden, der sie zugewiesen ist. Das ist eine *andere* Autorisierungsachse als
 * der Value-Stream-/Owner-Scope, den `loadAuthorizedEpic` prüft — die Policy
 * sieht die Abnahme-Zeile nicht, also erzwingt der Service es hier. Benannt und
 * rein, damit BC- und Gate-Achse exakt dieselbe Definition benutzen.
 */
export function assertAssignedApprover(
  row: { approverUserId: string | null },
  actorId: string,
): Result<void> {
  if (row.approverUserId !== actorId) {
    return err({
      kind: "conflict" as const,
      reason: "Nur der zugewiesene Approver darf diese Freigabe entscheiden",
    });
  }
  return ok(undefined);
}

/**
 * Aggregation einer Zeilenmenge: leer ⇒ `unassigned`, eine Ablehnung dominiert,
 * sonst `approved` erst wenn **alle** zugestimmt haben.
 */
export function rollup(rows: readonly { status: ApprovalStatus }[]): RollupStatus {
  if (rows.length === 0) return "unassigned";
  if (rows.some((r) => r.status === "rejected")) return "rejected";
  if (rows.every((r) => r.status === "approved")) return "approved";
  return "pending";
}

// ---------------------------------------------------------------------------
// Quorum — wie viele Zustimmungen reichen.
//
// Die BC-Achse kennt nur „einstimmig" (`isFullyApproved`). Die Gate-Achse macht
// das konfigurierbar: die Regel-Zeile trägt das Quorum, der Antrag friert es
// beim Anlegen ein, damit eine spätere Konfig-Änderung laufende Anträge nicht
// umdeutet. Ausgewertet wird ausschliesslich hier.
// ---------------------------------------------------------------------------

export const QUORA = ["all", "any"] as const;
export type Quorum = (typeof QUORA)[number];

export function isQuorum(value: string): value is Quorum {
  return (QUORA as readonly string[]).includes(value);
}

/**
 * Ist die Zustimmung erreicht? `all` = jede Zeile zugestimmt (einstimmig),
 * `any` = mindestens eine. Eine leere Menge ist **nie** erreicht — ein Antrag
 * ohne Abnehmer darf nicht durch „vacuous truth" durchrutschen; dieser Fall
 * gehört in den `required: false`-Pfad, nicht hierher.
 */
export function quorumReached(
  rows: readonly { status: ApprovalStatus }[],
  quorum: Quorum,
): boolean {
  if (rows.length === 0) return false;
  return quorum === "all"
    ? rows.every((r) => r.status === "approved")
    : rows.some((r) => r.status === "approved");
}

/**
 * Ist der Vorgang abgelehnt? Eine einzige Ablehnung stoppt — unabhängig vom
 * Quorum. Auch bei `any` bedeutet ein „nein" einen benannten Einwand, der nicht
 * still von einer anderen Zustimmung überstimmt werden soll.
 */
export function quorumRejected(rows: readonly { status: ApprovalStatus }[]): boolean {
  return rows.some((r) => r.status === "rejected");
}

/** Wie viele Zeilen noch offen sind — für „wartet auf 2 von 3". */
export function pendingCount(rows: readonly { status: ApprovalStatus }[]): number {
  return rows.filter((r) => r.status === "pending").length;
}
