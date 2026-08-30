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

/** Domänen-Gruppierung wie in der Plan-Datei dokumentiert. */
export const CAPABILITY_DOMAINS: { key: string; label: string; actions: readonly Action[] }[] = [
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
      "goal.custom_field.manage",
    ],
  },
  { key: "target", label: "Target-Modell", actions: ["target.manage"] },
  {
    key: "budget",
    label: "Budget / Finance",
    actions: [
      "budget.manage",
      "budget_plan.revision.capture",
      "timeline.manage",
      "art_budget.manage",
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
      "epic.hypothesis.submit",
      "epic.hypothesis.decide",
      "epic.approval.configure",
      "epic.businesscase.submit",
      "epic.approval.decide",
      "epic.revision.start",
      "epic.owner.assign",
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
];

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
