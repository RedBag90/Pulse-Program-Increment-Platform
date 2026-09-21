"use server";

import { headers } from "next/headers";
import { requirePrincipal } from "@/server/auth/principal";
import { authorize } from "@/server/auth/authorize";
import { createPrismaClient } from "@/server/db/prisma";
import { extractRequestMeta } from "@/server/audit/emit";
import { eraseUserRecords } from "@/server/services/gdpr";
import type { RequestContext } from "@/server/http/mutation-handler";
import { isErr } from "@/modules/core/kernel/domain/errors";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { UserId } from "@/modules/core/kernel/domain/types";

/**
 * **Zugang entziehen und Datensaetze im eigenen Mandanten loeschen.** Das Auth-
 * Konto bleibt stehen — es gehoert der Plattform, nicht dem Mandanten.
 *
 * **Bis September 2026 loeschte diese Action das Konto global**, und darin lag
 * ein Loch: sie nimmt eine beliebige `userId`, prueft `tenant.users.manage`
 * **im eigenen** Mandanten und dass man sich nicht selbst loescht. Ob der
 * Zielnutzer ueberhaupt Mitglied ist, prueft niemand — `eraseUserRecords` lief
 * fuer einen Fremden ins Leere, `admin.auth.admin.deleteUser(userId)` lief
 * trotzdem. Und weil jeder in seinem „Mein Bereich" `tenant_admin` ist,
 * passierte **jeder eingeloggte Nutzer** den Fast-Path in `authorize()`. Wer
 * eine fremde UUID kannte, loeschte das Konto.
 *
 * Geschlossen wurde das nicht mit einer Pruefung davor, sondern damit, dass der
 * Aufruf hier **verschwunden** ist: eine entfernte Schaltflaeche schuetzt keine
 * Server-Action, ein entfernter Aufruf schon. Das endgueltige Loeschen liegt
 * jetzt in der Plattform-Verwaltung (`features/platform/actions/user-actions.ts`),
 * neben Sperren und Entsperren — dort, wo Konten ohnehin angefasst werden.
 *
 * Audit-Historie und verfasste Datensaetze bleiben mit der nun namenlosen
 * userId stehen.
 */
export async function eraseUserAction(userId: string): Promise<{ error?: string }> {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  if (!authorize("tenant.users.manage", { tenantId: principal.tenantId }, principal).allow) {
    return { error: "Insufficient permissions" };
  }
  if (userId === principal.id) {
    return { error: "You cannot erase your own account." };
  }

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const { ipAddress, userAgent } = extractRequestMeta(await headers());
  const ctx: RequestContext = {
    principal,
    db,
    ...(ipAddress !== undefined && { ipAddress }),
    ...(userAgent !== undefined && { userAgent }),
  };
  const result = await eraseUserRecords(ctx, { userId: userId as UserId });
  if (isErr(result)) return { error: "Failed to erase the user's records." };

  revalidatePath("/admin/users");
  redirect("/admin/users");
}
