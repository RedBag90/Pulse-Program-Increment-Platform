import { after } from "next/server";
import type { PrismaClient } from "@/generated/prisma";
import type { DomainEvent } from "./types";

/**
 * The single source of truth for how domain events map to outbox targets.
 * Every key must correspond to a DomainEvent["type"] — enforced via `satisfies`.
 * The OutboxEventType union is derived from this constant, so the compiler
 * requires every outbox type to have a registered handler in the cron route.
 */
export const OUTBOX_ROUTES = {
  "user.invited": ["email.user.invited"],
} satisfies Record<DomainEvent["type"], string[]>;

/** Union of all outbox event type strings derived from OUTBOX_ROUTES. */
export type OutboxEventType = (typeof OUTBOX_ROUTES)[keyof typeof OUTBOX_ROUTES][number];

function route(event: DomainEvent): Array<{ type: OutboxEventType; payload: unknown }> {
  // Erschöpfend über `DomainEvent["type"]`: kommt ein neuer Event-Typ hinzu,
  // fehlt hier ein `case` und TS meldet „not all code paths return".
  switch (event.type) {
    case "user.invited":
      return [{ type: "email.user.invited", payload: event }];
  }
}

/**
 * Publishes a domain event as one or more OutboxEvent rows within the
 * caller's transaction, then schedules a **post-response** drain of the outbox
 * so delivery is near-instant without a minute-level cron (Vercel Hobby erlaubt
 * nur einen täglichen Cron, der als Sicherheitsnetz bleibt).
 *
 * `after()` läuft nach dem Response (also nach Commit dieser Transaktion); bei
 * Rollback sind die Rows nicht committed und der Drain findet nichts. Der Drain
 * nutzt seinen eigenen System-Client, nicht die aufrufende `db`-Transaktion.
 */
export async function publishDomainEvent(
  db: Pick<PrismaClient, "outboxEvent">,
  event: DomainEvent,
): Promise<void> {
  const targets = route(event);
  await db.outboxEvent.createMany({
    data: targets.map((t) => ({
      tenantId: event.tenantId,
      type: t.type,
      payload: t.payload as never,
    })),
  });
  scheduleOutboxDrain();
}

/**
 * Plant das Leeren der Outbox nach dem Response. Lazy-Import von `runOutbox`,
 * damit die Handler-/Integrations-Dependencies nicht in jedes Modul gezogen
 * werden, das Events publiziert. Ohne Request-Scope (Unit-Tests/Skripte) wirft
 * `after()` — dann übernimmt der tägliche Cron (Fehler wird geschluckt).
 */
function scheduleOutboxDrain(): void {
  try {
    after(async () => {
      const { runOutbox } = await import("@/server/outbox/run");
      await runOutbox().catch(() => {});
    });
  } catch {
    // Kein Request-Scope verfügbar — der Sicherheitsnetz-Cron holt es nach.
  }
}
