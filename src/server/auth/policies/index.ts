import { ROLES, type Role } from "@/domain/roles";

/**
 * The set of authorizable actions. Read actions are not gated here — RLS
 * handles tenant-scoped visibility; these cover state-changing actions.
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
  | "epic.delete"
  | "epic.hypothesis.submit"
  | "epic.hypothesis.decide"
  | "epic.approval.configure"
  | "epic.businesscase.submit"
  | "epic.approval.decide"
  | "epic.section.signoff"
  | "epic.revision.start"
  | "art.create"
  | "art.update"
  | "art.delete"
  | "feature.create"
  | "feature.update"
  | "feature.wsjf.set"
  | "feature.delete"
  | "feature.review.submit"
  | "feature.review.decide"
  | "story.create"
  | "story.update"
  | "story.delete"
  | "task.create"
  | "task.edit"
  | "pi.create"
  | "pi.update"
  | "pi.start"
  | "pi.complete"
  | "pi.delete"
  | "pi_objective.create"
  | "pi_objective.update"
  | "team.create"
  | "team.update"
  | "team.delete"
  | "dependency.link"
  | "dependency.unlink"
  | "impediment.create"
  | "impediment.escalate"
  | "impediment.resolve"
  | "admin.audit-log.read"
  | "admin.users.read";

/** A scope dimension a grant may additionally require the principal to match. */
export type ScopeCheck = "value_stream" | "art" | "team" | "own";

export interface Grant {
  roles: Role[];
  /** When set, the principal must also satisfy this scope against the resource. */
  scope?: ScopeCheck;
}

const {
  PORTFOLIO_MANAGER,
  VALUE_STREAM_OWNER,
  EPIC_OWNER,
  VMO,
  RTE,
  FEATURE_OWNER,
  TEAM_EDITOR,
  STORY_OWNER,
  TASK_OWNER,
  TENANT_ADMIN,
} = ROLES;

/**
 * Policy registry: action → grants. A request is allowed if it satisfies ANY
 * grant. `platform_admin` and `tenant_admin` are allowed everything and are
 * handled in authorize().
 */
