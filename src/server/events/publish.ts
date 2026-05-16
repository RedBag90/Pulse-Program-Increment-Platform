import type { PrismaClient } from "@/generated/prisma";
import type { DomainEvent } from "./types";

/**
 * The single source of truth for how domain events map to outbox targets.
 * Every key must correspond to a DomainEvent["type"] — enforced via `satisfies`.
 * The OutboxEventType union is derived from this constant, so the compiler
 * requires every outbox type to have a registered handler in the cron route.
 */
export const OUTBOX_ROUTES = {
  "story.created": ["jira.story.created", "ado.story.created"],
  "impediment.escalated": ["notification.impediment.escalated"],
  "user.invited": ["email.user.invited"],
} satisfies Record<DomainEvent["type"], string[]>;

/** Union of all outbox event type strings derived from OUTBOX_ROUTES. */
export type OutboxEventType = (typeof OUTBOX_ROUTES)[keyof typeof OUTBOX_ROUTES][number];

function route(event: DomainEvent): Array<{ type: OutboxEventType; payload: unknown }> {
  switch (event.type) {
    case "story.created":
      return [
        { type: "jira.story.created", payload: event },
        { type: "ado.story.created", payload: event },
      ];
    case "impediment.escalated":
      return [{ type: "notification.impediment.escalated", payload: event }];
    case "user.invited":
      return [{ type: "email.user.invited", payload: event }];
    default: {
      const _exhaustive: never = event;
      throw new Error(`Unhandled domain event: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

/**
 * Publishes a domain event as one or more OutboxEvent rows within the
 * caller's transaction. The cron processor routes rows to their targets.
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
}
