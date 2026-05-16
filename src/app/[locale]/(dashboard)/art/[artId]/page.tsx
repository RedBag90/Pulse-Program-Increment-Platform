import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { getArt } from "@/server/services/art";
import { ArtSubNav } from "@/features/art/components/art-sub-nav";
import { Link } from "@/i18n/navigation";
import { redirect, notFound } from "next/navigation";
import { InitiativeLevel } from "@/domain/types";
import type { ArtId, TenantId } from "@/domain/types";

interface Props {
  params: Promise<{ artId: string }>;
}

const STATUS_BADGE: Record<string, string> = {
  planned: "bg-gray-100 text-gray-700",
  active: "bg-green-100 text-green-800",
  completed: "bg-blue-100 text-blue-700",
};

function formatDate(d: Date) {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function ArtOverviewPage({ params }: Props) {
  const { artId } = await params;
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const [art, teamCount, featureCount] = await Promise.all([
    getArt(db, principal.tenantId, artId as ArtId),
    db.team.count({ where: { artId, tenantId: principal.tenantId as TenantId } }),
    db.initiative.count({
      where: {
        artId,
        tenantId: principal.tenantId as TenantId,
        level: InitiativeLevel.FEATURE,
        deletedAt: null,
      },
    }),
  ]);

  if (!art) notFound();

  const stats = [
    { label: "Program Increments", value: art.pis.length, href: `/art/${artId}/pi` as const },
    { label: "Teams", value: teamCount, href: `/art/${artId}/teams` as const },
    { label: "Features", value: featureCount, href: `/art/${artId}/features` as const },
  ];

  return (
    <main className="p-8 max-w-5xl mx-auto space-y-6">
      <ArtSubNav artId={artId} artName={art.name} />

      <div>
        <h1 className="text-xl font-semibold">{art.name}</h1>
        <p className="text-sm text-gray-500 mt-1">
          Value Stream: {art.valueStream.name}
          {art.piCadenceWeeks ? ` · PI cadence: ${art.piCadenceWeeks} weeks` : ""}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="rounded-lg border p-5 hover:border-blue-300 hover:shadow-sm transition-colors"
          >
            <p className="text-3xl font-bold text-gray-800">{s.value}</p>
            <p className="text-sm text-gray-500 mt-1">{s.label}</p>
          </Link>
        ))}
      </div>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Program Increments</h2>
        {art.pis.length === 0 ? (
          <p className="text-sm text-gray-400">No PIs yet.</p>
        ) : (
          <div className="rounded-lg border divide-y">
            {art.pis.map((pi) => (
              <Link
                key={pi.id}
                href={`/pi/${pi.id}`}
                className="px-4 py-3 flex items-center justify-between text-sm hover:bg-gray-50"
              >
                <span className="font-medium text-blue-700">{pi.name}</span>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span>
                    {formatDate(pi.startDate)} – {formatDate(pi.endDate)}
                  </span>
                  <span
                    className={`inline-block rounded-full px-2.5 py-0.5 font-medium ${
                      STATUS_BADGE[pi.status] ?? "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {pi.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
