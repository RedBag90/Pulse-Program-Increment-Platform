import { describe, it, expect } from "vitest";
import {
  authorize,
  authorizeResource,
  hasCapability,
  hasPermission,
  type AuthResource,
} from "@/server/auth/authorize";
import type { Principal, PrincipalScopes } from "@/server/auth/principal";
import { ROLES } from "@/modules/core/kernel/domain/roles";
import { enumerateDefaultCapabilities } from "@/server/auth/policies";
import type { TenantId, UserId } from "@/modules/core/kernel/domain/types";
import { isErr, isOk } from "@/modules/core/kernel/domain/errors";
import { MODULE_KEYS } from "@/modules/core/kernel/domain/modules";
import { resolveInitiativeValueStreamId } from "@/modules/core/kernel/domain/initiative-value-stream";

/**
 * Test-Principal-Factory. Mit dem RoleCapability-Modell (PR B) trägt der
 * Principal seine Capabilities selbst — die Factory leitet sie aus den
 * Default-Bundles in POLICIES ab, mirrors die Production-Fallback-Logik in
 * `resolveCapabilities()`.
 */
const principal = (over: Partial<Principal> = {}): Principal => {
  const roles = over.roles ?? [];
  const capabilities =
    over.capabilities ??
    enumerateDefaultCapabilities()
      .filter((t) => roles.includes(t.role))
      .map((t) => ({ action: t.action, scope: t.scope }));
  return {
    id: "u1" as UserId,
    tenantId: "t1" as TenantId,
    email: "u1@example.com",
    roles,
    scopes: { valueStreamIds: [], artIds: [], teamIds: [] } as PrincipalScopes,
    capabilities,
    tenantKind: "organization",
    tenantStatus: "active",
    isPlatformAdmin: false,
    enabledModules: MODULE_KEYS,
    ...over,
  };
};

describe("authorize — roles", () => {
  it("tenant_admin bypasses every policy — in seinem Mandanten", () => {
    const r: AuthResource = { tenantId: "t1" };
    expect(authorize("epic.update", r, principal({ roles: [ROLES.TENANT_ADMIN] })).allow).toBe(
      true,
    );
  });

  /**
   * ⚠ SECURITY: `platform_admin` stand bis September 2026 neben `tenant_admin`
   * im Fast-Path. Damit hatte ein Plattform-Admin in **jedem** Mandanten, in
   * dem eine Zeile für ihn lag, vollen Lese- und Schreibzugriff — auch in
   * privaten Bereichen fremder Nutzer. Die Plattform-Rechte hängen am globalen
   * Kennzeichen (`requirePlatformAdmin`), nicht an dieser Funktion.
   */
  it("platform_admin ist in einem Mandanten **kein** Freibrief", () => {
    const r: AuthResource = { tenantId: "t1" };
    expect(authorize("epic.update", r, principal({ roles: [ROLES.PLATFORM_ADMIN] })).allow).toBe(
      false,
    );
  });

  it("denies when the principal holds no granted role", () => {
    const d = authorize("epic.update", { tenantId: "t1" }, principal({ roles: [ROLES.VIEWER] }));
    expect(d.allow).toBe(false);
    expect(d.reason).toContain("epic.update");
  });

  it("allows an unscoped role grant regardless of resource", () => {
    // EPIC_OWNER has epic.update with no scope → any Epic in the tenant.
    expect(
      authorize(
        "epic.update",
        { tenantId: "t1", valueStreamId: "vs-foreign" },
        principal({ roles: [ROLES.EPIC_OWNER] }),
      ).allow,
    ).toBe(true);
  });
});

