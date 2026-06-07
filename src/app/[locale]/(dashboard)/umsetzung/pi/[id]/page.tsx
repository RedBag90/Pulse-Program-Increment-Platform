import { Suspense } from "react";
import { redirect, notFound } from "next/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { InitiativeLevel } from "@/domain/types";
import { buildPiWorkspaceModel } from "@/server/views/pi-workspace";
import { PiWorkspaceShell } from "@/features/umsetzung/components/pi-workspace-shell";

/**
 * PI-Workspace-Page (Roadmap-P2.A · Skelett + Overview-Tab).
 *
 * Heute keine PI-spezifische Surface — RTE-Cockpit und PI-Planning
 * sind getrennte Apps. Diese Page bringt die PI als zentrale Achse,
 * mit Overview (Burnup, Confidence, Impediments, Days-left) und acht
 * Platzhalter-Tabs, in die in P2.B/P2.C die Bestands-Inhalte einziehen.
 */
export default async function PiWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;

  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const pi = await db.programIncrement.findFirst({
    where: { id, tenantId: principal.tenantId },
    select: {
      id: true,
      name: true,
      status: true,
      startDate: true,
      endDate: true,
      artId: true,
      art: { select: { id: true, name: true } },
      timeline: { select: { name: true } },
    },
  });

  if (!pi) notFound();

  const [features, objectives, impediments] = await Promise.all([
    db.initiative.findMany({
      where: {
        tenantId: principal.tenantId,
        level: InitiativeLevel.FEATURE,
        piId: pi.id,
        deletedAt: null,
      },
      select: { status: true, wsjfJobSize: true },
    }),
    db.piObjective.findMany({
      where: { tenantId: principal.tenantId, piId: pi.id },
      select: { committed: true, confidence: true },
    }),
    db.impediment.findMany({
      where: { tenantId: principal.tenantId, piId: pi.id },
      select: { status: true, roamStatus: true },
    }),
  ]);

  const model = buildPiWorkspaceModel({
    id: pi.id,
    name: pi.name,
    status: pi.status,
    startDate: pi.startDate,
    endDate: pi.endDate,
    artId: pi.artId ?? null,
    artName: pi.art?.name ?? null,
    timelineName: pi.timeline?.name ?? null,
    features,
    objectives,
    impediments,
  });

  return (
    <Suspense fallback={null}>
      <PiWorkspaceShell model={model} {...(tab !== undefined ? { activeTab: tab } : {})} />
    </Suspense>
  );
}
