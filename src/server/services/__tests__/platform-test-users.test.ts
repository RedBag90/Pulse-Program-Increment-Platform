import { describe, it, expect } from "vitest";
import { tenantSlug, TEST_USER_ROLES, MAX_TEST_USERS } from "@/server/services/platform-test-users";
import { ROLES, ALL_ROLES } from "@/modules/core/kernel/domain/roles";

/**
 * Die reinen Teile des Testnutzer-Dienstes. Das Anlegen selbst geht über die
 * Supabase-Admin-API und wird an der laufenden Anwendung geprüft, nicht hier.
 */

describe("tenantSlug", () => {
  it("macht aus einem Mandantennamen eine E-Mail-Domäne", () => {
    expect(tenantSlug("Large Test Corp")).toBe("large-test-corp");
  });

  it("löst Umlaute auf, statt sie zu verschlucken", () => {
    // Ohne diese Zeile würde „Prüf GmbH" zu `pr-f-gmbh` — ein Bindestrich an der
    // Stelle, an der ein Buchstabe stand.
    expect(tenantSlug("Prüf GmbH")).toBe("pruef-gmbh");
    expect(tenantSlug("Größe & Maß")).toBe("groesse-mass");
  });

  it("lässt keine Bindestriche am Rand stehen", () => {
    expect(tenantSlug("  — Test —  ")).toBe("test");
  });

  it("liefert auch für einen namenlosen Mandanten etwas Brauchbares", () => {
    // Eine leere Domäne ergäbe `rte-1@.test` — eine Adresse, die Supabase ablehnt.
    expect(tenantSlug("···")).toBe("mandant");
    expect(tenantSlug("")).toBe("mandant");
  });
});

describe("die wählbaren Rollen", () => {
  it("lassen den Plattform-Admin aus", () => {
    // Dieselbe Sperre wie in `addTenantMember`: eine plattformweite Rolle wird
    // nicht nebenbei beim Anlegen eines Testmandanten vergeben.
    expect(TEST_USER_ROLES).not.toContain(ROLES.PLATFORM_ADMIN);
  });

  it("enthalten sonst jede Rolle — auch den Viewer", () => {
    // Über ALL_ROLES statt über eine abgeschriebene Liste: eine neue Rolle fällt
    // sonst still hinten runter.
    expect([...TEST_USER_ROLES].sort()).toEqual(
      ALL_ROLES.filter((r) => r !== ROLES.PLATFORM_ADMIN).sort(),
    );
  });
});

describe("die Obergrenze", () => {
  it("ist gesetzt und nicht absurd", () => {
    // Jedes Konto ist ein Rundlauf zur Supabase-Admin-API.
    expect(MAX_TEST_USERS).toBeGreaterThan(TEST_USER_ROLES.length);
    expect(MAX_TEST_USERS).toBeLessThanOrEqual(100);
  });
});
