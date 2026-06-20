import type { DomainError, Result } from "./errors";
import { ok, err } from "./errors";

/**
 * **Pyramid-Invariante** fuer KPI ↔ Key Result-Bindungen.
 *
 * Domain-Regel: jede Epic-KPI feedet hoechstens *einen* Key Result.
 * Zusammen mit der 1 Epic = 1 KPI-Regel ergibt das die strikte Pyramide
 * Epic → KPI → ≤ 1 KR, sodass jeder Euro Mehrwert auf jeder Ebene des
 * Rollups genau einmal gezaehlt wird. CONTEXT.md §Strategy & KPI bindings.
 *
 * Drei Durchsetzungs-Seams:
 *  - dieses Modul (Validierung vor jedem Schreiben),
 *  - `setKpiBinding`-Service (atomic re-bind innerhalb einer Transaktion),
 *  - `UNIQUE(kpiId)` auf `kr_kpi_contributions` (DB-Backstop).
 *
 * Re-Bind (KPI wechselt den KR) ist erlaubt — die Pyramide bleibt
 * intakt, weil die alte Bindung im selben Transaction-Step abgeloest wird.
 */
export interface ExistingBinding {
  kpiId: string;
  keyResultId: string;
}

export interface CheckKpiBindingInput {
  kpiId: string;
  /** `null` = KPI vom KR loesen. */
  targetKeyResultId: string | null;
  /** Aktuelle Bindung (`null` wenn ungebunden). */
  existing: ExistingBinding | null;
}

export type BindingPlan =
  | { kind: "noop" }
  | { kind: "create"; kpiId: string; keyResultId: string }
  | { kind: "delete"; kpiId: string }
  | { kind: "rebind"; kpiId: string; fromKeyResultId: string; toKeyResultId: string };

/**
 * Plant die Bindungs-Mutation unter Pyramid-Garantie. Eingaben mit
 * widerspruechlichem `existing` (kpiId-Mismatch) werden als
 * `pyramid_violated` zurueckgewiesen — dann lebt im DB-Zustand bereits
 * eine zweite Bindung fuer dieselbe KPI, was die Pyramide verletzt.
 */
export function checkKpiBinding(input: CheckKpiBindingInput): Result<BindingPlan, DomainError> {
  const { kpiId, targetKeyResultId, existing } = input;

  if (existing && existing.kpiId !== kpiId) {
    return err({
      kind: "pyramid_violated",
      kpiId,
      existingKeyResultId: existing.keyResultId,
    });
  }

  if (targetKeyResultId === null) {
    if (!existing) return ok({ kind: "noop" });
    return ok({ kind: "delete", kpiId });
  }

  if (!existing) {
    return ok({ kind: "create", kpiId, keyResultId: targetKeyResultId });
  }

  if (existing.keyResultId === targetKeyResultId) {
    return ok({ kind: "noop" });
  }

  return ok({
    kind: "rebind",
    kpiId,
    fromKeyResultId: existing.keyResultId,
    toKeyResultId: targetKeyResultId,
  });
}
