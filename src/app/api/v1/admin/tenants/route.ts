import { z } from "zod";
import { createTenant, updateTenantEntitlements } from "@/server/services/tenant";
import { createMutationHandler } from "@/server/http/mutation-handler";
import { MODULE_KEYS } from "@/domain/modules";

const moduleKeyEnum = z.enum(MODULE_KEYS);

const createTenantSchema = z.object({
  name: z.string().min(2).max(100),
  region: z.enum(["EU", "US", "APAC"]),
  /** "organization" (Default) | "personal". */
  kind: z.enum(["organization", "personal"]).optional(),
  /** Entitlement-Set; leer/weggelassen = kind-Default (org → alle Module). */
  enabledModules: z.array(moduleKeyEnum).optional(),
});

export const POST = createMutationHandler({
  schema: createTenantSchema,
  action: "tenant.create",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) =>
    createTenant(ctx, {
      name: input.name,
      region: input.region,
      ...(input.kind ? { kind: input.kind } : {}),
      ...(input.enabledModules ? { enabledModules: input.enabledModules } : {}),
    }),
});

// Entitlement-Pflege (Freemium): Modul-Set eines Tenants setzen. Gleiches
// Gate wie das Anlegen (`tenant.create` = platform_admin-only Fast-Path) —
// Entitlements sind Plattform-Sache, kein tenant-seitiges Self-Service.
const updateEntitlementsSchema = z.object({
  tenantId: z.string().uuid(),
  enabledModules: z.array(moduleKeyEnum),
});

export const PATCH = createMutationHandler({
  schema: updateEntitlementsSchema,
  action: "tenant.create",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) => updateTenantEntitlements(ctx, input),
});
