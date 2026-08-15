import { describe, it, expect } from "vitest";
import type { PrismaClient } from "@/generated/prisma";
import { buildRoleOnboardingModel } from "@/modules/onboarding/server/views/role-onboarding";
import type { Principal, PrincipalScopes } from "@/server/auth/principal";
import { ROLES } from "@/modules/core/kernel/domain/roles";
import { enumerateDefaultCapabilities } from "@/server/auth/policies";
import { MODULE_KEYS } from "@/modules/core/kernel/domain/modules";
import { DEFAULT_PRACTICES } from "@/modules/core/kernel/domain/operating-model";
import type { TenantId, UserId } from "@/modules/core/kernel/domain/types";

/**
 * Das Page-Model läuft im Dashboard-Layout, also auf **jeder** Seite. Diese
 * Tests halten fest, was dabei nie passieren darf.
 *
 * Hintergrund: ein veralteter Prisma-Client im Dev (Delegate `roleOnboarding`
 * fehlt) hat hier einen TypeError geworfen und damit jede Dashboard-Seite
 * zerlegt. Der Aufrufer fängt das inzwischen ab — die Tests unten sichern, dass
 * das Modell sich in dieser Lage berechenbar verhält, statt still etwas
 * Halbfertiges zu liefern.
 */

const principal = (over: Partial<Principal> = {}): Principal => {
  const roles = over.roles ?? [ROLES.RTE];
  return {
    id: "u1" as UserId,
    tenantId: "t1" as TenantId,
    email: "u1@example.com",
    roles,
    scopes: { valueStreamIds: [], artIds: [], teamIds: [] } as PrincipalScopes,
    capabilities: enumerateDefaultCapabilities()
      .filter((t) => roles.includes(t.role))
      .map((t) => ({ action: t.action, scope: t.scope })),
    tenantKind: "organization",
    tenantStatus: "active",
    isPlatformAdmin: false,
    enabledModules: MODULE_KEYS,
    ...over,
  };
};

/** Zählt, wie oft die Bestandsprüfung angefasst wurde. */
let dataProbes = 0;

/**
 * Prisma-Doppel mit steuerbarem `roleOnboarding.findMany` plus den sieben
 * Bestands-Delegates, die `loadAvailableData` abfragt. `hasData` steuert, ob der
 * Workspace als gefüllt gilt.
 */
function db(rows: unknown[] | Error | undefined, hasData = true): PrismaClient {
  if (rows === undefined) {
    // Delegate fehlt komplett — exakt der Zustand nach einem Schema-Drift.
    return {} as unknown as PrismaClient;
  }
  const probe = () => ({
    findFirst: async () => {
      dataProbes++;
      return hasData ? { id: "x" } : null;
    },
  });
  return {
    roleOnboarding: {
      findMany: async () => {
        if (rows instanceof Error) throw rows;
        return rows;
      },
    },
    valueStream: probe(),
    art: probe(),
    initiative: probe(),
    programIncrement: probe(),
    risk: probe(),
    objective: probe(),
  } as unknown as PrismaClient;
}

describe("buildRoleOnboardingModel", () => {
  it("fragt den Bestand NICHT ab, wenn nichts Datengebundenes mehr offen ist", async () => {
    // Das Modell läuft im Dashboard-Layout, also auf jeder Navigation. Nach
    // abgeschlossener Tour darf es keine sieben Zusatz-Queries pro Seitenaufruf
    // auslösen.
    const p = principal();
    const first = await buildRoleOnboardingModel(db([]), p, DEFAULT_PRACTICES);
    const allKeys = first.notices[0]?.tour.steps.map((s) => s.key) ?? [];

    dataProbes = 0;
    await buildRoleOnboardingModel(
      db([
        { role: ROLES.RTE, acknowledgedAt: new Date("2026-08-14T00:00:00Z"), seenStepKeys: allKeys },
      ]),
      p,
      DEFAULT_PRACTICES,
    );
    expect(dataProbes).toBe(0);
  });

  it("fragt den Bestand ab, solange datengebundene Schritte offen sind", async () => {
    dataProbes = 0;
    await buildRoleOnboardingModel(db([]), principal(), DEFAULT_PRACTICES);
    expect(dataProbes).toBeGreaterThan(0);
  });

  it("ohne Bestand fallen die datengebundenen Schritte aus der Tour", async () => {
    const withData = await buildRoleOnboardingModel(db([], true), principal(), DEFAULT_PRACTICES);
    const without = await buildRoleOnboardingModel(db([], false), principal(), DEFAULT_PRACTICES);
    expect(without.notices[0]?.tour.total).toBeLessThan(withData.notices[0]?.tour.total ?? 0);
  });

  it("liefert Notices für eine frisch zugewiesene Rolle", async () => {
    const model = await buildRoleOnboardingModel(db([]), principal(), DEFAULT_PRACTICES);
    expect(model.notices).toHaveLength(1);
    expect(model.notices[0]?.kind).toBe("new_role");
    expect(model.notices[0]?.role).toBe(ROLES.RTE);
  });

  it("fragt die Datenbank gar nicht erst, wenn der Nutzer keine Rolle hat", async () => {
    // Wichtig: kein Query auf jeder Dashboard-Seite für rollenlose Nutzer. Der
    // Delegate fehlt hier absichtlich — würde er berührt, gäbe es einen TypeError.
    const model = await buildRoleOnboardingModel(
      db(undefined),
      principal({ roles: [], capabilities: [] }),
      DEFAULT_PRACTICES,
    );
    expect(model.notices).toEqual([]);
  });

  it("wirft weiter, wenn der Prisma-Delegate fehlt — der Aufrufer fängt das ab", async () => {
    // Bewusst KEIN stilles Schlucken hier: das Page-Model soll nicht so tun, als
    // gäbe es keine Notices, wenn es sie nur nicht laden konnte. Der Fallback
    // gehört ins Layout, wo er als Log-Zeile sichtbar wird.
    await expect(
      buildRoleOnboardingModel(db(undefined), principal(), DEFAULT_PRACTICES),
    ).rejects.toThrow();
  });

  it("reicht einen Datenbankfehler ebenfalls nach oben", async () => {
    await expect(
      buildRoleOnboardingModel(db(new Error("connection lost")), principal(), DEFAULT_PRACTICES),
    ).rejects.toThrow("connection lost");
  });

  it("quittierte Rolle mit allen gesehenen Schritten ⇒ keine Notice", async () => {
    const p = principal();
    const first = await buildRoleOnboardingModel(db([]), p, DEFAULT_PRACTICES);
    const allKeys = first.notices[0]?.tour.steps.map((s) => s.key) ?? [];
    expect(allKeys.length).toBeGreaterThan(0);

    const model = await buildRoleOnboardingModel(
      db([
        {
          role: ROLES.RTE,
          acknowledgedAt: new Date("2026-08-14T00:00:00Z"),
          seenStepKeys: allKeys,
        },
      ]),
      p,
      DEFAULT_PRACTICES,
    );
    expect(model.notices).toEqual([]);
  });
});
