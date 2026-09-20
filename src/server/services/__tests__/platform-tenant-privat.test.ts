import { describe, it, expect, vi, beforeEach } from "vitest";
import { ROLES } from "@/modules/core/kernel/domain/roles";
import type { Principal } from "@/server/auth/principal";

/**
 * ⚠ SECURITY: **ein privater Bereich nimmt niemanden auf.**
 *
 * `addTenantMember` war bis September 2026 die einzige Verwaltungsfunktion ohne
 * `kind`-Guard — und damit der Weg, auf dem sich ein Plattform-Admin über
 * `/platform/tenants` selbst eine `tenant_admin`-Mitgliedschaft in jedem
 * fremden Privatbereich anlegen konnte. Danach liessen Umschalter, Wechsel und
 * `authorize()` ihn planmässig durch.
 *
 * Diese Fläche hatte keinen einzigen Test; das hier ist der erste.
 */
const tenantFindUnique = vi.fn();
vi.mock("@/server/auth/platform", () => ({
  platformDb: () => ({ tenant: { findUnique: tenantFindUnique } }),
}));
// Der Einladungs-Pfad braucht ein Signatur-Geheimnis; er ist hier nicht das Thema.
vi.mock("@/server/services/invitation", () => ({
  signInviteToken: vi.fn(async () => "token"),
}));
vi.mock("@/server/services/user-directory", () => ({
  findUserIdByEmail: vi.fn(async () => null),
  resolveUserEmails: vi.fn(async () => new Map()),
}));

import { addTenantMember } from "@/server/services/platform-tenant";

const admin = { id: "u-admin", isPlatformAdmin: true } as unknown as Principal;

beforeEach(() => {
  tenantFindUnique.mockReset();
});

describe("addTenantMember — private Bereiche", () => {
  it("weist einen privaten Bereich ab", async () => {
    tenantFindUnique.mockResolvedValue({ name: "Mein Bereich (fremd)", kind: "personal" });
    const out = await addTenantMember(admin, "t-privat", "admin@pulse.dev", ROLES.TENANT_ADMIN);
    expect(out.ok).toBe(false);
    expect(out.ok === false && out.error).toMatch(/Private Bereiche/);
  });

  /** Die Rolle ist das globale Kennzeichen, keine Mandanten-Rolle. */
  it("weist `platform_admin` als Mandanten-Rolle ab — noch vor jeder Abfrage", async () => {
    const out = await addTenantMember(admin, "t-org", "admin@pulse.dev", ROLES.PLATFORM_ADMIN);
    expect(out.ok).toBe(false);
    expect(tenantFindUnique).not.toHaveBeenCalled();
  });

  it("lässt eine Organisation weiterhin durch den Guard", async () => {
    tenantFindUnique.mockResolvedValue({ name: "Pulse Demo Corp", kind: "organization" });
    // Dahinter liegt der Einladungs-Pfad mit Transaktion und Domain-Event; er
    // ist hier nicht das Thema. Entscheidend ist, dass der Guard die Art
    // geprüft und **nicht** abgewiesen hat.
    const out = await addTenantMember(admin, "t-org", "neu@pulse.dev", ROLES.VIEWER).catch(
      (e: unknown) => e,
    );
    expect(tenantFindUnique).toHaveBeenCalledWith({
      where: { id: "t-org" },
      select: { name: true, kind: true },
    });
    const abgewiesen =
      typeof out === "object" &&
      out !== null &&
      "ok" in out &&
      (out as { ok: boolean }).ok === false;
    expect(abgewiesen).toBe(false);
  });

  it("bleibt Plattform-Admins vorbehalten", async () => {
    const fremder = { id: "u", isPlatformAdmin: false } as unknown as Principal;
    const out = await addTenantMember(fremder, "t-org", "x@pulse.dev", ROLES.VIEWER);
    expect(out.ok).toBe(false);
    expect(tenantFindUnique).not.toHaveBeenCalled();
  });
});

/**
 * Und die Liste, aus der man dorthin gelangte: sie zeigte private Bereiche auf
 * Wunsch mit Mitgliederliste und E-Mail-Adressen.
 */
describe("listAllTenants — private Bereiche", () => {
  it("fragt nur Organisationen ab", async () => {
    const findMany = vi.fn(async () => []);
    const { listAllTenants } = await import("@/server/views/platform-tenants");
    await listAllTenants({ tenant: { findMany } } as never);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { kind: "organization" } }),
    );
  });
});
