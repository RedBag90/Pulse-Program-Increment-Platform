/**
 * Tenant role set — SAFe-oriented. Platform/tenant admins govern the system;
 * portfolio / value-stream / epic-owner / VMO operate the portfolio layer;
 * RTE / feature-owner operate the program layer; the team roles operate
 * execution; `viewer` is read-only.
 */
export const ROLES = {
  PLATFORM_ADMIN: "platform_admin",
  TENANT_ADMIN: "tenant_admin",
  PORTFOLIO_MANAGER: "portfolio_manager",
  VALUE_STREAM_OWNER: "value_stream_owner",
  EPIC_OWNER: "epic_owner",
  VMO: "vmo",
  RTE: "rte",
  FEATURE_OWNER: "feature_owner",
  TEAM_EDITOR: "team_editor",
  STORY_OWNER: "story_owner",
  TASK_OWNER: "task_owner",
  VIEWER: "viewer",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ALL_ROLES = Object.values(ROLES) as Role[];
