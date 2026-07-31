import { ROLES } from "@/domain/roles";
import { MODULE_KEYS, moduleForPath, firstEnabledHome, type ModuleKey } from "@/domain/modules";

/**
 * The post-login landing route for a principal, by role — so each user starts
 * where their work is instead of always on the portfolio Kanban. Pure; takes
 * the role set (as stored on the principal, plain strings) and returns a
 * locale-less path (the caller prefixes the locale).
 *
 * Priority order matters: a user may hold several roles, so the most
 * transformation/portfolio-senior role wins, down to execution and read-only.
 *
 * Modul-bewusst (Entitlement-Achse): der Rollen-Kandidat gilt nur, wenn sein
 * Modul im Tenant freigeschaltet ist — sonst das Home des ersten erlaubten
 * Moduls (Personal-Tenant: tenant_admin landet auf /ziele statt /portfolio).
 */
export function landingPathForRoles(
  roles: readonly string[],
  enabledModules: readonly ModuleKey[] = MODULE_KEYS,
): string {
  const has = (r: string) => roles.includes(r);

  const candidate = (() => {
    if (has(ROLES.PLATFORM_ADMIN) || has(ROLES.TENANT_ADMIN)) return "/portfolio";
    if (has(ROLES.PORTFOLIO_MANAGER) || has(ROLES.VALUE_STREAM_OWNER) || has(ROLES.EPIC_OWNER)) {
      return "/portfolio";
    }
    if (has(ROLES.RTE) || has(ROLES.FEATURE_OWNER)) return "/structure?tab=arts";
    if (has(ROLES.VIEWER)) return "/reporting/portfolio-health";
    return "/portfolio";
  })();

  const mod = moduleForPath(candidate.split("?")[0]!);
  const allowed = mod === "core" || (mod !== null && enabledModules.includes(mod));
  return allowed ? candidate : firstEnabledHome(enabledModules);
}
