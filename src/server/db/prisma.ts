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
  // Opt-in Query-Logging via PRISMA_DEBUG=1 — laesst N+1 sofort sehen.
  if (!globalThis.__prisma) {
    const debug = process.env.PRISMA_DEBUG === "1";
    const client = debug
      ? new PrismaClient({ log: [{ emit: "event", level: "query" }] })
      : new PrismaClient();
    if (debug) {
      let count = 0;
      let windowStart = Date.now();
      (
        client as unknown as {
          $on: (e: string, cb: (q: { query: string; duration: number }) => void) => void;
        }
      ).$on("query", (q) => {
        const now = Date.now();
        if (now - windowStart > 1000) {
          windowStart = now;
          count = 0;
        }
        count++;
        // eslint-disable-next-line no-console
        console.log(`[prisma #${count}] ${q.duration}ms · ${q.query.slice(0, 120)}`);
      });
    }
    globalThis.__prisma = client;
  }
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
