import { z } from "zod";
import { createTenant, updateTenantEntitlements } from "@/server/services/tenant";
import { createMutationHandler } from "@/server/http/mutation-handler";
import { MODULE_KEYS } from "@/modules/core/kernel/domain/modules";

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
  // Mandanten anlegen ist Plattform-Sache. `authorize()` allein trägt das
  // nicht: `tenant.create` hat eine leere Grant-Liste und wurde deshalb nur
  // vom `tenant_admin`-Fast-Path erlaubt — und den hat jeder in seinem eigenen
  // privaten Bereich.
  platformOnly: true,
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) =>
    createTenant(ctx, {
      name: input.name,
      region: input.region,
      ...(input.kind ? { kind: input.kind } : {}),
      ...(input.enabledModules ? { enabledModules: input.enabledModules } : {}),
    }),
});

// Entitlement-Pflege (Freemium): Modul-Set eines Tenants setzen. Entitlements
// sind Plattform-Sache, kein tenant-seitiges Self-Service — und diese Route
// schreibt auf die `tenantId` aus dem **Body**, während `authorize()` nur über
// den **aktiven** Mandanten entscheiden kann. Genau diese Lücke stand hier
// offen: jeder angemeldete Nutzer konnte die Module jedes Mandanten setzen.
const updateEntitlementsSchema = z.object({
  tenantId: z.string().uuid(),
  enabledModules: z.array(moduleKeyEnum),
});

export const PATCH = createMutationHandler({
  schema: updateEntitlementsSchema,
  action: "tenant.create",
  platformOnly: true,
  resource: (input, _p) => ({ tenantId: input.tenantId }),
  service: (ctx, input) => updateTenantEntitlements(ctx, input),
});
