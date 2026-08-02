import { MODULE_KEYS, firstEnabledHome, type ModuleKey } from "@/domain/modules";

/**
 * The post-login landing route for a principal. Pure; returns a locale-less path
 * (the caller prefixes the locale).
 *
 * - **Privater Free-Bereich** (`tenantKind === "personal"`) → das Home des ersten
 *   freigeschalteten Moduls (Personal-Set `["ziele"]` ⇒ `/ziele`).
 * - **Organisations-Tenant** → die persönliche Inbox `/my-tasks` (Core-Segment,
 *   immer verfügbar) — bewusst uniform „Meine Tasks zuerst", unabhängig von der
 *   Rolle.
 *
 * `roles` bleibt im Signatur-Vertrag (Aufrufer + Tests), wird aber aktuell nicht
 * mehr zur Verzweigung gebraucht.
 */
export function landingPathForRoles(
  _roles: readonly string[],
  enabledModules: readonly ModuleKey[] = MODULE_KEYS,
  tenantKind: string = "organization",
): string {
  if (tenantKind === "personal") return firstEnabledHome(enabledModules);
  return "/my-tasks";
}
