import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { PiSubNav } from "@/features/pi/components/pi-sub-nav";
import { Breadcrumbs } from "@/components/nav/breadcrumbs";
import { Link } from "@/i18n/navigation";
import { redirect, notFound } from "next/navigation";
import type { TenantId } from "@/domain/types";
import { InitiativeLevel } from "@/domain/types";
import { DependencyGraph } from "@/features/pi/components/dependency-graph";

interface Props {
  params: Promise<{ piId: string }>;
}

const TYPE_LABEL: Record<string, string> = {
  blocks: "blocks",
  depends_on: "depends on",
  relates_to: "relates to",
};
const TYPE_COLOR: Record<string, string> = {
  blocks: "text-red-600 border-red-300 bg-red-50",
  depends_on: "text-yellow-700 border-yellow-300 bg-yellow-50",
  relates_to: "text-gray-600 border-gray-200 bg-gray-50",
};

export default async function PiDependenciesPage({ params }: Props) {
  const { piId } = await params;
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const pi = await db.programIncrement.findFirst({
    where: { id: piId, tenantId: principal.tenantId as TenantId },
    include: { art: { select: { id: true, name: true } } },
  });
  if (!pi) notFound();

  // Get all features (level=1) in this PI
  const features = await db.initiative.findMany({
    where: {
      tenantId: principal.tenantId as TenantId,
      piId,
      level: InitiativeLevel.FEATURE,
      deletedAt: null,
    },
    select: { id: true, title: true, status: true },
  });

  const featureIds = features.map((f) => f.id);

  // Get all dependencies where either end is in this PI
  const deps = await db.dependency.findMany({
    where: {
      tenantId: principal.tenantId as TenantId,
      OR: [{ fromId: { in: featureIds } }, { toId: { in: featureIds } }],
    },
    include: {
      from: { select: { id: true, title: true, level: true, status: true } },
      to: { select: { id: true, title: true, level: true, status: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  // Build node set (unique initiatives referenced)
  const nodeMap = new Map<string, { id: string; title: string; status: string; inPi: boolean }>();
  for (const f of features) {
    nodeMap.set(f.id, { ...f, inPi: true });
  }
  for (const dep of deps) {
    if (!nodeMap.has(dep.from.id)) {
      nodeMap.set(dep.from.id, { ...dep.from, inPi: false });
    }
    if (!nodeMap.has(dep.to.id)) {
      nodeMap.set(dep.to.id, { ...dep.to, inPi: false });
    }
  }

  const nodes = [...nodeMap.values()];

  // Group deps by type for the legend
  const byType = { blocks: 0, depends_on: 0, relates_to: 0 } as Record<string, number>;
  for (const d of deps) {
    byType[d.type] = (byType[d.type] ?? 0) + 1;
  }

  return (
    <main className="p-8 max-w-5xl mx-auto space-y-6">
      <Breadcrumbs
        items={[
          { label: "ARTs", href: "/art" },
          { label: pi.art.name, href: `/art/${pi.art.id}` },
          { label: pi.name, href: `/pi/${piId}` },
          { label: "Dependencies" },
        ]}
      />

      <PiSubNav piId={piId} />

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Dependency Map — {pi.name}</h1>
        <div className="flex items-center gap-3 text-xs">
          {Object.entries(byType).map(([type, count]) => (
            <span
              key={type}
              className={`border rounded-full px-2 py-0.5 font-medium ${TYPE_COLOR[type] ?? ""}`}
            >
              {count} {TYPE_LABEL[type] ?? type}
            </span>
          ))}
        </div>
      </div>

      {deps.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-sm text-gray-400">
          No dependencies linked for features in this PI yet.
          <br />
          Add dependencies from the feature detail page.
        </div>
      ) : (
        <div className="space-y-6">
          <DependencyGraph
            nodes={nodes}
            edges={deps.map((d) => ({ id: d.id, fromId: d.fromId, toId: d.toId, type: d.type }))}
          />
          {/* Adjacency list grouped by "from" node */}
          {nodes
            .filter((n) => deps.some((d) => d.fromId === n.id))
            .map((fromNode) => {
              const outgoing = deps.filter((d) => d.fromId === fromNode.id);
              return (
                <div key={fromNode.id} className="rounded-lg border overflow-hidden">
                  <div
                    className={`px-4 py-3 flex items-center justify-between ${fromNode.inPi ? "bg-blue-50" : "bg-gray-50"}`}
                  >
                    <div className="flex items-center gap-2">
                      {fromNode.inPi && (
                        <span className="text-[10px] font-semibold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">
                          IN PI
                        </span>
                      )}
                      <Link
                        href={`/feature/${fromNode.id}`}
                        className="text-sm font-medium text-blue-700 hover:underline"
                      >
                        {fromNode.title}
                      </Link>
                    </div>
                    <span className="text-xs text-gray-400">{fromNode.status}</span>
                  </div>
                  <div className="divide-y">
                    {outgoing.map((dep) => {
                      const colorCls = TYPE_COLOR[dep.type] ?? TYPE_COLOR["relates_to"]!;
                      return (
                        <div key={dep.id} className="px-4 py-3 flex items-center gap-3">
                          <span className="text-gray-300 text-lg">↳</span>
                          <span
                            className={`text-xs border rounded-full px-2 py-0.5 font-medium shrink-0 ${colorCls}`}
                          >
                            {TYPE_LABEL[dep.type] ?? dep.type}
                          </span>
                          <div className="flex items-center gap-2 flex-1">
                            {nodeMap.get(dep.toId)?.inPi && (
                              <span className="text-[10px] font-semibold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded shrink-0">
                                IN PI
                              </span>
                            )}
                            <Link
                              href={`/feature/${dep.toId}`}
                              className="text-sm text-gray-800 hover:text-blue-700 hover:underline"
                            >
                              {dep.to.title}
                            </Link>
                          </div>
                          <span className="text-xs text-gray-400 shrink-0">{dep.to.status}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* Features with no dependencies */}
      {features.filter((f) => !deps.some((d) => d.fromId === f.id || d.toId === f.id)).length >
        0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-gray-500">Features with no dependencies</h2>
          <div className="flex flex-wrap gap-2">
            {features
              .filter((f) => !deps.some((d) => d.fromId === f.id || d.toId === f.id))
              .map((f) => (
                <Link
                  key={f.id}
                  href={`/feature/${f.id}`}
                  className="rounded-md border px-3 py-1.5 text-xs text-gray-600 hover:border-blue-300 hover:text-blue-700 transition-colors"
                >
                  {f.title}
                </Link>
              ))}
          </div>
        </section>
      )}
    </main>
  );
}
