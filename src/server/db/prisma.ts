import { PrismaClient } from "@/generated/prisma";

// Vercel–Supabase-Integration liefert die Connection-Strings als
// POSTGRES_PRISMA_URL / POSTGRES_URL_NON_POOLING statt der von Prisma
// erwarteten DATABASE_URL / DIRECT_URL. Hier gemappt, damit ohne manuelles
// Kopieren der Env-Vars deployt werden kann (und robust gegen Passwort-Rotation
// der Integration). Läuft im Node-Runtime VOR jeder PrismaClient-Instanziierung;
// lokal ist DATABASE_URL bereits gesetzt → No-op. Die Edge-Middleware importiert
// dieses Modul nicht, ist also nicht betroffen.
process.env.DATABASE_URL ||= process.env.POSTGRES_PRISMA_URL;
process.env.DIRECT_URL ||= process.env.POSTGRES_URL_NON_POOLING;

// ---------------------------------------------------------------------------
// Singleton base client — one connection pool per process
// ---------------------------------------------------------------------------

declare global {
  var __prisma: PrismaClient | undefined;
}

function makeClient(): PrismaClient {
  // Opt-in Query-Logging via PRISMA_DEBUG=1 — laesst N+1 sofort sehen.
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
  return client;
}

// EIN PrismaClient (= ein Connection-Pool) pro Prozess/Lambda-Instanz — über
// `globalThis` in ALLEN Umgebungen. In Serverless überlebt globalThis die
// Invocations einer warmen Instanz; früher gab Production bei jedem Aufruf einen
// neuen Pool zurück → Connection-Leak bis zum Pooler-Limit (EMAXCONN). In Dev
// überlebt der Singleton zusätzlich HMR-Reloads.
function getBaseClient(): PrismaClient {
  globalThis.__prisma ??= makeClient();
  return globalThis.__prisma;
}

// ---------------------------------------------------------------------------
// Per-request client
//
// Returns the shared base client. Tenant isolation is enforced at the
// APPLICATION layer — every service scopes its queries by `tenantId` in the
// `where` clause, plus the platform-admin gate — NOT by Postgres RLS: the
// policies in `prisma/sql/rls.sql` read `request.jwt.claims`, but RLS is only
// ENABLE'd (not FORCE'd) and the app connects as the table owner, so it bypasses
// non-forced RLS and the policies never actually gate this connection.
//
// This function used to wrap EVERY operation in `$transaction([SET set_config(
// 'request.jwt.claims'), query])` to publish the JWT claim. That claim is inert
// given owner-bypass, but the wrapper turned each read into a multi-statement
// transaction (2-4 network round-trips) and defeated pgBouncer statement pooling
// — a large TTFB cost against the cross-region pooler. Removed for performance;
// the `ctx` is now only a (kept) signature for callers.
//
// ⚠ If Postgres RLS is ever hardened (FORCE ROW LEVEL SECURITY + a non-owner app
// role), the per-request `request.jwt.claims` mechanism MUST be restored (e.g. an
// interactive transaction spanning the whole request) or every read returns empty.
// ---------------------------------------------------------------------------

export interface PrismaContext {
  userId: string;
  tenantId: string;
}

export function createPrismaClient(_ctx: PrismaContext): PrismaClient {
  return getBaseClient();
}
