"use server";

import { redirect } from "next/navigation";
import { signInSchema } from "@/domain/schemas/auth";
import { createClient } from "@/lib/supabase/server";

export interface SignInResult {
  ok: false;
  error: string;
}

export async function signIn(
  _prev: SignInResult | null,
  formData: FormData,
): Promise<SignInResult | never> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { ok: false, error: "Invalid email or password format." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { ok: false, error: "Invalid credentials. Please try again." };
  }

  redirect("/portfolio");
}
