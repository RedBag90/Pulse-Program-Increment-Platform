import { describe, it, expect, beforeEach, vi } from "vitest";
import { signInviteToken, verifyInviteToken } from "@/server/services/invitation";
import type { TenantId } from "@/domain/types";

const tenantId = "11111111-1111-1111-1111-111111111111" as TenantId;

beforeEach(() => {
  vi.stubEnv("INVITE_JWT_SECRET", "test-secret-that-is-long-enough-for-hs256");
});

describe("signInviteToken / verifyInviteToken", () => {
  it("round-trips a valid token", async () => {
    const token = await signInviteToken({
      email: "user@example.com",
      tenantId,
      role: "team_editor",
    });

    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3);

    const result = await verifyInviteToken(token);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.email).toBe("user@example.com");
      expect(result.value.tenantId).toBe(tenantId);
      expect(result.value.role).toBe("team_editor");
    }
  });

  it("returns a validation error for a garbage token", async () => {
    const result = await verifyInviteToken("not.a.valid.jwt");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("validation");
    }
  });

  it("returns a validation error when signed with a different secret", async () => {
    vi.stubEnv("INVITE_JWT_SECRET", "different-secret-that-is-long-enough-for-hs256");
    const token = await signInviteToken({ email: "x@y.com", tenantId, role: "portfolio_viewer" });

    vi.stubEnv("INVITE_JWT_SECRET", "test-secret-that-is-long-enough-for-hs256");
    const result = await verifyInviteToken(token);
    expect(result.ok).toBe(false);
  });
});
