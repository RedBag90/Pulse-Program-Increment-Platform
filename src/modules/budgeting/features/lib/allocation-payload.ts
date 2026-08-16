"use client";

/**
 * Typed client-side encoders for the budgeting allocation server actions.
 *
 * The server actions read a single JSON `payload` form field and validate it
 * with Zod (`JSON.parse(fd.get("payload"))` → schema). This module owns the
 * *client* half of that envelope: one typed encoder per action that builds the
 * `payload` JSON from typed args and returns a ready-to-submit `FormData`, plus
 * the shared `numOr0` string→number coercion.
 *
 * The `*Payload` types mirror each action's Zod schema field-for-field, so a
 * schema drift surfaces as a compile error where the encoder assembles the
 * payload — the wire shape is written down once, here, instead of being
 * hand-rolled in every editor component.
 *
 * The server actions' parsing is unchanged: the JSON-in-FormData envelope
 * stays; only the encode is centralized and typed.
 */

/** Half-year period key (e.g. "2026-H1") → amount. */
type PeriodAmountMap = Record<string, number>;

/** Coerce an `<input>` string to a finite number (empty/NaN → 0). */
export function numOr0(s: string): number {
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Payload for `saveBudgetAllocationAction`.
 * Mirrors `z.object({ epicId, priority, hypothesisBudget, allocations })`.
 */
export interface SaveBudgetAllocationPayload {
  epicId: string;
  priority: number;
  hypothesisBudget: number | null;
  allocations: PeriodAmountMap;
}

/** Payload for `saveBudgetPoolAction`. Mirrors `z.object({ byPeriod })`. */
export interface SaveBudgetPoolPayload {
  byPeriod: PeriodAmountMap;
}

/** Payload for `saveArtBudgetAction`. Mirrors `z.object({ artId, byPeriod })`. */
export interface SaveArtBudgetPayload {
  artId: string;
  byPeriod: PeriodAmountMap;
}

/** Wrap a typed payload object in the `payload`-JSON `FormData` envelope. */
function toFormData(payload: unknown): FormData {
  const fd = new FormData();
  fd.set("payload", JSON.stringify(payload));
  return fd;
}

/** Encode a budget-allocation save into submit-ready `FormData`. */
export function encodeSaveBudgetAllocationPayload(args: SaveBudgetAllocationPayload): FormData {
  return toFormData(args);
}

/** Encode a budget-pool save into submit-ready `FormData`. */
export function encodeSaveBudgetPoolPayload(args: SaveBudgetPoolPayload): FormData {
  return toFormData(args);
}

/** Encode an ART-budget save into submit-ready `FormData`. */
export function encodeSaveArtBudgetPayload(args: SaveArtBudgetPayload): FormData {
  return toFormData(args);
}
