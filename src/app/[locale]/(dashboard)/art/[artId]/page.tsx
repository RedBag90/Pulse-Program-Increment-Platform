import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { getArt } from "@/server/services/art";
import { ArtSubNav } from "@/features/art/components/art-sub-nav";
import { Link } from "@/i18n/navigation";
import { redirect, notFound } from "next/navigation";
import { InitiativeLevel } from "@/domain/types";
import type { ArtId, TenantId } from "@/domain/types";
import { Card } from "@/components/ui/card";
import { Target, Users, Zap, GitBranch } from "lucide-react";

interface Props {
  params: Promise<{ artId: string }>;
}

const STATUS_BADGE: Record<string, string> = {
  planned: "bg-muted text-muted-foreground",
  active: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  completed: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
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
    {
      label: "Program Increments",
      value: art.pis.length,
      href: `/art/${artId}/pi` as const,
      icon: Target,
      color: "text-violet-600 dark:text-violet-400",
      bg: "bg-violet-50 dark:bg-violet-950",
    },
    {
      label: "Teams",
      value: teamCount,
      href: `/art/${artId}/teams` as const,
      icon: Users,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-950",
    },
    {
      label: "Features",
      value: featureCount,
      href: `/art/${artId}/features` as const,
      icon: Zap,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-950",
    },
  ];

  return (
    <main className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <ArtSubNav artId={artId} artName={art.name} />

      <div>
        <h1 className="text-xl font-semibold tracking-tight">{art.name}</h1>
        <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5">
          <GitBranch className="size-3.5" />
          {art.valueStream.name}
          {art.piCadenceWeeks ? ` · PI cadence: ${art.piCadenceWeeks} weeks` : ""}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className="p-5 hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${s.bg} shrink-0`}>
                  <s.icon className={`size-4 ${s.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold tabular-nums">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Program Increments
        </h2>
        {art.pis.length === 0 ? (
          <p className="text-sm text-muted-foreground">No PIs yet.</p>
        ) : (
          <Card className="overflow-hidden">
            <div className="divide-y divide-border">
              {art.pis.map((pi) => (
                <Link
                  key={pi.id}
                  href={`/pi/${pi.id}`}
                  className="px-4 py-3 flex items-center justify-between text-sm hover:bg-muted/30 transition-colors"
                >
                  <span className="font-medium hover:text-primary transition-colors">
                    {pi.name}
                  </span>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>
                      {formatDate(pi.startDate)} – {formatDate(pi.endDate)}
                    </span>
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 font-medium ${
                        STATUS_BADGE[pi.status] ?? "bg-muted text-muted-foreground"
                      }`}
                    >
                      {pi.status}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        )}
      </section>
    </main>
  );
}
