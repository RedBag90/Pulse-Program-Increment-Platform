import { redirect } from "next/navigation";
import { createPrismaClient } from "@/server/db/prisma";
import { getPrincipal, type Principal } from "@/server/auth/principal";
import type { UserId } from "@/domain/types";

/**
 * Plattform-Admin-Fundament (Roadmap P1). Der `platform_admin` verwaltet
 * tenant-ÜBERGREIFEND alle Tenants + User. Weil RLS in v1 Owner-Bypass ist
 * (nicht scharf gegen Prisma), ist die App-Gating-Schicht der einzige Wächter:
 * jeder `/platform/*`-Layout und jeder Platform-Service prüft hart über
 * `requirePlatformAdmin` / `assertPlatformAdmin` — NICHT über `authorize()`
 * (kein tenant_admin-Fast-Path, kein Capability-Grant).
 */

/**
 * Cross-tenant Prisma-Client für die Platform-Fläche. Explizit leerer
 * `tenantId` ⇒ der RLS-Claim trägt keinen Tenant; tenant-scoped Filter müssen
 * vom Aufrufer EXPLIZIT gesetzt werden. Bewusst greppbar (`platformDb`) und
 * nur in `(platform)`-Services zu verwenden (Konvention + Guard-Tests).
 */
export function platformDb(actorId: UserId) {
  return createPrismaClient({ userId: actorId, tenantId: "" });
}

/** Reiner Prädikat-Helfer — die globale, tenant-blinde Plattform-Admin-Rolle. */
export function isPlatformAdmin(principal: Principal | null): boolean {
  return principal?.isPlatformAdmin === true;
}

/**
 * Guard für den `(platform)`-Bereich (Layouts/Pages). Kein Prinzipal oder
 * kein Plattform-Admin ⇒ Redirect auf die Startseite (der Tenant-Chrome
 * übernimmt). Der Rückgabewert ist als non-null verengt (redirect wirft).
 */
export async function requirePlatformAdmin(): Promise<Principal> {
  const principal = await getPrincipal();
  if (!principal || !principal.isPlatformAdmin) {
    redirect("/");
  }
  return principal;
}

/**
 * Service-Seam-Variante: wirft statt zu redirecten (für Server-Actions/
 * Services, die kein Navigations-Redirect wollen). Gibt den verengten
 * Principal zurück.
 */
export function assertPlatformAdmin(principal: Principal | null): Principal {
  if (!principal || !principal.isPlatformAdmin) {
    throw new Error("Forbidden — platform_admin required");
  }
  return principal;
}
