/**
 * Tenant role set — SAFe-oriented. Platform/tenant admins govern the system;
 * portfolio / value-stream / epic-owner / VMO operate the portfolio layer;
 * RTE / feature-owner operate the program layer; the team roles operate
 * execution; `viewer` is read-only. `transformation_lead` (coach / SPC /
 * transformation office) owns the target operating model and drives the change.
 */
export const ROLES = {
  PLATFORM_ADMIN: "platform_admin",
  TENANT_ADMIN: "tenant_admin",
  TRANSFORMATION_LEAD: "transformation_lead",
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

/**
 * German UI labels for the role enum — shared by the admin / users page,
 * the invite form, and any future role picker. Lives alongside the enum so
 * a new role gets its label slot at the same time. Keep these short — the
 * filter chips and list rows render them tightly.
 */
export const ROLE_LABELS: Record<Role, string> = {
  platform_admin: "Platform-Admin",
  tenant_admin: "Tenant-Admin",
  transformation_lead: "Transformation Lead",
  portfolio_manager: "Portfolio Manager",
  value_stream_owner: "Value Stream Owner",
  epic_owner: "Epic Owner",
  vmo: "VMO (Epic-QS)",
  rte: "RTE (Feature-QS)",
  feature_owner: "Feature Owner",
  team_editor: "Team Editor",
  story_owner: "Story Owner",
  task_owner: "Task Owner",
  viewer: "Viewer",
};
