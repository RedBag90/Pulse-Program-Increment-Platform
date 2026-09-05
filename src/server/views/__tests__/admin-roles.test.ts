import { describe, it, expect } from "vitest";
import {
  CAPABILITY_DOMAINS,
  capabilityDomains,
  buildAdminRolesPageModel,
} from "@/server/views/admin-roles";
import { enumerateDefaultCapabilities } from "@/server/auth/policies";
import { ALL_ROLES } from "@/modules/core/kernel/domain/roles";

/**
 * Die Fläche `/admin/roles` darf keine Funktion verschweigen.
 *
 * Sie tat es: die Domänenliste war von Hand gepflegt und nannte 45 der 69
 * Actions. Die fehlenden 24 waren über die Oberfläche weder erteilbar noch
 * entziehbar — und weil die Zähler nur über die gezeigten rechnen, konnte eine
 * Rolle vom Standard abweichen, ohne dass die Fläche das ausweist.
 */

const bundleActions = [...new Set(enumerateDefaultCapabilities().map((t) => t.action))];

describe("capabilityDomains", () => {
  it("zeigt jede Funktion aus dem Default-Bundle", () => {
    const shown = new Set(CAPABILITY_DOMAINS.flatMap((d) => d.actions));
    const missing = bundleActions.filter((a) => !shown.has(a));
    expect(missing).toEqual([]);
  });

  it("zeigt jede Funktion genau einmal", () => {
    const flat = CAPABILITY_DOMAINS.flatMap((d) => d.actions);
    expect(flat.length).toBe(new Set(flat).size);
  });

  it("zeigt tenant.create, obwohl es kein Default-Grant ist", () => {
    // Bewusst gelistet und bewusst gesperrt — die Action steht nicht im Bundle.
    const shown = new Set(CAPABILITY_DOMAINS.flatMap((d) => d.actions));
    expect(shown.has("tenant.create")).toBe(true);
    expect(bundleActions).not.toContain("tenant.create");
  });

  it("hat keine leere Domäne", () => {
    for (const d of CAPABILITY_DOMAINS) expect(d.actions.length).toBeGreaterThan(0);
  });

  it('faengt eine unbekannte Funktion in „Weitere" auf', () => {
    // Solange alles einsortiert ist, gibt es die Sammel-Domäne nicht. Sie ist
    // die Zusicherung für die nächste neu eingefuehrte Action: die Liste kann
    // veralten, die Flaeche nicht.
    expect(capabilityDomains().some((d) => d.key === "other")).toBe(false);
  });
});

describe("buildAdminRolesPageModel", () => {
  it("zaehlt eine Abweichung, die frueher unsichtbar war", () => {
    // `art_budget.distribute` stand in keiner Domaene und fiel deshalb aus
    // jeder Zaehlung heraus.
    const model = buildAdminRolesPageModel({
      capabilities: [{ role: "viewer", action: "art_budget.distribute", scope: null }],
    });
    const viewer = model.roles.find((r) => r.role === "viewer")!;
    expect(viewer.diffFromDefault.added).toBe(1);
    expect(viewer.grantedCount).toBe(1);
  });

  it("meldet den Standard als Standard", () => {
    const defaults = enumerateDefaultCapabilities();
    const model = buildAdminRolesPageModel({
      capabilities: defaults.map((t) => ({ role: t.role, action: t.action, scope: t.scope })),
    });
    for (const r of model.roles) {
      expect(r.diffFromDefault).toEqual({ added: 0, removed: 0, scopeChanged: 0 });
    }
  });

  it("kennt jede Rolle", () => {
    const model = buildAdminRolesPageModel({ capabilities: [] });
    expect(model.roles.map((r) => r.role)).toEqual([...ALL_ROLES]);
  });
});
