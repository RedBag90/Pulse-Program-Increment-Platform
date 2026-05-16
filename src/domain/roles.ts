export const ROLES = {
  PLATFORM_ADMIN: "platform_admin",
  TENANT_ADMIN: "tenant_admin",
  PORTFOLIO_EDITOR: "portfolio_editor",
  ARCHITECT_VIEWER: "architect_viewer",
  ART_FULL_EDITOR: "art_full_editor",
  FEATURE_EDITOR: "feature_editor",
  ART_ARCH_VIEWER: "art_arch_viewer",
  TEAM_EDITOR: "team_editor",
  STORY_OWNER: "story_owner",
  TASK_OWNER: "task_owner",
  PORTFOLIO_VIEWER: "portfolio_viewer",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ALL_ROLES = Object.values(ROLES) as Role[];
