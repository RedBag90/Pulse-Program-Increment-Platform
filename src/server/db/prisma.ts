import { PrismaClient } from "@/generated/prisma";

// ---------------------------------------------------------------------------
// Singleton base client — one connection pool per process
// ---------------------------------------------------------------------------

declare global {
  var __prisma: PrismaClient | undefined;
}

function getBaseClient(): PrismaClient {
  if (process.env.NODE_ENV === "production") {
    return new PrismaClient();
  }
  // In development, reuse across hot reloads to avoid pool exhaustion.
  globalThis.__prisma ??= new PrismaClient();
  return globalThis.__prisma;
}

// ---------------------------------------------------------------------------
// Per-request RLS-aware client
//
// Sets `request.jwt.claims` as a transaction-local PostgreSQL setting so that
// Supabase RLS policies can read `auth.jwt() ->> 'tenant_id'` and `auth.uid()`.
// Each operation wraps its query in a SET + query sequence within a transaction.
// ---------------------------------------------------------------------------

export interface PrismaContext {
  userId: string;
  tenantId: string;
}

export function createPrismaClient(ctx: PrismaContext): PrismaClient {
  const base = getBaseClient();
  const claims = JSON.stringify({ sub: ctx.userId, tenant_id: ctx.tenantId });

  return base.$extends({
    query: {
      async $allOperations({ args, query }) {
        const [, result] = await base.$transaction([
          base.$executeRaw`SELECT set_config('request.jwt.claims', ${claims}, true)`,
          query(args) as ReturnType<typeof query>,
        ]);
        return result;
      },
    },
  }) as unknown as PrismaClient;
}
