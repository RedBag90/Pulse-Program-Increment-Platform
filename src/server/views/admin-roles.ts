/**
 * Admin-Roles page-model: bereitet die 13 Rollen mit ihren aktuellen
 * Capabilities aus `role_capabilities` auf, vergleicht gegen das Default-
 * Bundle in `POLICIES` und reicht beides an die Shell durch.
 *
 * Quelle der Wahrheit fürs Default-Bundle: `enumerateDefaultCapabilities()`
 * in `src/server/auth/policies/index.ts`. Quelle der Wahrheit für den
 * aktuellen Zustand: die `RoleCapability`-Tabelle (PR A Backfill).
 */

import { ALL_ROLES, ROLE_LABELS, type Role } from "@/modules/core/kernel/domain/roles";
import { enumerateDefaultCapabilities, type Action, type ScopeCheck } from "@/server/auth/policies";

export interface CapabilityDomain {
  key: string;
  label: string;
  actions: readonly Action[];
}

/**
 * Die **Ordnung** der Funktionen, nicht ihre Quelle.
 *
 * Bis September 2026 war diese Liste beides — und lag damit hinterher: sie
 * nannte 45 der 69 Actions aus `enumerateDefaultCapabilities()`. Die fehlenden
 * 24 waren über die Fläche weder erteilbar noch entziehbar (das ganze
 * Risiko-Modul, die Budget-Runden, `art_budget.distribute`, die Solutions), und
 * schlimmer: `grantedCount` und der Standard-Abgleich rechneten nur über die
 * gezeigten. Eine Rolle konnte vom Standard abweichen, ohne dass die Fläche das
 * ausweisen konnte — sie wusste es nicht.
 *
 * Deshalb steht hier nur noch die Gruppierung. Was gezeigt wird, entscheidet
 * `capabilityDomains()`: jede bekannte Action behält ihre Domäne, jede neue
 * fällt in „Weitere" und ist damit **sofort sichtbar**. Eine Action kann nicht
 * mehr durchfallen, weil jemand vergisst, sie hier einzutragen.
 */
const DOMAIN_ORDER: CapabilityDomain[] = [
  {
    key: "governance",
    label: "Governance / Admin",
    actions: [
      "tenant.create",
      "tenant.users.manage",
      "integration.manage",
      "admin.audit-log.read",
      "admin.users.read",
      "role.capability.manage",
      "role.onboarding.manage",
      "portfolio_filter.manage",
    ],
  },
  { key: "target", label: "Target-Modell", actions: ["target.manage"] },
  {
    key: "budget",
    label: "Budget / Finance",
    actions: [
      "budget.read",
      "budget.manage",
      "budget.round.manage",
      "budget.round.decide",
      "budget.group.contribute",
      "budget.cycle.advance",
      "budget_plan.revision.capture",
      "timeline.manage",
      "rtb_item.manage",
      "art_budget.manage",
      "art_budget.distribute",
    ],
  },
  {
    key: "value_stream",
    label: "Value Stream",
    actions: ["value_stream.create", "value_stream.update"],
  },
  {
    key: "epic",
    label: "Epic-Lifecycle",
    actions: [
      "epic.create",
      "epic.update",
      "epic.delete",
      "epic.gate.request",
      "epic.gate.decide",
      "epic.gate.withdraw",
      "epic.gate.revert",
      "epic.gate.approvers.configure",
      "epic.owner.assign",
      "epic.portfolio_override",
    ],
  },
  { key: "art", label: "ART", actions: ["art.create", "art.update", "art.delete"] },
  {
    key: "pi",
    label: "PI / Programm-Planung",
    actions: [
      "pi.create",
      "pi.update",
      "pi.start",
      "pi.complete",
      "pi.delete",
      "pi.advance",
      "pi.demo.manage",
      "pi_standard.manage",
    ],
  },
  {
    key: "feature",
    label: "Feature",
    actions: [
      "feature.create",
      "feature.update",
      "feature.wsjf.set",
      "feature.delete",
      "feature.review.submit",
      "feature.review.decide",
      "feature.delivery.set",
      "feature.owner.assign",
    ],
  },
  { key: "dependencies", label: "Dependencies", actions: ["dependency.link", "dependency.unlink"] },
  {
    key: "impediments",
    label: "Impediments",
    actions: ["impediment.create", "impediment.escalate", "impediment.resolve"],
  },
  {
    key: "risks",
    label: "Risiken",
    actions: [
      "risk.suggest",
      "risk.document",
      "risk.review",
      "risk.update",
      "risk.delete",
      "risk.link",
      "risk.roam",
      "risk.settings.manage",
    ],
  },
  {
    key: "solutions",
    label: "Solutions",
    actions: ["solution.create", "solution.update", "solution.delete", "solution.manage"],
  },
  {
    key: "goals",
    label: "Ziele / KPI",
    actions: ["goal.custom_field.manage", "kpi.bind"],
  },
];

