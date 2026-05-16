"use server";

import { redirect } from "next/navigation";
import { resetPasswordSchema } from "@/domain/schemas/auth";
import { createClient } from "@/lib/supabase/server";

export interface ResetPasswordState {
  ok: false;
  error: string;
}

/**
 * Sets a new password for the recovery session established by the email link
 * (exchanged for a session in /api/auth/callback).
 */
export async function resetPassword(
  _prev: ResetPasswordState | null,
  formData: FormData,
): Promise<ResetPasswordState | never> {
  const parsed = resetPasswordSchema.safeParse({ password: formData.get("password") });
  if (!parsed.success) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) {
    return {
      ok: false,
      error: "Your reset link is invalid or has expired. Request a new one.",
    };
  }

  redirect("/sign-in?reset=1");
}
