import { ROLES, type Role } from "@/domain/roles";

/**
 * The set of authorizable actions. Mirrors the permission matrix in
 * technical-concept §7.2. Read actions are not gated here — RLS handles
 * tenant-scoped visibility; these cover state-changing actions.
 */
export type Action =
  | "tenant.create"
  | "tenant.users.manage"
  | "integration.manage"
  | "value_stream.create"
  | "value_stream.update"
  | "epic.create"
  | "epic.update"
  | "epic.approve"
  | "art.create"
  | "art.update"
  | "feature.create"
  | "feature.update"
  | "feature.wsjf.set"
  | "story.create"
  | "story.update"
  | "task.create"
  | "task.edit"
  | "pi.create"
  | "pi.update"
  | "pi.start"
  | "pi.complete"
  | "pi_objective.create"
  | "pi_objective.update"
  | "team.create"
  | "team.update"
  | "dependency.link"
  | "dependency.unlink"
  | "impediment.create"
  | "impediment.escalate"
  | "impediment.resolve";

/** A scope dimension a grant may additionally require the principal to match. */
export type ScopeCheck = "art" | "team" | "own";

export interface Grant {
  roles: Role[];
  /** When set, the principal must also satisfy this scope against the resource. */
  scope?: ScopeCheck;
}

const {
  PORTFOLIO_EDITOR,
  ART_FULL_EDITOR,
  FEATURE_EDITOR,
  TEAM_EDITOR,
  STORY_OWNER,
  TASK_OWNER,
  TENANT_ADMIN,
} = ROLES;

/**
 * Policy registry: action → grants. A request is allowed if it satisfies ANY
 * grant. `platform_admin` is allowed everything and is handled in authorize().
 */
export const POLICIES: Record<Action, Grant[]> = {
  "tenant.create": [], // platform_admin only

  "tenant.users.manage": [{ roles: [TENANT_ADMIN] }],

  "integration.manage": [{ roles: [TENANT_ADMIN] }],

  "value_stream.create": [{ roles: [PORTFOLIO_EDITOR] }],
  "value_stream.update": [{ roles: [PORTFOLIO_EDITOR] }],

  "epic.create": [{ roles: [PORTFOLIO_EDITOR] }],
  "epic.update": [{ roles: [PORTFOLIO_EDITOR] }],
  "epic.approve": [{ roles: [PORTFOLIO_EDITOR] }],

  "art.create": [{ roles: [TENANT_ADMIN] }],
  "art.update": [{ roles: [TENANT_ADMIN] }],

  "feature.create": [{ roles: [PORTFOLIO_EDITOR, ART_FULL_EDITOR, FEATURE_EDITOR] }],
  "feature.update": [{ roles: [PORTFOLIO_EDITOR, ART_FULL_EDITOR, FEATURE_EDITOR] }],
  "feature.wsjf.set": [{ roles: [PORTFOLIO_EDITOR, ART_FULL_EDITOR, FEATURE_EDITOR] }],

  "story.create": [
    { roles: [TEAM_EDITOR, STORY_OWNER] },
    { roles: [PORTFOLIO_EDITOR, ART_FULL_EDITOR, FEATURE_EDITOR], scope: "art" },
  ],
  "story.update": [
    { roles: [TEAM_EDITOR, STORY_OWNER] },
    { roles: [PORTFOLIO_EDITOR, ART_FULL_EDITOR, FEATURE_EDITOR], scope: "art" },
  ],

  "task.create": [
    { roles: [TEAM_EDITOR, STORY_OWNER] },
    { roles: [PORTFOLIO_EDITOR, ART_FULL_EDITOR, FEATURE_EDITOR], scope: "art" },
  ],
  "task.edit": [
    { roles: [TEAM_EDITOR, STORY_OWNER] },
    { roles: [TASK_OWNER], scope: "own" },
    { roles: [PORTFOLIO_EDITOR, ART_FULL_EDITOR, FEATURE_EDITOR], scope: "art" },
  ],

  "pi.create": [{ roles: [ART_FULL_EDITOR] }],
  "pi.update": [{ roles: [ART_FULL_EDITOR] }],
  "pi.start": [{ roles: [ART_FULL_EDITOR] }],
  "pi.complete": [{ roles: [ART_FULL_EDITOR] }],

  "pi_objective.create": [{ roles: [ART_FULL_EDITOR, TEAM_EDITOR] }],
  "pi_objective.update": [{ roles: [ART_FULL_EDITOR, TEAM_EDITOR] }],

  "team.create": [{ roles: [TENANT_ADMIN] }],
  "team.update": [{ roles: [TENANT_ADMIN] }],

  "dependency.link": [
    { roles: [PORTFOLIO_EDITOR, ART_FULL_EDITOR, FEATURE_EDITOR] },
    { roles: [TEAM_EDITOR], scope: "team" },
  ],
  "dependency.unlink": [
    { roles: [PORTFOLIO_EDITOR, ART_FULL_EDITOR, FEATURE_EDITOR] },
    { roles: [TEAM_EDITOR], scope: "team" },
  ],

  "impediment.create": [
    { roles: [PORTFOLIO_EDITOR, ART_FULL_EDITOR, TEAM_EDITOR, STORY_OWNER, TASK_OWNER] },
  ],
  "impediment.escalate": [{ roles: [PORTFOLIO_EDITOR, ART_FULL_EDITOR, TEAM_EDITOR] }],
  "impediment.resolve": [{ roles: [PORTFOLIO_EDITOR, ART_FULL_EDITOR, TEAM_EDITOR] }],
};
