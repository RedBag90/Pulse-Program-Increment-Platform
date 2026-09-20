/**
 * **Persönlich gespeicherte Filter — je Fläche, je Nutzer.**
 *
 * Benannte Filter-Sets, die sich anlegen, anwenden und als Standard markieren
 * lassen. Tenant- und nutzer-gebunden: die Zeilen sind über `userId` isoliert,
 * geteilt wird nichts.
 *
 * Der Dienst lag bis hierher als `saved-portfolio-filter.ts` im **Work**-Modul,
 * obwohl an ihm nichts portfolio-eigen war — die Tabelle kennt nur
 * `(tenant, user, name, criteria, isDefault)`, und `criteria` ist ein
 * undurchsichtiger Blob. Portfolio-eigen waren allein die fünf Facettennamen.
 *
 * Er steht jetzt hier, weil die Ziele-Fläche ihn ebenfalls braucht: die Ziele
 * liegen in **Core**, und Core darf nach ADR-0013 nicht nach oben importieren.
 * `src/server/services/` ist der Ort der querschnittlichen Dienste und
 * unterliegt keiner Schichtschranke.
 *
 * **`scope` trennt die Flächen.** Ohne ihn könnte niemand „Q4" sowohl fürs
 * Portfolio als auch für die Ziele führen — der Unique-Index steht auf
 * `(tenant, user, scope, name)`.
 */

import type { PrismaClient, Prisma } from "@/generated/prisma";
import type { Principal } from "@/server/auth/principal";
import type { RequestContext } from "@/server/http/mutation-handler";
import { withAuditedTransaction, toMutationContext } from "@/modules/core/kernel/server/mutation";
import type { Result } from "@/modules/core/kernel/domain/errors";
import type { AuditAction } from "@/server/audit/emit";
import { ok, err } from "@/modules/core/kernel/domain/errors";

/** Die Flächen, die Filter speichern können. */
export type FilterScope = "portfolio" | "goals" | "issues";

/**
 * Die Audit-Namen je Fläche.
 *
 * Hier stand zweimal `scope === "goals" ? … : …` — eine Frage mit zwei
 * Antworten, solange es zwei Flächen gab. Mit der dritten hätte ein
 * Issue-Filter stillschweigend als `portfolio_filter` im Protokoll gestanden.
 * Eine Tabelle zwingt jeden neuen Scope, seinen Namen mitzubringen.
 */
const AUDIT_ACTION: Record<FilterScope, { saved: AuditAction; deleted: AuditAction }> = {
  portfolio: { saved: "portfolio_filter.saved", deleted: "portfolio_filter.deleted" },
  goals: { saved: "goal_filter.saved", deleted: "goal_filter.deleted" },
  issues: { saved: "issue_filter.saved", deleted: "issue_filter.deleted" },
};

/** Eine Facetten-Karte: Schlüssel → gewählte Werte. */
export type FilterCriteria = Record<string, string[]>;

export interface SavedFilterDTO {
  id: string;
  name: string;
  criteria: FilterCriteria;
  isDefault: boolean;
}

/**
 * Tolerantes Lesen des JSON-Blobs: jeder erwartete Schlüssel kommt als
 * String-Array zurück, Fremdes wird verworfen, Fehlendes ist `[]`.
 *
 * Das ist der Versionierungs-Mechanismus für ein schemaloses Feld — eine später
 * ergänzte Facette liest an alten Zeilen einfach die leere Menge. Vorher waren
 * die fünf Portfolio-Schlüssel hier hartkodiert; sie kommen jetzt von aussen,
 * und das ist der ganze Unterschied zur früheren Fassung.
 */
export function parseFilterCriteria(json: unknown, keys: readonly string[]): FilterCriteria {
  const c = (json ?? {}) as Record<string, unknown>;
  const arr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  return Object.fromEntries(keys.map((k) => [k, arr(c[k])]));
}

export async function listSavedFilters(
  db: PrismaClient,
  principal: Principal,
  scope: FilterScope,
  keys: readonly string[],
): Promise<SavedFilterDTO[]> {
  const rows = await db.savedFilter.findMany({
    where: { tenantId: principal.tenantId, userId: principal.id, scope },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    criteria: parseFilterCriteria(r.criteria, keys),
    isDefault: r.isDefault,
  }));
}

export interface SaveFilterInput {
  scope: FilterScope;
  name: string;
  criteria: FilterCriteria;
  isDefault: boolean;
}

export async function saveSavedFilter(
  ctx: RequestContext,
  input: SaveFilterInput,
): Promise<Result<{ id: string }>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    // Nur ein Standard je Nutzer **und Fläche**: bestehenden vor dem Upsert
    // zurücksetzen. In derselben Transaktion, also atomar.
    if (input.isDefault) {
      await tx.savedFilter.updateMany({
        where: {
          tenantId: mctx.tenantId,
          userId: mctx.actorId,
          scope: input.scope,
          isDefault: true,
        },
        data: { isDefault: false },
      });
    }
    // Upsert **per Name**: ein zweites Speichern unter demselben Namen
    // überschreibt still. Das war vorher so und bleibt es — ein „überschreiben?"
    // gibt es an keiner der beiden Flächen.
    const saved = await tx.savedFilter.upsert({
      where: {
        tenantId_userId_scope_name: {
          tenantId: mctx.tenantId,
          userId: mctx.actorId,
          scope: input.scope,
          name: input.name,
        },
      },
      create: {
        tenantId: mctx.tenantId,
        userId: mctx.actorId,
        scope: input.scope,
        name: input.name,
        criteria: input.criteria as unknown as Prisma.InputJsonValue,
        isDefault: input.isDefault,
      },
      update: {
        criteria: input.criteria as unknown as Prisma.InputJsonValue,
        isDefault: input.isDefault,
      },
    });
    return ok({
      result: { id: saved.id },
      audit: {
        action: AUDIT_ACTION[input.scope].saved,
        resourceType: "saved_portfolio_filter",
        resourceId: saved.id,
      },
    });
  });
}

export async function deleteSavedFilter(
  ctx: RequestContext,
  input: { id: string; scope: FilterScope },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    // Der Besitz-Check **ist** die Berechtigung: eine fremde Zeile sieht aus wie
    // eine, die es nicht gibt.
    const existing = await tx.savedFilter.findFirst({
      where: { id: input.id, tenantId: mctx.tenantId, userId: mctx.actorId },
    });
    if (!existing) {
      return err({
        kind: "not_found" as const,
        resourceType: "SavedFilter",
        id: input.id,
      });
    }
    await tx.savedFilter.delete({ where: { id: input.id } });
    return ok({
      result: undefined,
      audit: {
        action: AUDIT_ACTION[input.scope].deleted,
        resourceType: "saved_portfolio_filter",
        resourceId: input.id,
      },
    });
  });
}
