import { describe, it, expect } from "vitest";
import { resolveActiveAssignments, type AssignmentRow } from "@/server/auth/principal";

const row = (over: Partial<AssignmentRow> = {}): AssignmentRow => ({
  tenantId: "tenant-a",
  tenantKind: "organization",
  role: "viewer",
  valueStreamIds: [],
  artIds: [],
  teamIds: [],
  ...over,
});

describe("resolveActiveAssignments — Multi-Tenant-Kern", () => {
  it("null bei leeren Assignments (Session ohne Zuweisung)", () => {
    expect(resolveActiveAssignments([], null)).toBeNull();
  });

  it("ohne Cookie: ältestes Assignment bestimmt den Tenant (Alt-Verhalten)", () => {
    const r = resolveActiveAssignments(
      [row({ tenantId: "tenant-a" }), row({ tenantId: "tenant-b", role: "rte" })],
      null,
    );
    expect(r?.tenantId).toBe("tenant-a");
  });

  it("Cookie wählt den Tenant, wenn dort ein Assignment existiert", () => {
    const r = resolveActiveAssignments(
      [row({ tenantId: "tenant-a" }), row({ tenantId: "tenant-b", role: "rte" })],
      "tenant-b",
    );
    expect(r?.tenantId).toBe("tenant-b");
    expect(r?.roles).toEqual(["rte"]);
  });

  it("Cookie auf fremden/unbekannten Tenant ⇒ Fallback auf ältestes Assignment", () => {
    const r = resolveActiveAssignments([row({ tenantId: "tenant-a" })], "tenant-x");
    expect(r?.tenantId).toBe("tenant-a");
  });

  it("⚠ SECURITY: Rollen leaken nicht über Tenants — admin in B ≠ admin in A", () => {
    const r = resolveActiveAssignments(
      [
        row({ tenantId: "tenant-a", role: "viewer" }),
        row({ tenantId: "tenant-b", role: "tenant_admin" }),
      ],
      "tenant-a",
    );
    expect(r?.roles).toEqual(["viewer"]);
    expect(r?.roles).not.toContain("tenant_admin");
  });

  it("Scopes aggregieren nur über Assignments des aktiven Tenants", () => {
    const r = resolveActiveAssignments(
      [
        row({ tenantId: "tenant-a", role: "rte", valueStreamIds: ["vs-1"] }),
        // Fremd-Tenant mit leerem Scope (= „alle") darf Tenant A nicht entgrenzen:
        row({ tenantId: "tenant-b", role: "rte", valueStreamIds: [] }),
      ],
      "tenant-a",
    );
    expect(r?.scopes.valueStreamIds).toEqual(["vs-1"]);
  });

  it("leerer Scope im AKTIVEN Tenant bedeutet weiterhin alle (Union-Regel)", () => {
    const r = resolveActiveAssignments(
      [
        row({ tenantId: "tenant-a", role: "rte", valueStreamIds: ["vs-1"] }),
        row({ tenantId: "tenant-a", role: "epic_owner", valueStreamIds: [] }),
      ],
      "tenant-a",
    );
    expect(r?.scopes.valueStreamIds).toEqual([]);
    expect(r?.roles.sort()).toEqual(["epic_owner", "rte"]);
  });

  /**
   * ⚠ SECURITY: ein privater Bereich gehört einem Menschen. Wer dort eine
   * andere Zuweisung als `tenant_admin` hält, ist hineingeraten — bis September
   * 2026 lag in dreizehn fremden Privatbereichen eine `platform_admin`-Zeile,
   * und der Umschalter liess hinein.
   */
  describe("private Bereiche", () => {
    const eigener = row({ tenantId: "privat-a", tenantKind: "personal", role: "tenant_admin" });
    const fremder = row({ tenantId: "privat-b", tenantKind: "personal", role: "platform_admin" });

    it("lässt den Eigentümer in seinen eigenen Bereich", () => {
      expect(resolveActiveAssignments([eigener], "privat-a")?.tenantId).toBe("privat-a");
    });

    it("lässt niemanden in einen fremden Bereich — auch nicht mit Zuweisung", () => {
      const r = resolveActiveAssignments([row({ tenantId: "tenant-a" }), fremder], "privat-b");
      expect(r?.tenantId).toBe("tenant-a");
    });

    it("macht einen fremden Bereich auch nicht zum Rückfall", () => {
      // Die fremde Zeile ist die älteste — ohne die Prüfung wäre sie der
      // Standard-Bereich beim Anmelden.
      const r = resolveActiveAssignments([fremder, row({ tenantId: "tenant-a" })], null);
      expect(r?.tenantId).toBe("tenant-a");
    });

    it("gibt keinen Prinzipal, wenn es nur fremde Bereiche gibt", () => {
      expect(resolveActiveAssignments([fremder], null)).toBeNull();
    });
  });
});
