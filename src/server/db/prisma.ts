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

/**
 * Schalter für die RLS-Vorbereitung. **Standardmäßig aus.**
 *
 * Solange RLS nirgends erzwungen ist, wäre der Claim wirkungslos und würde nur
 * Ladezeit kosten. Er lässt sich damit einschalten, um genau diese Kosten zu
 * messen — und muss eingeschaltet sein, **bevor** `prisma/sql/rls-hardening.sql`
 * gefahren wird, sonst liefert jede Leseoperation leer.
 */
export const RLS_CLAIMS_ENABLED = process.env.PULSE_RLS_CLAIMS === "1";

export function createPrismaClient(ctx: PrismaContext): PrismaClient {
  const base = getBaseClient();
  if (!RLS_CLAIMS_ENABLED) return base;

  // Der Claim muss in **derselben** Transaktion gesetzt werden wie die Abfrage,
  // sonst ist er wirkungslos: `set_config(..., true)` gilt transaktionslokal.
  // Deshalb wird die Operation über den Transaktions-Client neu aufgerufen und
  // nicht über `query(args)` — das liefe außerhalb.
  return base.$extends({
    query: {
      async $allOperations({ model, operation, args, query }) {
        // Raw- und Transaktions-Operationen tragen kein Modell; sie laufen
        // unverändert durch. Ihre Aufrufer setzen den Claim selbst, wenn nötig.
        if (model == null) return query(args);
        return base.$transaction(async (tx) => {
          await tx.$executeRawUnsafe(
            `SELECT set_config('request.jwt.claims', $1, true)`,
            JSON.stringify({ tenant_id: ctx.tenantId, sub: ctx.userId }),
          );
          const delegate = (tx as unknown as Record<string, Record<string, unknown>>)[
            model.charAt(0).toLowerCase() + model.slice(1)
          ];
          const fn = delegate?.[operation];
          if (typeof fn !== "function") return query(args);
          return (fn as (a: unknown) => Promise<unknown>).call(delegate, args);
        });
      },
    },
  }) as unknown as PrismaClient;
}
