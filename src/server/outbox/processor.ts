import type { PrismaClient } from "@/generated/prisma";

export const MAX_ATTEMPTS = 5;

/**
 * Returns delay in ms before the next retry using exponential backoff:
 * attempt 1 → 30s, 2 → 2m, 3 → 8m, 4 → 32m, 5 → permanent failure
 */
export function backoffMs(attempt: number): number {
  return Math.pow(4, attempt - 1) * 30_000;
}

export interface OutboxHandlerMap {
  [type: string]: (payload: unknown) => Promise<void>;
}

/**
 * Processes up to `batchSize` pending outbox events. Each event is handled
 * by the matching entry in `handlers`. Unknown types are skipped (logged to
 * Sentry if available). On failure the event is retried with exponential
 * backoff; after MAX_ATTEMPTS it is marked "failed" and Sentry is notified.
 */
export async function processOutbox(
  db: PrismaClient,
  handlers: OutboxHandlerMap,
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
    const handler = handlers[event.type];
    if (!handler) {
      skipped++;
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
