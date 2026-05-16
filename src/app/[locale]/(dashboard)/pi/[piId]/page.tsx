import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { getPi } from "@/server/services/pi";
import { PiTransitionButton } from "@/features/pi/components/pi-transition-button";
import { DeletePiButton } from "@/features/pi/components/delete-pi-button";
import { PiSubNav } from "@/features/pi/components/pi-sub-nav";
import {
  AssignFeaturesDialog,
  RemoveFromPiButton,
} from "@/features/pi/components/assign-features-dialog";
import { Breadcrumbs } from "@/components/nav/breadcrumbs";
import { Link } from "@/i18n/navigation";
import { redirect, notFound } from "next/navigation";
import { InitiativeLevel } from "@/domain/types";
import type { PiId, TenantId } from "@/domain/types";

interface Props {
  params: Promise<{ piId: string }>;
}

function formatDate(d: Date) {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

const STATUS_BADGE: Record<string, string> = {
  planned: "bg-gray-100 text-gray-700",
  active: "bg-green-100 text-green-800",
  completed: "bg-blue-100 text-blue-700",
};

export default async function PiDetailPage({ params }: Props) {
  const { piId } = await params;
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const pi = await getPi(db, principal.tenantId, piId as PiId);
  if (!pi) notFound();

  const badge = STATUS_BADGE[pi.status] ?? "bg-gray-100 text-gray-700";
  const totalDays = Math.round(
    (pi.endDate.getTime() - pi.startDate.getTime()) / (1000 * 60 * 60 * 24),
  );

  const canEdit =
    principal.roles.includes("portfolio_editor") ||
    principal.roles.includes("art_full_editor") ||
    principal.roles.includes("feature_editor") ||
    principal.roles.includes("tenant_admin") ||
    principal.roles.includes("platform_admin");

  // Features in the same ART that are not already in this PI (backlog + other PIs).
  const candidateRows = await db.initiative.findMany({
    where: {
      tenantId: principal.tenantId as TenantId,
      artId: pi.art.id,
      level: InitiativeLevel.FEATURE,
      deletedAt: null,
      // Backlog features (piId null) plus features in a different PI.
      OR: [{ piId: null }, { piId: { not: piId } }],
    },
    select: {
      id: true,
      title: true,
      wsjfComputed: true,
      pi: { select: { name: true } },
    },
    orderBy: { wsjfComputed: { sort: "desc", nulls: "last" } },
  });
  const candidates = candidateRows.map((c) => ({
    id: c.id,
    title: c.title,
    wsjfComputed: c.wsjfComputed !== null ? Number(c.wsjfComputed) : null,
    currentPiName: c.pi?.name ?? null,
  }));

  return (
    <main className="p-8 max-w-4xl mx-auto space-y-6">
      <Breadcrumbs
        items={[
          { label: "ARTs", href: "/art" },
          { label: pi.art.name, href: `/art/${pi.art.id}` },
          { label: pi.name },
        ]}
      />

      <PiSubNav piId={piId} />

      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex-1 space-y-1">
          <h1 className="text-2xl font-semibold">{pi.name}</h1>
          <p className="text-sm text-gray-500">
            {formatDate(pi.startDate)} – {formatDate(pi.endDate)} ({totalDays} days)
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${badge}`}>
            {pi.status}
          </span>
          <PiTransitionButton piId={piId} currentStatus={pi.status} />
          {canEdit && pi.status === "planned" && (
            <DeletePiButton piId={piId} artId={pi.art.id} name={pi.name} />
          )}
        </div>
      </div>

      {/* Sprints */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold">Sprints ({pi.sprints.length})</h2>
        {pi.sprints.length === 0 ? (
          <p className="text-sm text-gray-400">No sprints yet.</p>
        ) : (
          <div className="rounded-lg border divide-y">
            {pi.sprints.map((sprint) => (
              <div key={sprint.id} className="px-4 py-3 flex items-center justify-between text-sm">
                <div>
                  <span className="font-medium">Sprint {sprint.indexInPi}</span>
                  {sprint.team && (
                    <span className="ml-2 text-gray-400 text-xs">{sprint.team.name}</span>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-gray-500">
                    {formatDate(sprint.startDate)} – {formatDate(sprint.endDate)}
                  </span>
                  <Link
                    href={`/sprint/${sprint.id}`}
                    className="text-blue-600 hover:underline text-xs"
                  >
                    Board →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Features in this PI */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Features ({pi.initiatives.length})</h2>
          {canEdit && pi.status !== "completed" && (
            <AssignFeaturesDialog piId={piId} artId={pi.art.id} candidates={candidates} />
          )}
        </div>
        {pi.initiatives.length === 0 ? (
          <p className="text-sm text-gray-400">No features assigned to this PI yet.</p>
        ) : (
          <div className="rounded-lg border divide-y">
            {pi.initiatives.map((feature) => (
              <div key={feature.id} className="px-4 py-3 flex items-center justify-between text-sm">
                <Link href={`/feature/${feature.id}`} className="text-blue-700 hover:underline">
                  {feature.title}
                </Link>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  {feature.wsjfComputed !== null && (
                    <span className="font-medium text-blue-700">
                      WSJF {Number(feature.wsjfComputed).toFixed(2)}
                    </span>
                  )}
                  <span className="inline-block rounded-full px-2 py-0.5 bg-gray-100">
                    {feature.status}
                  </span>
                  {canEdit && pi.status !== "completed" && (
                    <RemoveFromPiButton featureId={feature.id} artId={pi.art.id} />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
