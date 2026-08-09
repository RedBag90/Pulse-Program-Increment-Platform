"use server";

import { z } from "zod";
import { inviteUser } from "@/server/services/invitation";
import { createServerAction } from "@/server/http/server-action";
import { ROLES } from "@/modules/core/kernel/domain/roles";
import type { Role } from "@/modules/core/kernel/domain/roles";
import { formatDomainError } from "@/server/http/domain-error-display";

export interface InviteUserState {
  error?: string;
  success?: boolean;
}

export const inviteUserAction = createServerAction({
  schema: z.object({
    email: z.string().email(),
    role: z.enum(Object.values(ROLES) as [Role, ...Role[]]),
    locale: z.enum(["en", "de"]),
  }),
  action: "tenant.users.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) =>
    inviteUser(ctx, {
      tenantName: ctx.principal.tenantId,
      inviterEmail: ctx.principal.email,
      inviteeEmail: input.email,
      role: input.role,
      locale: input.locale,
    }),
  mapError: (e) => formatDomainError(e, { fallback: "Failed to send invitation" }),
});
