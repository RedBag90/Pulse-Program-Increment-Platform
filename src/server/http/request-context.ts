import { headers } from "next/headers";
import { requirePrincipal, type Principal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import type { PrismaClient } from "@/generated/prisma";
import { extractRequestMeta } from "@/server/audit/emit";

// ---------------------------------------------------------------------------
// Shared RequestContext shape.
// ---------------------------------------------------------------------------

/**
 * The context every service call receives once the request has been
 * authenticated. `ipAddress`/`userAgent` are populated for mutations (audit
 * trail) and omitted for read-only handlers.
 */
export interface RequestContext {
  principal: Principal;
  db: PrismaClient;
  ipAddress?: string;
  userAgent?: string;
}

export interface BuildOptions {
  /**
   * When false, the IP/UA fields are omitted from the context. Reads don't
   * write audit events, so they don't need them. Defaults to `true`.
   */
  includeRequestMeta?: boolean;
}

/**
 * Builds a RequestContext from the inbound request: resolves the principal,
 * pulls IP/UA from the headers (unless suppressed), and constructs the
 * tenant-scoped Prisma client.
 *
 * Returns `null` when the principal cannot be resolved (no session) — every
 * caller surfaces a different 401-equivalent shape (`{ error: ... }` from
 * server actions, `unauthorized()` Response from route handlers), so the
 * factory keeps that mapping rather than embedding it here.
 *
 * The three HTTP factories (`createServerAction`, `createMutationHandler`,
 * `createQueryHandler`) all open with the same auth-and-Prisma dance; this
 * module concentrates that opening so a Prisma-client option (RLS context,
 * trace id, region) lands in one place rather than three.
 */
export async function buildRequestContext(
  options: BuildOptions = {},
): Promise<RequestContext | null> {
  const { includeRequestMeta = true } = options;

  const principal = await requirePrincipal().catch(() => null);
  if (!principal) return null;

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  if (!includeRequestMeta) {
    return { principal, db };
  }

  const { ipAddress, userAgent } = extractRequestMeta(await headers());
  return {
    principal,
    db,
    ...(ipAddress !== undefined && { ipAddress }),
    ...(userAgent !== undefined && { userAgent }),
  };
}
