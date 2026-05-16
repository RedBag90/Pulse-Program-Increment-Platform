"use server";

import { z } from "zod";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { inviteUser } from "@/server/services/invitation";
import { authorize } from "@/server/auth/authorize";
import { ROLES } from "@/domain/roles";
import { headers } from "next/headers";
import { extractRequestMeta } from "@/server/audit/emit";
import { isErr } from "@/domain/errors";
import type { Role } from "@/domain/roles";

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(Object.values(ROLES) as [Role, ...Role[]]),
  locale: z.enum(["en", "de"]).default("en"),
});

export interface InviteUserState {
  error?: string;
  success?: boolean;
}

export async function inviteUserAction(
  _prev: InviteUserState,
  formData: FormData,
): Promise<InviteUserState> {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) return { error: "Not authenticated" };

  if (!authorize("tenant.users.manage", { tenantId: principal.tenantId }, principal).allow) {
    return { error: "Insufficient permissions" };
  }

  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role"),
    locale: formData.get("locale") ?? "en",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { ipAddress, userAgent } = extractRequestMeta(await headers());
  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const result = await inviteUser(db, {
    tenantId: principal.tenantId,
    tenantName: principal.tenantId,
    inviterEmail: principal.email,
    actorId: principal.id,
    inviteeEmail: parsed.data.email,
    role: parsed.data.role,
    locale: parsed.data.locale,
    ipAddress,
    userAgent,
  });

  if (isErr(result)) {
    return {
      error: result.error.kind === "conflict" ? result.error.reason : "Failed to send invitation",
    };
  }

  return { success: true };
}
