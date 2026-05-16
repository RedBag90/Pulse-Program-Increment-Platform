import { describe, it, expect } from "vitest";
import { OUTBOX_ROUTES } from "@/server/events/publish";
import type { DomainEvent } from "@/server/events/types";

// Compile-time check: if any DomainEvent type is missing from OUTBOX_ROUTES, this line fails.
type _Exhaustive =
  Exclude<DomainEvent["type"], keyof typeof OUTBOX_ROUTES> extends never ? true : never;
const _: _Exhaustive = true;

describe("OUTBOX_ROUTES", () => {
  it("covers all DomainEvent types", () => {
    const routedTypes = Object.keys(OUTBOX_ROUTES);
    const domainEventTypes: DomainEvent["type"][] = [
      "story.created",
      "impediment.escalated",
      "user.invited",
    ];
    for (const type of domainEventTypes) {
      expect(routedTypes).toContain(type);
    }
  });

  it("each event type routes to at least one handler", () => {
    for (const [type, handlers] of Object.entries(OUTBOX_ROUTES)) {
      expect(handlers.length, `${type} must route to at least one handler`).toBeGreaterThan(0);
    }
  });
});
