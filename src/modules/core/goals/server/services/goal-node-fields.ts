/**
 * Kanonisches Feld-Set eines **Goal-Knotens** (Objective = einziger Knotentyp
 * seit ADR-0010). Konzentriert die drei früher pro Update-Service dreifach
 * gepflegten Ausdrücke — Existing-Snapshot (Decimal→number), Input→Spalten-Read
 * (inkl. `clampPrecision`) und die Feldliste — an *einer* Stelle. `updateObjective`
 * und `updateKeyResult` (dieselbe Tabelle) wählen nur noch ihre Schlüssel-Teilmenge;
 * ein neues auditierbares Feld wird hier einmal ergänzt statt in zwei Services × drei
 * Stellen.
 */

import { recordedUpdate, type RecordedUpdate } from "@/modules/core/kernel/server/recorded-update";
import { clampPrecision, type MetricType } from "@/modules/core/goals/domain/goal-metric";
import type { GoalStatus } from "@/modules/core/goals/domain/goal-status";

/** Die normalisierte Snapshot-Form, über die der Changelog difft. */
export interface GoalFieldValues {
  title: string;
  narrative: string | null;
  period: string | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  status: string | null;
  dueDate: Date | null;
  closingNote: string | null;
  ownerId: string | null;
  metricName: string | null;
  metricUnit: string | null;
  metricType: string;
  precision: number;
  currencyCode: string | null;
  rollupWeight: number | null;
  parentUnitPerChildUnit: number | null;
  includeInParentRollup: boolean;
  baseline: number | null;
  target: number | null;
  current: number | null;
  progressMode: string | null;
  accountableTeamId: string | null;
}

export type GoalFieldKey = keyof GoalFieldValues;

/** Übermenge aller Update-Eingabefelder; Objective- und KR-Input sind Teilmengen. */
export interface GoalFieldUpdateInput {
  title?: string | undefined;
  narrative?: string | null | undefined;
  period?: string | null | undefined;
  periodStart?: Date | null | undefined;
  periodEnd?: Date | null | undefined;
  status?: GoalStatus | null | undefined;
  dueDate?: Date | null | undefined;
  closingNote?: string | null | undefined;
  ownerId?: string | null | undefined;
  metricName?: string | null | undefined;
  metricUnit?: string | null | undefined;
  metricType?: MetricType | undefined;
  precision?: number | undefined;
  currencyCode?: string | null | undefined;
  rollupWeight?: number | null | undefined;
  parentUnitPerChildUnit?: number | null | undefined;
  includeInParentRollup?: boolean | undefined;
  baseline?: number | null | undefined;
  target?: number | null | undefined;
  current?: number | null | undefined;
  progressMode?: string | null | undefined;
  accountableTeamId?: string | null | undefined;
}

/** Die von einem Update auditierten Felder eines vollen Objectives. */
export const OBJECTIVE_FIELD_KEYS = [
  "title",
  "narrative",
  "period",
  "periodStart",
  "periodEnd",
  "status",
  "dueDate",
  "closingNote",
  "ownerId",
  "metricName",
  "metricUnit",
  "metricType",
  "precision",
  "currencyCode",
  "rollupWeight",
  "parentUnitPerChildUnit",
  "includeInParentRollup",
  "baseline",
  "target",
  "current",
  "progressMode",
  "accountableTeamId",
] as const satisfies readonly GoalFieldKey[];

/**
 * Compile-Guard: `keys` muss **jeden** GoalFieldValues-Schlüssel enthalten. Fehlt
 * einer (z. B. ein neu ergänztes Feld, das man in OBJECTIVE_FIELD_KEYS vergessen
 * hat), wird der Parametertyp `never` und der Aufruf schlägt fehl — statt dass das
 * Feld still nie auditiert/geschrieben wird (`satisfies` allein prüft nur, dass die
 * gelisteten Einträge gültige Schlüssel sind, nicht die Vollständigkeit).
 */
function assertAllGoalFieldKeys<T extends readonly GoalFieldKey[]>(
  keys: T & ([Exclude<GoalFieldKey, T[number]>] extends [never] ? unknown : never),
): void {
  void keys;
}
assertAllGoalFieldKeys(OBJECTIVE_FIELD_KEYS);

