import { describe, it, expect, vi, beforeEach } from "vitest";
import { emitAuditEvent, extractRequestMeta } from "@/server/audit/emit";
import type { AuditEventInput } from "@/server/audit/emit";
import type { TenantId, UserId } from "@/domain/types";

// ---------------------------------------------------------------------------
// Mock Prisma db
// ---------------------------------------------------------------------------

const mockCreate = vi.fn().mockResolvedValue({ id: "audit-id-1" });
const mockDb = {
  auditEvent: { create: mockCreate },
} as unknown as Parameters<typeof emitAuditEvent>[0];

const baseTenantId = "11111111-1111-1111-1111-111111111111" as TenantId;
const baseActorId = "22222222-2222-2222-2222-222222222222" as UserId;

const baseInput: AuditEventInput = {
  tenantId: baseTenantId,
  actorId: baseActorId,
  action: "initiative.created",
  resourceType: "initiative",
  resourceId: "33333333-3333-3333-3333-333333333333",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("emitAuditEvent", () => {
  it("calls auditEvent.create with the correct fields", async () => {
    await emitAuditEvent(mockDb, baseInput);
    expect(mockCreate).toHaveBeenCalledOnce();
    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: baseTenantId,
        actorId: baseActorId,
        action: "initiative.created",
        resourceType: "initiative",
        resourceId: baseInput.resourceId,
      }),
    });
  });

  it("always sets a non-empty traceId, even when none is provided", async () => {
    await emitAuditEvent(mockDb, baseInput);
    const call = mockCreate.mock.calls[0]?.[0];
    expect(typeof call?.data.traceId).toBe("string");
    expect(call?.data.traceId.length).toBeGreaterThan(0);
  });

  it("includes changes when provided", async () => {
    await emitAuditEvent(mockDb, {
      ...baseInput,
      changes: { title: { before: "Old", after: "New" } },
    });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          changes: { title: { before: "Old", after: "New" } },
        }),
      }),
    );
  });

  it("includes traceId and request metadata when provided", async () => {
    await emitAuditEvent(mockDb, {
      ...baseInput,
      traceId: "trace-abc-123",
      ipAddress: "10.0.0.1",
      userAgent: "Mozilla/5.0",
    });
    const call = mockCreate.mock.calls[0]?.[0];
    expect(call?.data.traceId).toBe("trace-abc-123");
    expect(call?.data.ipAddress).toBe("10.0.0.1");
    expect(call?.data.userAgent).toBe("Mozilla/5.0");
  });
});

describe("extractRequestMeta", () => {
  function makeHeaders(entries: Record<string, string>) {
    return {
      get: (name: string) => entries[name] ?? null,
    } as Parameters<typeof extractRequestMeta>[0];
  }

  it("extracts IP from x-forwarded-for (first entry only)", () => {
    const result = extractRequestMeta(makeHeaders({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }));
    expect(result.ipAddress).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", () => {
    const result = extractRequestMeta(makeHeaders({ "x-real-ip": "9.9.9.9" }));
    expect(result.ipAddress).toBe("9.9.9.9");
  });

  it("returns undefined when no IP headers present", () => {
    const result = extractRequestMeta(makeHeaders({}));
    expect(result.ipAddress).toBeUndefined();
  });

  it("extracts user-agent", () => {
    const result = extractRequestMeta(makeHeaders({ "user-agent": "TestBot/1.0" }));
    expect(result.userAgent).toBe("TestBot/1.0");
  });
});
