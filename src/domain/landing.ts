import { ROLES } from "@/domain/roles";

/**
 * The post-login landing route for a principal, by role — so each user starts
 * where their work is instead of always on the portfolio Kanban. Pure; takes
 * the role set (as stored on the principal, plain strings) and returns a
 * locale-less path (the caller prefixes the locale).
 *
 * Priority order matters: a user may hold several roles, so the most
 * transformation/portfolio-senior role wins, down to execution and read-only.
 */
export function landingPathForRoles(roles: readonly string[]): string {
  const has = (r: string) => roles.includes(r);

  if (has(ROLES.TRANSFORMATION_LEAD)) return "/transformation";
  if (has(ROLES.PLATFORM_ADMIN) || has(ROLES.TENANT_ADMIN)) return "/portfolio";
  if (
    has(ROLES.PORTFOLIO_MANAGER) ||
    has(ROLES.VALUE_STREAM_OWNER) ||
    has(ROLES.EPIC_OWNER) ||
    has(ROLES.VMO)
  ) {
    return "/portfolio";
  }
  if (has(ROLES.RTE) || has(ROLES.FEATURE_OWNER)) return "/structure?tab=arts";
  if (has(ROLES.TEAM_EDITOR) || has(ROLES.STORY_OWNER) || has(ROLES.TASK_OWNER)) return "/sprint";
  if (has(ROLES.VIEWER)) return "/reporting/portfolio-health";

  return "/portfolio";
}
