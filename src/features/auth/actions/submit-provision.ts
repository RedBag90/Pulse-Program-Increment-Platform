"use server";

import { z } from "zod";
import { submitProvisionRequest } from "@/server/services/tenant-provision";

/**
 * Öffentliche Server-Action der „Organisation anfragen"-Seite (kein Auth). Legt
 * einen pending Provisioning-Antrag an; der platform_admin genehmigt später.
 */
export interface SubmitProvisionState {
  error?: string;
  success?: boolean;
}

export async function submitProvisionAction(
  _prev: SubmitProvisionState,
  formData: FormData,
): Promise<SubmitProvisionState> {
  const parsed = z
    .object({
      email: z.string().email("Ungültige E-Mail"),
      desiredName: z.string().trim().min(2, "Name zu kurz"),
      note: z.string().optional(),
    })
    .safeParse({
      email: formData.get("email"),
      desiredName: formData.get("desiredName"),
      note: formData.get("note") ?? undefined,
    });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };
  }

  const res = await submitProvisionRequest({
    email: parsed.data.email,
    desiredName: parsed.data.desiredName,
    ...(parsed.data.note ? { note: parsed.data.note } : {}),
  });
  if (!res.ok) return { error: res.error };
  return { success: true };
}
