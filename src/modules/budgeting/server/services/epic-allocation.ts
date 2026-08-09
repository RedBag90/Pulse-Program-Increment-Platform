import type { PrismaClient } from "@/generated/prisma";
import type { TenantId, EpicId } from "@/modules/core/kernel/domain/types";

/**
 * The Epic's budget-allocation summary. Budgeting owns the `budgetAllocation`
 * table; the Epic route consumes this via a port so Work never reads it directly
 * (ADR-0013). `allocatedSum` is the total of the per-period allocations — the
 * Reifegrad sub-header shows "Budget alloziert" when it is > 0.
 */
export async function getEpicBudgetAllocation(
  db: PrismaClient,
  tenantId: TenantId,
  epicId: EpicId,
): Promise<{ allocatedSum: number } | null> {
  const row = await db.budgetAllocation.findUnique({
    where: { epicId },
    select: { allocations: true, tenantId: true },
  });
  // Tenant-scope defensively — findUnique is by epicId (globally unique), so a
  // cross-tenant epicId must not leak an allocation.
  if (!row || row.tenantId !== tenantId) return null;
  const allocatedSum = Object.values(
    (row.allocations ?? {}) as Record<string, unknown>,
  ).reduce<number>((s, v) => s + (typeof v === "number" ? v : 0), 0);
  return { allocatedSum };
}