/** Wohin eine Action fällt, die in `DOMAIN_ORDER` nicht vorkommt. */
const CATCH_ALL_KEY = "other";

/**
 * Die Domänen, wie die Fläche sie zeigt: die feste Ordnung, ergänzt um alles,
 * was das Default-Bundle sonst noch kennt.
 *
 * `tenant.create` bleibt in „Governance / Admin", obwohl es kein Default-Grant
 * ist — es ist bewusst gezeigt und bewusst gesperrt.
 */
export function capabilityDomains(): CapabilityDomain[] {
  const placed = new Set<string>(DOMAIN_ORDER.flatMap((d) => d.actions));
  const rest = [...new Set(enumerateDefaultCapabilities().map((t) => t.action))]
    .filter((a) => !placed.has(a))
    .sort();
  if (rest.length === 0) return DOMAIN_ORDER;
  return [...DOMAIN_ORDER, { key: CATCH_ALL_KEY, label: "Weitere", actions: rest }];
}

/**
 * Rückwärtskompatibler Name für die Komponenten, die die Domänen rendern.
 * Ausgewertet beim Laden des Moduls — `enumerateDefaultCapabilities()` ist rein
 * und konstant.
 */
export const CAPABILITY_DOMAINS: CapabilityDomain[] = capabilityDomains();

export interface RoleCapabilityRow {
  action: Action;
  scope: ScopeCheck | null;
  /** Ist diese Zeile aktiv (in der DB vorhanden)? */
  granted: boolean;
  /** War dieses (role, action) Tupel im Default-Bundle aus POLICIES? */
  isDefault: boolean;
  /** Default-Scope aus POLICIES — null wenn unscoped oder nicht im Default. */
  defaultScope: ScopeCheck | null;
}

export interface RoleView {
  role: Role;
  label: string;
  /** Counts: granted vs. default, für die Sidebar-Anzeige. */
  grantedCount: number;
  defaultCount: number;
  /** Diff: hat der Tenant am Default geschraubt? */
  diffFromDefault: { added: number; removed: number; scopeChanged: number };
  /** Capability-Rows zur Anzeige im Detail-Pane (eine pro Action). */
  capabilities: RoleCapabilityRow[];
}

export interface AdminRolesPageModel {
  roles: RoleView[];
}

interface InputRow {
  role: string;
  action: string;
  scope: string | null;
}

export function buildAdminRolesPageModel(input: {
  capabilities: readonly InputRow[];
}): AdminRolesPageModel {
  const grantsByRole = new Map<string, Map<Action, ScopeCheck | null>>();
  for (const c of input.capabilities) {
    if (!grantsByRole.has(c.role)) grantsByRole.set(c.role, new Map());
    grantsByRole.get(c.role)!.set(c.action as Action, c.scope as ScopeCheck | null);
  }

  const defaults = enumerateDefaultCapabilities();
  const defaultsByRole = new Map<string, Map<Action, ScopeCheck | null>>();
  for (const t of defaults) {
    if (!defaultsByRole.has(t.role)) defaultsByRole.set(t.role, new Map());
    defaultsByRole.get(t.role)!.set(t.action, t.scope);
  }

  const allActions = CAPABILITY_DOMAINS.flatMap((d) => d.actions);

  const roles: RoleView[] = ALL_ROLES.map((role) => {
    const grants = grantsByRole.get(role) ?? new Map<Action, ScopeCheck | null>();
    const defs = defaultsByRole.get(role) ?? new Map<Action, ScopeCheck | null>();

    const capabilities: RoleCapabilityRow[] = allActions.map((action) => {
      const granted = grants.has(action);
      const isDefault = defs.has(action);
      const scope = granted ? (grants.get(action) ?? null) : null;
      const defaultScope = isDefault ? (defs.get(action) ?? null) : null;
      return { action, scope, granted, isDefault, defaultScope };
    });

    let added = 0;
    let removed = 0;
    let scopeChanged = 0;
    for (const c of capabilities) {
      if (c.granted && !c.isDefault) added++;
      else if (!c.granted && c.isDefault) removed++;
      else if (c.granted && c.isDefault && c.scope !== c.defaultScope) scopeChanged++;
    }

    return {
      role,
      label: ROLE_LABELS[role],
      grantedCount: capabilities.filter((c) => c.granted).length,
      defaultCount: capabilities.filter((c) => c.isDefault).length,
      diffFromDefault: { added, removed, scopeChanged },
      capabilities,
    };
  });

  return { roles };
}
