"use server";

import { z } from "zod";
import { submitJoinRequest } from "@/server/services/tenant-invite";

/**
 * Öffentliche Server-Action der Beitritts-Seite (kein Auth). Entweder ein
 * Link-Token (aus `/join/[token]`) oder ein Code (aus `/join`) plus E-Mail.
 * `autoAccepted` signalisiert der Seite den Sofort-Beitritt vs. „wartet auf
 * Freigabe".
 */
export interface SubmitJoinState {
  error?: string;
  success?: boolean;
  autoAccepted?: boolean;
}

export async function submitJoinAction(
  _prev: SubmitJoinState,
  formData: FormData,
): Promise<SubmitJoinState> {
  const parsed = z
    .object({
      email: z.string().email("Ungültige E-Mail"),
      token: z.string().optional(),
      code: z.string().optional(),
    })
    .safeParse({
      email: formData.get("email"),
      token: formData.get("token") ?? undefined,
      code: formData.get("code") ?? undefined,
    });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };
  }
  if (!parsed.data.token && !parsed.data.code) {
    return { error: "Kein Einladungslink oder Code angegeben" };
  }

  const res = await submitJoinRequest({
    ...(parsed.data.token ? { token: parsed.data.token } : {}),
    ...(parsed.data.code ? { code: parsed.data.code } : {}),
    email: parsed.data.email,
  });
  if (!res.ok) return { error: res.error };
  return { success: true, autoAccepted: res.autoAccepted };
}
