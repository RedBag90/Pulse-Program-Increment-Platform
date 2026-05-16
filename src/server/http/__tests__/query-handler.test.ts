import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import { createQueryHandler } from "@/server/http/query-handler";
import type { PrismaClient } from "@/generated/prisma";

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

const mockRequirePrincipal = vi.fn();
vi.mock("@/server/auth/principal", () => ({ requirePrincipal: () => mockRequirePrincipal() }));

const mockAuthorize = vi.fn();
vi.mock("@/server/auth/authorize", () => ({
  authorize: (...args: unknown[]) => mockAuthorize(...args),
}));

const mockDb = {} as PrismaClient;
const mockCreatePrismaClient = vi.fn().mockReturnValue(mockDb);
vi.mock("@/server/db/prisma", () => ({
  createPrismaClient: (...args: unknown[]) => mockCreatePrismaClient(...args),
}));

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const fakePrincipal = {
  id: "user-1",
  tenantId: "tenant-1",
  email: "test@example.com",
  scopes: { artIds: [], teamIds: [], valueStreamIds: [] },
};

function makeRequest(searchParams?: Record<string, string>) {
  const url = new URL("http://localhost/api/v1/test");
  if (searchParams) {
    for (const [k, v] of Object.entries(searchParams)) {
      url.searchParams.set(k, v);
    }
  }
  return new Request(url.toString());
}

function makeCtx(routeParams?: Record<string, string>) {
  return routeParams ? { params: Promise.resolve(routeParams) } : undefined;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequirePrincipal.mockResolvedValue(fakePrincipal);
  mockAuthorize.mockReturnValue({ allow: true });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("createQueryHandler — auth", () => {
  it("returns 401 when requirePrincipal throws", async () => {
    mockRequirePrincipal.mockRejectedValue(new Error("no session"));
    const handler = createQueryHandler({ query: async () => ({ ok: true }) });
    const res = await handler(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns 401 when requirePrincipal returns null", async () => {
    mockRequirePrincipal.mockResolvedValue(null);
    const handler = createQueryHandler({ query: async () => ({ ok: true }) });
    const res = await handler(makeRequest());
    expect(res.status).toBe(401);
  });

  it("401 response includes problem+json content type", async () => {
    mockRequirePrincipal.mockRejectedValue(new Error("no session"));
    const handler = createQueryHandler({ query: async () => ({}) });
    const res = await handler(makeRequest());
    expect(res.headers.get("content-type")).toContain("problem+json");
  });
});

describe("createQueryHandler — params validation", () => {
  const paramsSchema = z.object({ artId: z.string().uuid() });

  it("returns 422 when required searchParam is missing", async () => {
    const handler = createQueryHandler({
      params: paramsSchema,
      query: async () => [],
    });
    const res = await handler(makeRequest()); // no artId
    expect(res.status).toBe(422);
  });

  it("returns 422 when searchParam fails Zod validation", async () => {
    const handler = createQueryHandler({
      params: paramsSchema,
      query: async () => [],
    });
    const res = await handler(makeRequest({ artId: "not-a-uuid" }));
    expect(res.status).toBe(422);
  });

  it("passes validated params to query function", async () => {
    const query = vi.fn().mockResolvedValue([]);
    const handler = createQueryHandler({ params: paramsSchema, query });
    const validUuid = "550e8400-e29b-41d4-a716-446655440000";
    await handler(makeRequest({ artId: validUuid }));
    expect(query).toHaveBeenCalledWith(
      expect.objectContaining({ principal: fakePrincipal, db: mockDb }),
      { artId: validUuid },
    );
  });

  it("merges route params and searchParams before validation", async () => {
    const schema = z.object({ id: z.string().uuid(), page: z.coerce.number().default(1) });
    const query = vi.fn().mockResolvedValue({});
    const handler = createQueryHandler({ params: schema, query });
    const id = "550e8400-e29b-41d4-a716-446655440001";
    await handler(makeRequest({ page: "3" }), makeCtx({ id }));
    expect(query).toHaveBeenCalledWith(expect.anything(), { id, page: 3 });
  });
});

describe("createQueryHandler — authorization", () => {
  it("calls authorize when readAction is provided", async () => {
    const handler = createQueryHandler({
      readAction: "admin.audit-log.read",
      resource: (_p, principal) => ({ tenantId: principal.tenantId }),
      query: async () => [],
    });
    await handler(makeRequest());
    expect(mockAuthorize).toHaveBeenCalledWith(
      "admin.audit-log.read",
      { tenantId: "tenant-1" },
      fakePrincipal,
    );
  });

  it("returns 403 when readAction is denied", async () => {
    mockAuthorize.mockReturnValue({ allow: false, reason: "admin only" });
    const handler = createQueryHandler({
      readAction: "admin.audit-log.read",
      resource: (_p, principal) => ({ tenantId: principal.tenantId }),
      query: async () => [],
    });
    const res = await handler(makeRequest());
    expect(res.status).toBe(403);
  });

  it("does not call authorize when readAction is absent", async () => {
    const handler = createQueryHandler({ query: async () => [] });
    await handler(makeRequest());
    expect(mockAuthorize).not.toHaveBeenCalled();
  });
});

describe("createQueryHandler — query results", () => {
  it("returns 200 with JSON body when query returns a value", async () => {
    const data = [{ id: "1", name: "ART Alpha" }];
    const handler = createQueryHandler({ query: async () => data });
    const res = await handler(makeRequest());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(data);
  });

  it("returns 404 when query returns null", async () => {
    const handler = createQueryHandler({ query: async () => null });
    const res = await handler(makeRequest());
    expect(res.status).toBe(404);
  });

  it("passes principal and db from context to query", async () => {
    const query = vi.fn().mockResolvedValue({});
    const handler = createQueryHandler({ query });
    await handler(makeRequest());
    expect(query).toHaveBeenCalledWith({ principal: fakePrincipal, db: mockDb }, expect.anything());
  });

  it("creates PrismaClient with principal userId and tenantId", async () => {
    const handler = createQueryHandler({ query: async () => ({ ok: true }) });
    await handler(makeRequest());
    expect(mockCreatePrismaClient).toHaveBeenCalledWith({
      userId: fakePrincipal.id,
      tenantId: fakePrincipal.tenantId,
    });
  });
});
