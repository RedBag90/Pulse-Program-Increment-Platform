"use server";

import { headers } from "next/headers";
import { forgotPasswordSchema } from "@/domain/schemas/auth";
import { createClient } from "@/lib/supabase/server";

export interface ForgotPasswordState {
  ok: boolean;
  error?: string;
}

/**
 * Sends a Supabase password-reset email. Always reports success so the form
 * never reveals whether an account exists for the given address.
 */
export async function forgotPassword(
  _prev: ForgotPasswordState | null,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { ok: false, error: "Please enter a valid email address." };
  }

  const locale = (formData.get("locale") as string | null) ?? "en";
  const hdrs = await headers();
  const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host") ?? "localhost:3000";
  const proto = hdrs.get("x-forwarded-proto") ?? "http";
  const redirectTo = `${proto}://${host}/api/auth/callback?next=/${locale}/reset-password`;

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, { redirectTo });

  return { ok: true };
}