describe("authorize — value_stream scope", () => {
  const vsOwner = (valueStreamIds: string[]) =>
    principal({
      roles: [ROLES.VALUE_STREAM_OWNER],
      scopes: { valueStreamIds, artIds: [], teamIds: [] },
    });

  it("enforces the scope when the resource carries valueStreamId", () => {
    expect(authorize("epic.update", { valueStreamId: "vs1" }, vsOwner(["vs1"])).allow).toBe(true);
    expect(authorize("epic.update", { valueStreamId: "vs2" }, vsOwner(["vs1"])).allow).toBe(false);
  });

  it("an empty principal scope means 'all in reach'", () => {
    expect(authorize("epic.update", { valueStreamId: "vs-any" }, vsOwner([])).allow).toBe(true);
  });

  /**
   * **Das ART-Budget: drei Zuschnitte auf einer Capability.**
   *
   * Bis September 2026 stand der Wertstrom-Owner in der unscoped Zeile von
   * `art_budget.distribute` — er durfte damit in fremden Wertströmen verteilen,
   * und `/my-tasks` schickte ihm die Förder-Erinnerung für jedes ART des
   * Mandanten. Kein Test hielt das fest; es gab überhaupt keinen Test über einen
   * Budget-Grant dieser Rolle. Dieser hier ist die Gegenprobe.
   */
  it("art_budget.distribute: der Wertstrom-Owner nur in seinem eigenen Strom", () => {
    const own = vsOwner(["vs1"]);
    expect(
      authorize("art_budget.distribute", { artId: "a1", valueStreamId: "vs1" }, own).allow,
    ).toBe(true);
    expect(
      authorize("art_budget.distribute", { artId: "a9", valueStreamId: "vs2" }, own).allow,
    ).toBe(false);
  });

  it("art_budget.distribute: der RTE weiterhin nur auf seinem ART", () => {
    const rte = principal({
      roles: [ROLES.RTE],
      scopes: { valueStreamIds: [], artIds: ["a1"], teamIds: [] },
    });
    expect(
      authorize("art_budget.distribute", { artId: "a1", valueStreamId: "vs1" }, rte).allow,
    ).toBe(true);
    expect(
      authorize("art_budget.distribute", { artId: "a2", valueStreamId: "vs1" }, rte).allow,
    ).toBe(false);
  });

  it("art_budget.distribute: das Portfolio-Management bleibt mandantenweit", () => {
    const pm = principal({ roles: [ROLES.PORTFOLIO_MANAGER] });
    expect(
      authorize("art_budget.distribute", { artId: "a9", valueStreamId: "vs9" }, pm).allow,
    ).toBe(true);
  });

  it("DOCUMENTS the gap: a missing valueStreamId satisfies the scope vacuously", () => {
    // This is why by-id mutations must re-check at the service seam with the
    // loaded row's valueStreamId — see authorizeResource / ADR-0002.
    expect(authorize("epic.update", { tenantId: "t1" }, vsOwner(["vs1"])).allow).toBe(true);
  });

  /**
   * **Und hier ist die Lücke für Features geschlossen.**
   *
   * Ein Feature ohne Eltern-Epic hat weder einen eigenen Wertstrom noch einen
   * geerbten. Genau der Fall lief bisher vakuös durch: `memberOrVacuous` hält
   * ein leeres Feld für „alles in Reichweite", ein Wertstrom-Verantwortlicher
   * hätte also **jedes** elternlose Feature anfassen dürfen.
   *
   * `resolveInitiativeValueStreamId` nimmt als letzten Halt das ART, und
   * `Art.valueStreamId` ist NOT NULL. Steht ein ART an der Zeile, ist das Feld
   * damit nie leer — der vakuöse Zweig ist für Features unerreichbar.
   *
   * Der Test prüft die **Verbindung** aus Ableitung und Prüfung, nicht die
   * beiden Teile einzeln: genau dort saß der Fehler. Wer den `art`-Join aus der
   * Abfrage entfernt, bekommt hier rot.
   */
  /**
   * **Der ART-Scope, der bisher nur dokumentiert war.** Die Rollen-Matrix
   * schreibt für RTE und Feature Owner „Scope: ARTs"; der Code erteilte
   * `feature.create` unbeschränkt. Ein Grant ohne Scope erlaubt sofort — der
   * `artId` in der Ressource wurde also eingesammelt und nie geprüft.
   *
   * Der Portfolio Manager bleibt ausdrücklich unbeschränkt: er steuert über
   * ARTs hinweg.
   */
  it("bindet das Anlegen eines Features an das ART des RTE", () => {
    const rte = (artIds: string[]) =>
      principal({ roles: [ROLES.RTE], scopes: { valueStreamIds: [], artIds, teamIds: [] } });

    expect(authorize("feature.create", { artId: "art-1" }, rte(["art-1"])).allow).toBe(true);
    expect(authorize("feature.create", { artId: "art-2" }, rte(["art-1"])).allow).toBe(false);
    // Ohne eigene Eingrenzung bleibt alles in Reichweite — niemand verliert
    // heute Zugriff.
    expect(authorize("feature.create", { artId: "art-2" }, rte([])).allow).toBe(true);

    const pm = principal({
      roles: [ROLES.PORTFOLIO_MANAGER],
      scopes: { valueStreamIds: [], artIds: ["art-1"], teamIds: [] },
    });
    expect(authorize("feature.create", { artId: "art-2" }, pm).allow).toBe(true);
  });

  it("verweigert ein elternloses Feature dem fremden Wertstrom", () => {
    const orphanInFremdemStrom: AuthResource = {
      tenantId: "t1",
      artId: "art-1",
      valueStreamId: resolveInitiativeValueStreamId({
        parentValueStreamId: null, // kein Epic
        ownValueStreamId: null, // Features tragen keinen eigenen
        artValueStreamId: "vs1", // … aber ihr ART tut es
      }),
    };

    expect(authorize("feature.owner.assign", orphanInFremdemStrom, vsOwner(["vs2"])).allow).toBe(
      false,
    );
    expect(authorize("feature.owner.assign", orphanInFremdemStrom, vsOwner(["vs1"])).allow).toBe(
      true,
    );

    // Der Gegenbeweis, damit der Test nicht nur behauptet, er halte etwas:
    // **ohne** den ART-Halt bleibt das Feld leer, und derselbe Fremde kommt
    // durch. Das war der Zustand vor dieser Etappe.
    const ohneArtHalt: AuthResource = {
      tenantId: "t1",
      artId: "art-1",
      valueStreamId: null,
    };
    expect(authorize("feature.owner.assign", ohneArtHalt, vsOwner(["vs2"])).allow).toBe(true);
  });
});

