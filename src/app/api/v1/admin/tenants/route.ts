import { z } from "zod";
import { createTenant } from "@/server/services/tenant";
import { createMutationHandler } from "@/server/http/mutation-handler";

const createTenantSchema = z.object({
  name: z.string().min(2).max(100),
  region: z.enum(["EU", "US", "APAC"]),
});

export const POST = createMutationHandler({
  schema: createTenantSchema,
  action: "tenant.create",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) =>
    createTenant(ctx.db, {
      name: input.name,
      region: input.region,
      actorId: ctx.principal.id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    }),
});
