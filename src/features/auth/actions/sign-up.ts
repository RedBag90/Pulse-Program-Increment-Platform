"use server";

import { redirect } from "next/navigation";
import { signUpSchema } from "@/domain/schemas/auth";
import { createClient } from "@/lib/supabase/server";

export interface SignUpResult {
  ok: false;
  error: string;
}

export async function signUp(
  _prev: SignUpResult | null,
  formData: FormData,
): Promise<SignUpResult | never> {
  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { ok: false, error: "Please check the form fields and try again." };
  }

  // Kein Tenant-Code mehr: der persönliche Free-Tenant entsteht beim ersten
  // echten Login über /start (ensurePersonalTenant) — bewusst nicht schon
  // hier, damit unbestätigte E-Mail-Accounts keinen Tenant erzeugen.
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  redirect("/sign-in?registered=1");
}
