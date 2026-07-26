/**
 * Tenant role set — SAFe-oriented (8 roles). Platform/tenant admins govern the
 * system; `portfolio_manager` is the consolidated portfolio lead — LPM plus the
 * former transformation-lead (operating model / KPI valuation) and VMO (Epic-QS
 * decisions); `value_stream_owner` / `epic_owner` round out the portfolio layer;
 * `rte` orchestrates the program (PIs, teams, PI objectives, Feature-QS) and
 * `feature_owner` the Feature backlog; `viewer` is read-only.
 */
export const ROLES = {
  PLATFORM_ADMIN: "platform_admin",
  TENANT_ADMIN: "tenant_admin",
  PORTFOLIO_MANAGER: "portfolio_manager",
  VALUE_STREAM_OWNER: "value_stream_owner",
  EPIC_OWNER: "epic_owner",
  RTE: "rte",
  FEATURE_OWNER: "feature_owner",
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
  portfolio_manager: "Portfolio Manager",
  value_stream_owner: "Value Stream Owner",
  epic_owner: "Epic Owner",
  rte: "RTE (Feature-QS)",
  feature_owner: "Feature Owner",
  viewer: "Viewer",
};
