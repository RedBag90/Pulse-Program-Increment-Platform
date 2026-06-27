import type { PrismaClient } from "@/generated/prisma";
import type { OutboxEventType } from "@/server/events/publish";

export const MAX_ATTEMPTS = 5;

/**
 * Returns delay in ms before the next retry using exponential backoff:
 * attempt 1 → 30s, 2 → 2m, 3 → 8m, 4 → 32m, 5 → permanent failure
 */
export function backoffMs(attempt: number): number {
  return Math.pow(4, attempt - 1) * 30_000;
}

export type OutboxHandler = (payload: unknown) => Promise<void>;

/**
 * Handler registry — must cover **every** `OutboxEventType` derived from
 * `OUTBOX_ROUTES`. The exhaustiveness is enforced at the call site (the cron
 * route): adding a new outbox type without a handler is a compile error, not
 * a silent run-time skip.
 */
export type OutboxHandlerRegistry = Record<OutboxEventType, OutboxHandler>;

/** @deprecated Use `OutboxHandler` directly. Kept for one release of the
 *  integration handlers (`OutboxHandlerMap[string]` pattern). */
export type OutboxHandlerMap = Record<string, OutboxHandler>;

/**
 * Processes up to `batchSize` pending outbox events. Each event is handled
 * by the matching entry in `handlers`. An event with no registered handler
 * is reported to Sentry as `unknown type` (it should be impossible given the
 * exhaustive registry, but a stale event row from a renamed type would hit
 * this path — better loud than silent). On failure the event is retried with
 * exponential backoff; after MAX_ATTEMPTS it is marked "failed" and Sentry
 * is notified.
 */
export async function processOutbox(
  db: PrismaClient,
  handlers: OutboxHandlerRegistry,
  batchSize = 50,
): Promise<{ processed: number; failed: number; skipped: number }> {
  const now = new Date();

  const events = await db.outboxEvent.findMany({
    where: {
      status: "pending",
      createdAt: { lte: now },
    },
    orderBy: { createdAt: "asc" },
    take: batchSize,
  });

  let processed = 0;
  let failed = 0;
  let skipped = 0;

  for (const event of events) {
    const handler = handlers[event.type as OutboxEventType];
    if (!handler) {
      skipped++;
      await reportUnknownType(event.id, event.type);
      continue;
    }

    try {
      await handler(event.payload);
      await db.outboxEvent.update({
        where: { id: event.id },
        data: { status: "processed", processedAt: new Date() },
      });
      processed++;
    } catch (err) {
      const nextAttempt = event.attempts + 1;
      const permanent = nextAttempt >= MAX_ATTEMPTS;

      await db.outboxEvent.update({
        where: { id: event.id },
        data: {
          attempts: nextAttempt,
          status: permanent ? "failed" : "pending",
          lastError: err instanceof Error ? err.message : String(err),
          // Reschedule by advancing createdAt so the event sorts after new events
          // and is only picked up again after the backoff window has elapsed.
          ...(!permanent && {
            createdAt: new Date(Date.now() + backoffMs(nextAttempt)),
          }),
        },
      });

      if (permanent) {
        failed++;
        await reportPermanentFailure(event.id, event.type, err);
      }
    }
  }

  return { processed, failed, skipped };
}

async function reportPermanentFailure(id: string, type: string, err: unknown): Promise<void> {
  const message = `[outbox] event ${id} (type=${type}) permanently failed after ${MAX_ATTEMPTS} attempts`;

  // Use Sentry if available in the runtime; fall back to console.error so
  // this module remains usable without the Sentry SDK being fully configured.
  try {
    const Sentry = await import("@sentry/nextjs");
    Sentry.captureException(err instanceof Error ? err : new Error(String(err)), {
      extra: { outboxEventId: id, outboxEventType: type },
    });
  } catch {
    // Sentry not available or not configured — log to stderr as fallback
    process.stderr.write(`${message}: ${String(err)}\n`);
  }
}

/**
 * A row whose `type` no handler accepts. Should be impossible given the
 * exhaustive registry — but if a type is renamed in code while pending rows
 * still carry the old name, this is where we notice. Always Sentry-loud.
 */
async function reportUnknownType(id: string, type: string): Promise<void> {
  const message = `[outbox] event ${id} has unknown type "${type}" — no handler registered`;
  try {
    const Sentry = await import("@sentry/nextjs");
    Sentry.captureMessage(message, { level: "warning", extra: { outboxEventId: id, type } });
  } catch {
    process.stderr.write(`${message}\n`);
  }
}
