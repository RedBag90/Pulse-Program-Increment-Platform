import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import { createMutationHandler } from "@/server/http/mutation-handler";
import { ok, err } from "@/domain/errors";
import type { PrismaClient } from "@/generated/prisma";

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue({ get: vi.fn().mockReturnValue(null) }),
}));

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

vi.mock("@/server/audit/emit", () => ({
  extractRequestMeta: vi.fn().mockReturnValue({ ipAddress: undefined, userAgent: undefined }),
}));

const mockWithIdempotency = vi.fn();
vi.mock("@/server/http/idempotency", () => ({
  withIdempotency: (...args: unknown[]) => mockWithIdempotency(...args),
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

const testSchema = z.object({ name: z.string().min(1) });

function makeHandler(overrides: Partial<Parameters<typeof createMutationHandler>[0]> = {}) {
  return createMutationHandler({
    schema: testSchema,
    action: "pi.create",
    resource: () => ({ tenantId: "tenant-1" }),
    service: vi.fn().mockResolvedValue(ok({ id: "new-id" })),
    idempotent: false,
    ...overrides,
  });
}

function makeRequest(body?: unknown, headers?: Record<string, string>) {
  const opts: RequestInit = { method: "POST" };
  if (body !== undefined) {
    opts.body = JSON.stringify(body);
    opts.headers = { "Content-Type": "application/json", ...headers };
  } else {
    opts.headers = headers ?? {};
  }
  return new Request("http://localhost/api/v1/test", opts);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequirePrincipal.mockResolvedValue(fakePrincipal);
  mockAuthorize.mockReturnValue({ allow: true });
  mockWithIdempotency.mockImplementation(
    (_req, _principal, execute: (r: Request) => Promise<Response>) => execute(_req as Request),
  );
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("createMutationHandler — auth", () => {
  it("returns 401 when no session exists", async () => {
    mockRequirePrincipal.mockRejectedValue(new Error("no session"));
    const res = await makeHandler()(makeRequest({ name: "PI 24.1" }));
    expect(res.status).toBe(401);
  });

  it("returns 401 when requirePrincipal returns null", async () => {
    mockRequirePrincipal.mockResolvedValue(null);
    const res = await makeHandler()(makeRequest({ name: "PI 24.1" }));
    expect(res.status).toBe(401);
  });
});

describe("createMutationHandler — body parsing", () => {
  it("returns 422 when body is not valid JSON", async () => {
    const req = new Request("http://localhost/api/v1/test", {
      method: "POST",
      body: "not-json{",
      headers: { "Content-Type": "application/json" },
    });
    const res = await makeHandler()(req);
    expect(res.status).toBe(422);
  });

  it("returns 422 when Zod validation fails", async () => {
    const res = await makeHandler()(makeRequest({ name: "" }));
    expect(res.status).toBe(422);
  });

  it("treats empty body as {}", async () => {
    const service = vi.fn().mockResolvedValue(ok({}));
    const handler = createMutationHandler({
      schema: z.object({}),
      action: "pi.create",
      resource: () => ({ tenantId: "tenant-1" }),
      service,
      idempotent: false,
    });
    const req = new Request("http://localhost/api/v1/test", { method: "POST" });
    const res = await handler(req);
    expect(res.status).toBe(201);
    expect(service).toHaveBeenCalledOnce();
  });
});

describe("createMutationHandler — authorization", () => {
  it("returns 403 when authorize denies", async () => {
    mockAuthorize.mockReturnValue({ allow: false, reason: "insufficient role" });
    const res = await makeHandler()(makeRequest({ name: "PI 24.1" }));
    expect(res.status).toBe(403);
  });

  it("passes the parsed input and principal to the resource extractor", async () => {
    const resource = vi.fn().mockReturnValue({ tenantId: "tenant-1" });
    await makeHandler({ resource })(makeRequest({ name: "PI 24.1" }));
    expect(resource).toHaveBeenCalledWith({ name: "PI 24.1" }, fakePrincipal);
  });
});

describe("createMutationHandler — service error mapping", () => {
  it("returns 404 when service returns not_found", async () => {
    const service = vi
      .fn()
      .mockResolvedValue(err({ kind: "not_found", resourceType: "ART", id: "x" }));
    const res = await makeHandler({ service })(makeRequest({ name: "PI 24.1" }));
    expect(res.status).toBe(404);
  });

  it("returns 409 when service returns conflict", async () => {
    const service = vi.fn().mockResolvedValue(err({ kind: "conflict", reason: "already exists" }));
    const res = await makeHandler({ service })(makeRequest({ name: "PI 24.1" }));
    expect(res.status).toBe(409);
  });

  it("returns 422 when service returns hierarchy_violation", async () => {
    const service = vi
      .fn()
      .mockResolvedValue(
        err({ kind: "hierarchy_violation", violatedConstraint: "depth", detail: "too deep" }),
      );
    const res = await makeHandler({ service })(makeRequest({ name: "PI 24.1" }));
    expect(res.status).toBe(422);
  });

  it("respects errorMap overrides", async () => {
    const service = vi.fn().mockResolvedValue(err({ kind: "conflict", reason: "dupe" }));
    const handler = createMutationHandler({
      schema: testSchema,
      action: "pi.create",
      resource: () => ({ tenantId: "tenant-1" }),
      service,
      idempotent: false,
      errorMap: { conflict: 422 },
    });
    const res = await handler(makeRequest({ name: "PI 24.1" }));
    expect(res.status).toBe(422);
  });
});

describe("createMutationHandler — success", () => {
  it("returns 201 with body on ok result (default POST)", async () => {
    const res = await makeHandler()(makeRequest({ name: "PI 24.1" }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual({ id: "new-id" });
  });

  it("returns 204 with no body when successStatus is 204", async () => {
    const handler = makeHandler({ successStatus: 204 });
    const res = await handler(makeRequest({ name: "PI 24.1" }));
    expect(res.status).toBe(204);
    expect(res.body).toBeNull();
  });

  it("returns 200 with body when successStatus is 200", async () => {
    const handler = makeHandler({ successStatus: 200 });
    const res = await handler(makeRequest({ name: "PI 24.1" }));
    expect(res.status).toBe(200);
  });
});

describe("createMutationHandler — idempotency", () => {
  it("delegates to withIdempotency when idempotent: true", async () => {
    const cachedResponse = Response.json({ id: "cached" }, { status: 201 });
    mockWithIdempotency.mockResolvedValue(cachedResponse);

    const handler = createMutationHandler({
      schema: testSchema,
      action: "pi.create",
      resource: () => ({ tenantId: "tenant-1" }),
      service: vi.fn().mockResolvedValue(ok({ id: "new-id" })),
      idempotent: true,
    });
    const res = await handler(makeRequest({ name: "PI 24.1" }, { "Idempotency-Key": "key-abc" }));
    expect(mockWithIdempotency).toHaveBeenCalledOnce();
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual({ id: "cached" });
  });

  it("skips withIdempotency when idempotent: false", async () => {
    const handler = makeHandler({ idempotent: false });
    await handler(makeRequest({ name: "PI 24.1" }));
    expect(mockWithIdempotency).not.toHaveBeenCalled();
  });
});
