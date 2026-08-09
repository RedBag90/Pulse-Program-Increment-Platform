import { describe, it, expect, vi, beforeEach } from "vitest";
import { publishDomainEvent } from "@/server/events/publish";
import type { DomainEvent } from "@/server/events/types";
import type { TenantId, ArtId, UserId } from "@/modules/core/kernel/domain/types";
import type { ImpedimentId } from "@/modules/core/kernel/domain/types";
import type { Role } from "@/modules/core/kernel/domain/roles";

const tenantId = "tenant-1" as TenantId;

const mockCreateMany = vi.fn().mockResolvedValue({ count: 2 });
const mockDb = { outboxEvent: { createMany: mockCreateMany } } as never;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("publishDomainEvent — impediment.escalated", () => {
  const event: DomainEvent = {
    type: "impediment.escalated",
    tenantId,
    impedimentId: "imp-1" as ImpedimentId,
    artId: "art-1" as ArtId,
    title: "CI is down",
    severity: "critical",
  };

  it("calls createMany with exactly 1 outbox row", async () => {
    await publishDomainEvent(mockDb, event);
    const { data } = mockCreateMany.mock.calls[0]![0];
    expect(data).toHaveLength(1);
  });

  it("routes to notification.impediment.escalated", async () => {
    await publishDomainEvent(mockDb, event);
    const { data } = mockCreateMany.mock.calls[0]![0];
    expect(data[0]!.type).toBe("notification.impediment.escalated");
  });
});

describe("publishDomainEvent — user.invited", () => {
  const event: DomainEvent = {
    type: "user.invited",
    tenantId,
    actorId: "actor-1" as UserId,
    inviteeEmail: "user@example.com",
    inviterEmail: "admin@example.com",
    tenantName: "Acme",
    role: "member" as Role,
    locale: "en",
    token: "jwt-token",
  };

  it("calls createMany with exactly 1 outbox row", async () => {
    await publishDomainEvent(mockDb, event);
    const { data } = mockCreateMany.mock.calls[0]![0];
    expect(data).toHaveLength(1);
  });

  it("routes to email.user.invited", async () => {
    await publishDomainEvent(mockDb, event);
    const { data } = mockCreateMany.mock.calls[0]![0];
    expect(data[0]!.type).toBe("email.user.invited");
  });
});
