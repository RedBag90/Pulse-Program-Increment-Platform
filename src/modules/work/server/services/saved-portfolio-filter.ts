/**
 * Die Portfolio-Sicht auf die gespeicherten Filter — ein dünner Aufsatz über
 * `src/server/services/saved-filter.ts`, der die **fünf Facettennamen dieser
 * Fläche** mitbringt und den Bereich `"portfolio"` setzt.
 *
 * Die Mechanik selbst (Upsert per Name, „genau ein Standard", Besitz-Check,
 * Audit) lag bis zuletzt hier — an ihr war aber nichts portfolio-eigen. Sie ist
 * nach unten gezogen, weil die Ziele-Fläche sie ebenfalls braucht und Core nach
 * ADR-0013 nicht ins Work-Modul greifen darf.
 */

import type { PrismaClient } from "@/generated/prisma";
import type { Principal } from "@/server/auth/principal";
import type { RequestContext } from "@/server/http/mutation-handler";
import type { Result } from "@/modules/core/kernel/domain/errors";
import {
  listSavedFilters,
  saveSavedFilter,
  deleteSavedFilter,
  parseFilterCriteria,
} from "@/server/services/saved-filter";

/** Die Facetten der Portfolio-Übersicht — die eine Stelle, die sie aufzählt. */
export const PORTFOLIO_FILTER_KEYS = ["vs", "gate", "status", "owner", "cls"] as const;

export interface SavedFilterCriteria {
  vs: string[];
  gate: string[];
  status: string[];
  owner: string[];
  /** Epic-Klasse; erst später hinzugekommen — alte Zeilen lesen `[]`. */
  cls: string[];
  /** Macht die feste Form zur offenen Karte, die der Dienst darunter erwartet. */
  [key: string]: string[];
}

export interface SavedPortfolioFilterDTO {
  id: string;
  name: string;
  criteria: SavedFilterCriteria;
  isDefault: boolean;
}

/** Tolerant: liest die String-Arrays aus dem JSON-Blob, verwirft Fremdes. */
export function parseSavedFilterCriteria(json: unknown): SavedFilterCriteria {
  return parseFilterCriteria(json, PORTFOLIO_FILTER_KEYS) as SavedFilterCriteria;
}

export async function listSavedPortfolioFilters(
  db: PrismaClient,
  principal: Principal,
): Promise<SavedPortfolioFilterDTO[]> {
  const rows = await listSavedFilters(db, principal, "portfolio", PORTFOLIO_FILTER_KEYS);
  return rows as SavedPortfolioFilterDTO[];
}

export interface SaveFilterInput {
  name: string;
  criteria: SavedFilterCriteria;
  isDefault: boolean;
}

export function saveSavedPortfolioFilter(
  ctx: RequestContext,
  input: SaveFilterInput,
): Promise<Result<{ id: string }>> {
  return saveSavedFilter(ctx, { ...input, scope: "portfolio" });
}

export function deleteSavedPortfolioFilter(
  ctx: RequestContext,
  input: { id: string },
): Promise<Result<void>> {
  return deleteSavedFilter(ctx, { id: input.id, scope: "portfolio" });
}
