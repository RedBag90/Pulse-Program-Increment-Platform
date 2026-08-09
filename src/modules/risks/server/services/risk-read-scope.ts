import type { Prisma } from "@/generated/prisma";
import type { Principal } from "@/server/auth/principal";

/**
 * Read-visibility rule for risks (decision: scoped by Epic/VS). Managers
 * (portfolio_manager / tenant_admin / platform_admin) and empty-scope principals
 * ("all in reach", per the platform convention) see every risk; everyone else
 * sees risks linked to an Epic in their value-stream scope, plus risks they own
 * or raised. Returns a `Prisma.RiskWhereInput` fragment the loaders `AND` in.
 */
export function riskReadFilter(principal: Principal): Prisma.RiskWhereInput {
  const vs = principal.scopes.valueStreamIds;
  const managerLike =
    principal.isPlatformAdmin ||
    principal.roles.includes("tenant_admin") ||
    principal.roles.includes("portfolio_manager") ||
    vs.length === 0;
  if (managerLike) return {};
  return {
    OR: [
      { epicLinks: { some: { epic: { valueStreamId: { in: vs } } } } },
      { ownerId: principal.id },
      { raisedBy: principal.id },
    ],
  };
}
