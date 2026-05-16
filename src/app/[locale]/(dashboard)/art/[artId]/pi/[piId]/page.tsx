import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { getPi } from "@/server/services/pi";
import { Link } from "@/i18n/navigation";
import { redirect, notFound } from "next/navigation";
import type { PiId } from "@/domain/types";

interface Props {
  params: Promise<{ artId: string; piId: string }>;
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
  const { artId, piId } = await params;
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const pi = await getPi(db, principal.tenantId, piId as PiId);
  if (!pi) notFound();

  const badge = STATUS_BADGE[pi.status] ?? "bg-gray-100 text-gray-700";
  const totalDays = Math.round(
    (pi.endDate.getTime() - pi.startDate.getTime()) / (1000 * 60 * 60 * 24),
  );

  return (
    <main className="p-8 max-w-4xl mx-auto space-y-8">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500 flex items-center gap-1">
        <Link href="/art" className="hover:underline">
          ARTs
        </Link>
        <span>/</span>
        <Link href={`/art/${artId}/pi`} className="hover:underline">
          {pi.art.name}
        </Link>
        <span>/</span>
        <span className="text-gray-800 font-medium">{pi.name}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex-1 space-y-1">
          <h1 className="text-2xl font-semibold">{pi.name}</h1>
          <p className="text-sm text-gray-500">
            {formatDate(pi.startDate)} – {formatDate(pi.endDate)} ({totalDays} days)
          </p>
        </div>
        <span
          className={`inline-block rounded-full px-3 py-1 text-xs font-medium shrink-0 ${badge}`}
        >
          {pi.status}
        </span>
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
                <span className="font-medium">Sprint {sprint.indexInPi}</span>
                <span className="text-gray-500">
                  {formatDate(sprint.startDate)} – {formatDate(sprint.endDate)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Features in this PI */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold">Features ({pi.initiatives.length})</h2>
        {pi.initiatives.length === 0 ? (
          <p className="text-sm text-gray-400">No features assigned to this PI yet.</p>
        ) : (
          <div className="rounded-lg border divide-y">
            {pi.initiatives.map((feature) => (
              <div key={feature.id} className="px-4 py-3 flex items-center justify-between text-sm">
                <Link
                  href={`/art/${artId}/features/${feature.id}`}
                  className="text-blue-700 hover:underline"
                >
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
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
