import { redirect, notFound } from "next/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";

/**
 * Permanent-Redirect: das alte PI-Workspace (Plan / Execution / Objectives /
 * Dependencies / Impediments / Closure / Demo / Risks) ist mit dem
 * Delivery-Cockpit abgelöst. PI-Governance-Themen wandern in Folge-Module;
 * Terminierung und Abarbeitung leben im Cockpit unter `/umsetzung`.
 *
 * **Die ART muss mit.** Vorher leitete diese Route auf `?pi=<id>` um, ohne sie
 * aufzulösen — der Loader fiel dann auf den ersten ART des Nutzers zurück, lud
 * die PIs einer **anderen** Timeline, fand das verlinkte PI dort nicht und
 * wählte still das aktive. Der Deeplink zeigte also verlässlich auf das falsche
 * PI. Die Schwesterroute `/pi/[piId]` macht es seit je richtig; hier steht
 * dasselbe Vorgehen.
 */
export default async function PiWorkspaceRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<never> {
  const { id } = await params;

  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const pi = await db.programIncrement.findFirst({
    where: { id, tenantId: principal.tenantId },
    select: {
      id: true,
      artId: true,
      timeline: { select: { arts: { select: { id: true }, take: 1 } } },
    },
  });
  if (!pi) notFound();

  const artId = pi.artId ?? pi.timeline?.arts[0]?.id;
  redirect(artId ? `/umsetzung?art=${artId}&pi=${id}` : `/umsetzung?pi=${id}`);
}
