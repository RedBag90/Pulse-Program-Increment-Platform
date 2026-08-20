import { redirect, notFound } from "next/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";

/**
 * Die eigenständige PI-Detailseite ist mit der Umsetzung-Konsolidierung
 * (Spec WP3) ins Delivery-Cockpit gewandert — das PI ist dort ein Scope
 * (`?pi=`) mit Kontext-Leiste (Fakten + Start/Fortschreiben/Löschen).
 *
 * Weicher Redirect, damit Bestands-Links (ART-Seiten, Ziele, Work-Features-
 * Tabelle, Breadcrumbs) weiter funktionieren. Der ART-Scope wird aus der
 * Timeline des PI aufgelöst, damit das Cockpit direkt im richtigen ART landet.
 */
export default async function PiDetailRedirect({
  params,
}: {
  params: Promise<{ piId: string }>;
}): Promise<never> {
  const { piId } = await params;

  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const pi = await db.programIncrement.findFirst({
    where: { id: piId, tenantId: principal.tenantId },
    select: { id: true, timeline: { select: { arts: { select: { id: true }, take: 1 } } } },
  });
  if (!pi) notFound();

  const artId = pi.timeline?.arts[0]?.id;
  redirect(artId ? `/umsetzung?art=${artId}&pi=${piId}` : `/umsetzung?pi=${piId}`);
}