describe("authorizeResource — service-seam Result wrapper", () => {
  it("returns ok when allowed", () => {
    const r = authorizeResource(
      principal({
        roles: [ROLES.VALUE_STREAM_OWNER],
        scopes: { valueStreamIds: ["vs1"], artIds: [], teamIds: [] },
      }),
      "epic.update",
      { valueStreamId: "vs1" },
    );
    expect(isOk(r)).toBe(true);
  });

  it("returns a forbidden domain error when denied", () => {
    const r = authorizeResource(
      principal({
        roles: [ROLES.VALUE_STREAM_OWNER],
        scopes: { valueStreamIds: ["vs1"], artIds: [], teamIds: [] },
      }),
      "epic.update",
      { valueStreamId: "vs2" },
    );
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.kind).toBe("forbidden");
  });
});

describe("hasPermission", () => {
  it("is the boolean projection of authorize", () => {
    expect(
      hasPermission(
        "epic.update",
        { valueStreamId: "vs1" },
        principal({ roles: [ROLES.PORTFOLIO_MANAGER] }),
      ),
    ).toBe(true);
  });
});

describe("hasCapability", () => {
  it("admin bypass: tenant_admin sees every action true", () => {
    const p = principal({ roles: [ROLES.TENANT_ADMIN] });
    expect(hasCapability(p, "epic.update")).toBe(true);
    expect(hasCapability(p, "epic.delete")).toBe(true);
  });

  it("granted role without scope check returns true", () => {
    const p = principal({ roles: [ROLES.PORTFOLIO_MANAGER] });
    expect(hasCapability(p, "epic.update", { valueStreamId: "vs1" })).toBe(true);
  });

  it("no role → false even on scope-free actions", () => {
    const p = principal({ roles: [] });
    expect(hasCapability(p, "epic.update")).toBe(false);
  });

  it("scoped grant with mismatched scope → false", () => {
    const p = principal({
      roles: [ROLES.VALUE_STREAM_OWNER],
      scopes: { valueStreamIds: ["vs-owned"], artIds: [], teamIds: [] },
    });
    expect(hasCapability(p, "epic.update", { valueStreamId: "vs-other" })).toBe(false);
    expect(hasCapability(p, "epic.update", { valueStreamId: "vs-owned" })).toBe(true);
  });

  it("argument order is (principal, action, resource?)", () => {
    const p = principal({ roles: [ROLES.PORTFOLIO_MANAGER] });
    // The resource parameter defaults to {} — tenant-wide checks need no resource.
    expect(hasCapability(p, "epic.update")).toBe(true);
  });
});

/**
 * Der Feature-Owner soll „ab Epic Owner aufwärts" zuweisbar sein. Das
 * Rollenmodell kennt bewusst **keine Vererbung** — es gibt also nichts, was
 * „aufwärts" von selbst garantiert. Diese Tests sind die einzige Stelle, an der
 * die vereinbarte Rollenmenge festgehalten wird.
 */
describe("feature.owner.assign", () => {
  const ALLOWED = [
    ROLES.PORTFOLIO_MANAGER,
    ROLES.RTE,
    ROLES.FEATURE_OWNER,
    ROLES.EPIC_OWNER,
  ] as const;

  it.each(ALLOWED)("%s darf tenant-weit zuweisen", (role) => {
    expect(hasCapability(principal({ roles: [role] }), "feature.owner.assign")).toBe(true);
  });

  it("viewer darf nicht", () => {
    expect(hasCapability(principal({ roles: [ROLES.VIEWER] }), "feature.owner.assign")).toBe(false);
  });

  it("der Mandanten-Admin kommt über den Bypass durch, nicht über einen Grant", () => {
    expect(hasCapability(principal({ roles: [ROLES.TENANT_ADMIN] }), "feature.owner.assign")).toBe(
      true,
    );
    // Der Plattform-Admin nicht: er hat in einem fremden Mandanten nichts zu
    // suchen, und in seinem eigenen trägt er `tenant_admin`.
    expect(
      hasCapability(principal({ roles: [ROLES.PLATFORM_ADMIN] }), "feature.owner.assign"),
    ).toBe(false);
  });

  it("der Wertstrom-Verantwortliche darf nur im eigenen Wertstrom", () => {
    const p = principal({
      roles: [ROLES.VALUE_STREAM_OWNER],
      scopes: { valueStreamIds: ["vs-1"], artIds: [], teamIds: [] } as PrincipalScopes,
    });
    expect(hasCapability(p, "feature.owner.assign", { valueStreamId: "vs-1" })).toBe(true);
    expect(hasCapability(p, "feature.owner.assign", { valueStreamId: "vs-2" })).toBe(false);
  });
});
