import type { PrismaClient, Prisma } from "@/generated/prisma";
import type { Principal } from "@/server/auth/principal";
import type { RequestContext } from "@/server/http/mutation-handler";
import { withAuditedTransaction, toMutationContext } from "@/modules/core/kernel/server/mutation";
import type { Result } from "@/modules/core/kernel/domain/errors";
import { ok, err } from "@/modules/core/kernel/domain/errors";

/**
 * Per-User gespeicherte Portfolio-Filter. Tenant+User-scoped; die vier Filter-
 * Dimensionen liegen als JSON-`criteria`. Genau ein `isDefault` je Nutzer wird
 * beim bloßen Öffnen von /portfolio automatisch angewandt.
 */
export interface SavedFilterCriteria {
  vs: string[];
  gate: string[];
  status: string[];
  owner: string[];
}

export interface SavedPortfolioFilterDTO {
  id: string;
  name: string;
  criteria: SavedFilterCriteria;
  isDefault: boolean;
}

/** Tolerant: liest die vier String-Arrays aus dem JSON-Blob, verwirft Fremdes. */
export function parseSavedFilterCriteria(json: unknown): SavedFilterCriteria {
  const c = (json ?? {}) as Record<string, unknown>;
  const arr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  return { vs: arr(c.vs), gate: arr(c.gate), status: arr(c.status), owner: arr(c.owner) };
}

export async function listSavedPortfolioFilters(
  db: PrismaClient,
  principal: Principal,
): Promise<SavedPortfolioFilterDTO[]> {
  const rows = await db.savedPortfolioFilter.findMany({
    where: { tenantId: principal.tenantId, userId: principal.id },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    criteria: parseSavedFilterCriteria(r.criteria),
    isDefault: r.isDefault,
  }));
}

export interface SaveFilterInput {
  name: string;
  criteria: SavedFilterCriteria;
  isDefault: boolean;
}

export async function saveSavedPortfolioFilter(
  ctx: RequestContext,
  input: SaveFilterInput,
): Promise<Result<{ id: string }>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    // Nur ein Standard je Nutzer: bestehenden vor dem Upsert zurücksetzen.
    if (input.isDefault) {
      await tx.savedPortfolioFilter.updateMany({
        where: { tenantId: mctx.tenantId, userId: mctx.actorId, isDefault: true },
        data: { isDefault: false },
      });
    }
    const saved = await tx.savedPortfolioFilter.upsert({
      where: {
        tenantId_userId_name: {
          tenantId: mctx.tenantId,
          userId: mctx.actorId,
          name: input.name,
        },
      },
      create: {
        tenantId: mctx.tenantId,
        userId: mctx.actorId,
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
        action: "portfolio_filter.saved",
        resourceType: "saved_portfolio_filter",
        resourceId: saved.id,
      },
    });
  });
}

export async function deleteSavedPortfolioFilter(
  ctx: RequestContext,
  input: { id: string },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    const existing = await tx.savedPortfolioFilter.findFirst({
      where: { id: input.id, tenantId: mctx.tenantId, userId: mctx.actorId },
    });
    if (!existing) {
      return err({ kind: "not_found" as const, resourceType: "SavedPortfolioFilter", id: input.id });
    }
    await tx.savedPortfolioFilter.delete({ where: { id: input.id } });
    return ok({
      result: undefined,
      audit: {
        action: "portfolio_filter.deleted",
        resourceType: "saved_portfolio_filter",
        resourceId: input.id,
      },
    });
  });
}
