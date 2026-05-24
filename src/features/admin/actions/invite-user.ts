"use server";

import { z } from "zod";
import { inviteUser } from "@/server/services/invitation";
import { createServerAction } from "@/server/http/server-action";
import { fields } from "@/server/http/form-data";
import { ROLES } from "@/domain/roles";
import type { Role } from "@/domain/roles";

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
  parseFormData: (fd) => {
    const f = fields(fd);
    return {
      email: f.string("email"),
      role: f.string("role"),
      locale: f.string("locale") ?? "en",
    };
  },
  service: (ctx, input) =>
    inviteUser(ctx, {
      tenantName: ctx.principal.tenantId,
      inviterEmail: ctx.principal.email,
      inviteeEmail: input.email,
      role: input.role,
      locale: input.locale,
    }),
  mapError: (e) => (e.kind === "conflict" ? e.reason : "Failed to send invitation"),
});
