import { describe, it, expect, vi, beforeEach } from "vitest";
import { publishDomainEvent } from "@/server/events/publish";
import type { DomainEvent } from "@/server/events/types";
import type { TenantId, StoryId, ArtId, UserId } from "@/domain/types";
import type { ImpedimentId } from "@/server/services/impediment";
import type { Role } from "@/domain/roles";

const tenantId = "tenant-1" as TenantId;

const mockCreateMany = vi.fn().mockResolvedValue({ count: 2 });
const mockDb = { outboxEvent: { createMany: mockCreateMany } } as never;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("publishDomainEvent — story.created", () => {
  const storyEvent: DomainEvent = {
    type: "story.created",
    tenantId,
    storyId: "story-1" as StoryId,
    artId: "art-1" as ArtId,
    title: "Login story",
    description: null,
    storyPoints: 3,
  };

  it("calls createMany with exactly 2 outbox rows", async () => {
    await publishDomainEvent(mockDb, storyEvent);
    expect(mockCreateMany).toHaveBeenCalledOnce();
    const { data } = mockCreateMany.mock.calls[0]![0];
    expect(data).toHaveLength(2);
  });

  it("routes to jira.story.created and ado.story.created", async () => {
    await publishDomainEvent(mockDb, storyEvent);
    const { data } = mockCreateMany.mock.calls[0]![0];
    const types = data.map((r: { type: string }) => r.type);
    expect(types).toContain("jira.story.created");
    expect(types).toContain("ado.story.created");
  });

  it("includes tenantId on every row", async () => {
    await publishDomainEvent(mockDb, storyEvent);
    const { data } = mockCreateMany.mock.calls[0]![0];
    for (const row of data) {
      expect(row.tenantId).toBe(tenantId);
    }
  });
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
