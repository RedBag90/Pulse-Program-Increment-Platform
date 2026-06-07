import { Suspense } from "react";
import { redirect, notFound } from "next/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { InitiativeLevel } from "@/domain/types";
import { buildRteCockpitModel } from "@/server/views/rte-cockpit";
import { buildArtHubModel, buildArtHistory, type ArtNextPi } from "@/server/views/art-hub";
import { ArtHubShell } from "@/features/umsetzung/components/art-hub-shell";

const DAY_MS = 24 * 60 * 60 * 1000;

function daysFrom(now: Date, target: Date): number {
  const a = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const b = Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate());
  return Math.round((b - a) / DAY_MS);
}

/**
 * ART-Hub (Roadmap-P3.A · Skelett + Active-PI-Hero + Next-PI-Card).
 *
 * Loader reuses `buildRteCockpitModel` fuer den Hero + Today-Counters
 * + Team-RAG-Daten und ergaenzt um den naechsten geplanten PI. History
 * und Teams-Tabs sind in P3.A Platzhalter; ziehen mit P3.B nach.
 */
export default async function ArtHubPage({
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

  const art = await db.art.findFirst({
    where: { id, tenantId: principal.tenantId, deletedAt: null },
    select: {
      id: true,
      name: true,
      timelineId: true,
      timeline: { select: { name: true } },
    },
  });
  if (!art) notFound();

  const now = new Date();

  // RTE-Cockpit als Datenquelle wiederverwenden — liefert Hero +
  // Today-Counters + Teams-RAG + Epic-Rollup in einem Zug.
  const cockpit = await buildRteCockpitModel(db, principal, art.id, now);

  // Naechster PI: erstes „planned" PI am ART (oder an der Timeline,
  // wenn der ART einer beitritt).
  const nextPiRaw = art.timelineId
    ? await db.programIncrement.findFirst({
        where: {
          tenantId: principal.tenantId,
          timelineId: art.timelineId,
          status: "planned",
        },
        orderBy: { startDate: "asc" },
        select: { id: true, name: true, startDate: true, endDate: true },
      })
    : null;

  let nextPi: ArtNextPi | null = null;
  if (nextPiRaw) {
    const [features, committedObjectives] = await Promise.all([
      db.initiative.count({
        where: {
          tenantId: principal.tenantId,
          level: InitiativeLevel.FEATURE,
          piId: nextPiRaw.id,
          deletedAt: null,
        },
      }),
      db.piObjective.count({
        where: { tenantId: principal.tenantId, piId: nextPiRaw.id, committed: true },
      }),
    ]);
    nextPi = {
      id: nextPiRaw.id,
      name: nextPiRaw.name,
      startDate: nextPiRaw.startDate,
      endDate: nextPiRaw.endDate,
      daysUntilStart: daysFrom(now, nextPiRaw.startDate),
      plannedFeatureCount: features,
      committedObjectiveCount: committedObjectives,
    };
  }

  // PI-Historie: alle completed PIs der Timeline (oder direkt am ART, wenn
  // kein Timeline-Verbund), max. 8 — Predictability + Confidence-Avg pro PI.
  const closedPisRaw = art.timelineId
    ? await db.programIncrement.findMany({
        where: {
          tenantId: principal.tenantId,
          timelineId: art.timelineId,
          status: "completed",
        },
        orderBy: { endDate: "desc" },
        take: 8,
        select: { id: true, name: true, startDate: true, endDate: true },
      })
    : [];

  let history: ReturnType<typeof buildArtHistory> = [];
  if (closedPisRaw.length > 0) {
    const closedPiIds = closedPisRaw.map((p) => p.id);
    const [closedFeatures, closedObjectives] = await Promise.all([
      db.initiative.findMany({
        where: {
          tenantId: principal.tenantId,
          artId: art.id,
          level: InitiativeLevel.FEATURE,
          piId: { in: closedPiIds },
          deletedAt: null,
        },
        select: { piId: true, status: true },
      }),
      db.piObjective.findMany({
        where: { tenantId: principal.tenantId, piId: { in: closedPiIds }, team: { artId: art.id } },
        select: { piId: true, committed: true, confidence: true },
      }),
    ]);
    history = buildArtHistory({
      closedPis: closedPisRaw,
      features: closedFeatures
        .filter((f): f is { piId: string; status: string } => f.piId != null)
        .map((f) => ({ piId: f.piId, status: f.status })),
      objectives: closedObjectives.map((o) => ({
        piId: o.piId,
        committed: o.committed,
        confidence: o.confidence,
      })),
    });
  }

  const model = buildArtHubModel({
    artId: art.id,
    artName: art.name,
    timelineName: art.timeline?.name ?? null,
    cockpit,
    nextPi,
    history,
    now,
  });

  return (
    <Suspense fallback={null}>
      <ArtHubShell model={model} {...(tab !== undefined ? { activeTab: tab } : {})} />
    </Suspense>
  );
}