export const POLICIES: Record<Action, Grant[]> = {
  // ── Governance ──────────────────────────────────────────────────────────
  // Platform- and tenant-level administration. `tenant_admin` already passes
  // every action via authorize(); the explicit grants document intent.
  "tenant.create": [], // platform_admin only
  "tenant.users.manage": [{ roles: [TENANT_ADMIN] }],
  "integration.manage": [{ roles: [TENANT_ADMIN] }],
  "admin.audit-log.read": [{ roles: [TENANT_ADMIN] }],
  "admin.users.read": [{ roles: [TENANT_ADMIN] }],

  // ── Portfolio ───────────────────────────────────────────────────────────
  // The portfolio manager funds value streams and owns the Epic backlog.
  // `epic.approve` gates the L0–L5 stage gates — a separate axis from the
  // multi-party approval workflow (epic.hypothesis.*/approval.*).
  "value_stream.create": [{ roles: [PORTFOLIO_MANAGER] }],
  "epic.delete": [{ roles: [PORTFOLIO_MANAGER, TENANT_ADMIN] }],
  "epic.approve": [{ roles: [PORTFOLIO_MANAGER, VMO] }],

  // ── Value Stream ────────────────────────────────────────────────────────
  // The value stream owner manages their own value stream and the Epics
  // within it — value_stream-scoped, so they cannot touch foreign streams.
  "value_stream.update": [
    { roles: [PORTFOLIO_MANAGER] },
    { roles: [VALUE_STREAM_OWNER], scope: "value_stream" },
  ],
  "epic.create": [
    { roles: [PORTFOLIO_MANAGER, EPIC_OWNER] },
    { roles: [VALUE_STREAM_OWNER], scope: "value_stream" },
  ],
  "epic.update": [
    { roles: [PORTFOLIO_MANAGER, EPIC_OWNER] },
    { roles: [VALUE_STREAM_OWNER], scope: "value_stream" },
  ],

  // Multi-party approval workflow (sequential): the Epic Owner submits the
  // hypothesis (VMO decides), then configures + submits the Business Case for
  // stakeholder approval. `epic.approval.decide` is additionally gated in the
  // service to the assigned approver (the policy can't see the approval row).
  "epic.hypothesis.submit": [
    { roles: [EPIC_OWNER, PORTFOLIO_MANAGER] },
    { roles: [VALUE_STREAM_OWNER], scope: "value_stream" },
  ],
  "epic.hypothesis.decide": [{ roles: [VMO] }],
  "epic.approval.configure": [{ roles: [EPIC_OWNER, PORTFOLIO_MANAGER] }],
  "epic.businesscase.submit": [{ roles: [EPIC_OWNER, PORTFOLIO_MANAGER] }],
  "epic.approval.decide": [
    { roles: [PORTFOLIO_MANAGER, VALUE_STREAM_OWNER, VMO, RTE, FEATURE_OWNER] },
  ],
  "epic.section.signoff": [{ roles: [VMO, VALUE_STREAM_OWNER, PORTFOLIO_MANAGER] }],
  "epic.revision.start": [{ roles: [EPIC_OWNER, PORTFOLIO_MANAGER] }],

  // ── ART / Program ───────────────────────────────────────────────────────
  // ART lifecycle is a tenant-admin org-structure concern; the RTE orchestrates
  // the train (PIs, objectives, team updates) and runs Feature QS.
  "art.create": [{ roles: [TENANT_ADMIN] }],
  "art.update": [{ roles: [TENANT_ADMIN] }],
  "art.delete": [{ roles: [TENANT_ADMIN] }],

  "pi.create": [{ roles: [RTE] }],
  "pi.update": [{ roles: [RTE] }],
  "pi.start": [{ roles: [RTE] }],
  "pi.complete": [{ roles: [RTE] }],
  "pi.delete": [{ roles: [RTE] }],

  "pi_objective.create": [{ roles: [RTE, TEAM_EDITOR] }],
  "pi_objective.update": [{ roles: [RTE, TEAM_EDITOR] }],

  "team.create": [{ roles: [TENANT_ADMIN] }],
  "team.update": [{ roles: [RTE, TENANT_ADMIN] }],
  "team.delete": [{ roles: [TENANT_ADMIN] }],

  "feature.delete": [{ roles: [PORTFOLIO_MANAGER, RTE, TENANT_ADMIN] }],
  "feature.review.decide": [{ roles: [RTE] }],

  // ── Feature ─────────────────────────────────────────────────────────────
  // The feature owner owns the Feature backlog and WSJF scoring; the RTE and
  // portfolio manager may also act. Owners submit Features to Feature QS.
  "feature.create": [{ roles: [PORTFOLIO_MANAGER, RTE, FEATURE_OWNER] }],
  "feature.update": [{ roles: [PORTFOLIO_MANAGER, RTE, FEATURE_OWNER] }],
  "feature.wsjf.set": [{ roles: [PORTFOLIO_MANAGER, RTE, FEATURE_OWNER] }],
  "feature.review.submit": [{ roles: [FEATURE_OWNER, RTE, PORTFOLIO_MANAGER] }],

  // ── Story ───────────────────────────────────────────────────────────────
  // Team-level roles edit freely; program/portfolio roles only within their
  // ART scope.
  "story.create": [
    { roles: [TEAM_EDITOR, STORY_OWNER] },
    { roles: [PORTFOLIO_MANAGER, RTE, FEATURE_OWNER], scope: "art" },
  ],
  "story.update": [
    { roles: [TEAM_EDITOR, STORY_OWNER] },
    { roles: [PORTFOLIO_MANAGER, RTE, FEATURE_OWNER], scope: "art" },
  ],
  "story.delete": [
    { roles: [TEAM_EDITOR, STORY_OWNER] },
    { roles: [PORTFOLIO_MANAGER, RTE, TENANT_ADMIN], scope: "art" },
  ],

  // ── Task ────────────────────────────────────────────────────────────────
  // The task owner may edit only their own Tasks (scope: "own").
  "task.create": [
    { roles: [TEAM_EDITOR, STORY_OWNER] },
    { roles: [PORTFOLIO_MANAGER, RTE, FEATURE_OWNER], scope: "art" },
  ],
  "task.edit": [
    { roles: [TEAM_EDITOR, STORY_OWNER] },
    { roles: [TASK_OWNER], scope: "own" },
    { roles: [PORTFOLIO_MANAGER, RTE, FEATURE_OWNER], scope: "art" },
  ],

  // ── Dependencies ────────────────────────────────────────────────────────
  "dependency.link": [
    { roles: [PORTFOLIO_MANAGER, RTE, FEATURE_OWNER] },
    { roles: [TEAM_EDITOR], scope: "team" },
  ],
  "dependency.unlink": [
    { roles: [PORTFOLIO_MANAGER, RTE, FEATURE_OWNER] },
    { roles: [TEAM_EDITOR], scope: "team" },
  ],

  // ── Impediments ─────────────────────────────────────────────────────────
  // Anyone operating delivery may raise an impediment; escalation and
  // resolution stay with the coordinating roles.
  "impediment.create": [
    { roles: [PORTFOLIO_MANAGER, RTE, FEATURE_OWNER, TEAM_EDITOR, STORY_OWNER, TASK_OWNER] },
  ],
  "impediment.escalate": [{ roles: [PORTFOLIO_MANAGER, RTE, TEAM_EDITOR] }],
  "impediment.resolve": [{ roles: [PORTFOLIO_MANAGER, RTE, TEAM_EDITOR] }],
};