/** Die Teilmenge, die ein KR-Update pflegt (kein narrative/closingNote/progressMode). */
export const KEY_RESULT_FIELD_KEYS = [
  "title",
  "metricName",
  "metricUnit",
  "metricType",
  "precision",
  "currencyCode",
  "rollupWeight",
  "parentUnitPerChildUnit",
  "baseline",
  "target",
  "current",
  "period",
  "periodStart",
  "periodEnd",
  "status",
  "dueDate",
  "ownerId",
] as const satisfies readonly GoalFieldKey[];

const num = (d: unknown): number | null => (d != null ? Number(d) : null);

/** Roh-Objective-Zeile (nur die auditierten Spalten; Decimals als `unknown`). */
type GoalRowSnapshot = {
  title: string;
  narrative: string | null;
  period: string | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  status: string | null;
  dueDate: Date | null;
  closingNote: string | null;
  ownerId: string | null;
  metricName: string | null;
  metricUnit: string | null;
  metricType: string;
  precision: number;
  currencyCode: string | null;
  rollupWeight: unknown;
  parentUnitPerChildUnit: unknown;
  includeInParentRollup: boolean;
  baseline: unknown;
  target: unknown;
  current: unknown;
  progressMode: string | null;
  accountableTeamId: string | null;
};

/** Decimal-Spalten auf number normalisieren, damit der Audit-Snapshot numerisch liest. */
export function projectGoalFields(existing: GoalRowSnapshot): GoalFieldValues {
  return {
    title: existing.title,
    narrative: existing.narrative,
    period: existing.period,
    periodStart: existing.periodStart,
    periodEnd: existing.periodEnd,
    status: existing.status,
    dueDate: existing.dueDate,
    closingNote: existing.closingNote,
    ownerId: existing.ownerId,
    metricName: existing.metricName,
    metricUnit: existing.metricUnit,
    metricType: existing.metricType,
    precision: existing.precision,
    currencyCode: existing.currencyCode,
    rollupWeight: num(existing.rollupWeight),
    parentUnitPerChildUnit: num(existing.parentUnitPerChildUnit),
    includeInParentRollup: existing.includeInParentRollup,
    baseline: num(existing.baseline),
    target: num(existing.target),
    current: num(existing.current),
    progressMode: existing.progressMode,
    accountableTeamId: existing.accountableTeamId,
  };
}

/**
 * Input → Spaltenwerte (undefined = unverändert); `precision` wird geklemmt.
 * Rückgabetyp ist **vollständig** (jeder Schlüssel non-optional): fehlt eine Zeile,
 * ist es ein Compile-Fehler statt eines still nie geschriebenen Feldes.
 */
export function readGoalFieldUpdates(input: GoalFieldUpdateInput): {
  [K in GoalFieldKey]: GoalFieldValues[K] | undefined;
} {
  return {
    title: input.title,
    narrative: input.narrative,
    period: input.period,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    status: input.status,
    dueDate: input.dueDate,
    closingNote: input.closingNote,
    ownerId: input.ownerId,
    metricName: input.metricName,
    metricUnit: input.metricUnit,
    metricType: input.metricType,
    precision: input.precision != null ? clampPrecision(input.precision) : input.precision,
    currencyCode: input.currencyCode,
    rollupWeight: input.rollupWeight,
    parentUnitPerChildUnit: input.parentUnitPerChildUnit,
    includeInParentRollup: input.includeInParentRollup,
    baseline: input.baseline,
    target: input.target,
    current: input.current,
    progressMode: input.progressMode,
    accountableTeamId: input.accountableTeamId,
  };
}

/**
 * Ein Update über das kanonische Goal-Feld-Set: projiziert die Zeile, liest die
 * Eingabe und ruft `recordedUpdate` über die gewählte Schlüssel-Teilmenge. Liefert
 * `{ changes, data }` wie gehabt — `data` ist die Prisma-Update-Teilmenge.
 */
export function goalRecordedUpdate<K extends GoalFieldKey>(
  existing: GoalRowSnapshot,
  input: GoalFieldUpdateInput,
  keys: readonly K[],
): RecordedUpdate<GoalFieldValues, K> {
  return recordedUpdate({
    existing: projectGoalFields(existing),
    // readGoalFieldUpdates liefert alle Schlüssel; recordedUpdate liest nur `keys`.
    updates: readGoalFieldUpdates(input) as { readonly [P in K]?: GoalFieldValues[P] | undefined },
    fields: keys,
  });
}
