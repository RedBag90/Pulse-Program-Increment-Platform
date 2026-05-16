"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { verifyInviteToken } from "@/server/services/invitation";
import { acceptInvitation } from "@/server/services/invitation";
import { createPrismaClient } from "@/server/db/prisma";
import { isErr } from "@/domain/errors";
import { headers } from "next/headers";
import { extractRequestMeta } from "@/server/audit/emit";
import type { UserId } from "@/domain/types";
import type { TenantId } from "@/domain/types";

const acceptSchema = z.object({
  token: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});

// Justified exception: acceptInviteAction uses Supabase auth.signUp() — there is no
// requirePrincipal() caller, so it cannot go through the createServerAction wrapper.
export type AcceptInviteState = { error?: string };

export async function acceptInviteAction(
  _prev: AcceptInviteState,
  formData: FormData,
): Promise<AcceptInviteState> {
  const parsed = acceptSchema.safeParse({
    token: formData.get("token"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const claimsResult = await verifyInviteToken(parsed.data.token);
  if (isErr(claimsResult)) {
    return { error: "Invitation link is invalid or expired" };
  }

  const { tenantId, email } = claimsResult.value;

  const supabase = await createClient();
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password: parsed.data.password,
  });

  if (signUpError || !signUpData.user) {
    return { error: signUpError?.message ?? "Failed to create account" };
  }

  const userId = signUpData.user.id as UserId;
  const { ipAddress, userAgent } = extractRequestMeta(await headers());

  const db = createPrismaClient({ userId, tenantId: tenantId as TenantId });

  const result = await acceptInvitation(db, {
    token: parsed.data.token,
    userId,
    ipAddress,
    userAgent,
  });

  if (isErr(result)) {
    return {
      error: result.error.kind === "conflict" ? result.error.reason : "Failed to complete setup",
    };
  }

  redirect("/portfolio");
}
