import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { listEpics } from "@/server/services/epic";
import { KanbanBoard } from "@/features/portfolio/components/kanban-board";
import { Link } from "@/i18n/navigation";
import { redirect } from "next/navigation";
import type { TenantId } from "@/domain/types";
import { InitiativeLevel } from "@/domain/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Layers, Zap, BookOpen, CheckSquare, AlertTriangle } from "lucide-react";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

const STATUS_GROUPS = [
  "draft",
  "in_review",
  "approved",
  "in_progress",
  "blocked",
  "completed",
  "cancelled",
] as const;

const STATUS_BADGE_CLASSES: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  in_review: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  approved: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300",
  in_progress: "bg-primary/10 text-primary",
  blocked: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
  completed: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300",
  cancelled: "bg-muted text-muted-foreground line-through",
};

export default async function PortfolioPage() {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const [epics, allInitiatives] = await Promise.all([
    listEpics(db, principal.tenantId),
    db.initiative.findMany({
      where: { tenantId: principal.tenantId as TenantId, deletedAt: null },
      select: { id: true, level: true, status: true, updatedAt: true },
    }),
  ]);

  const canEdit =
    principal.roles.includes("portfolio_editor") ||
    principal.roles.includes("tenant_admin") ||
    principal.roles.includes("platform_admin");

  const epicsByStatus: Record<string, number> = {};
  for (const e of epics) {
    epicsByStatus[e.status] = (epicsByStatus[e.status] ?? 0) + 1;
  }

  const staleEpics = epics.filter(
    (e) =>
      Date.now() - new Date(e.updatedAt).getTime() > THIRTY_DAYS_MS &&
      e.status !== "completed" &&
      e.status !== "cancelled",
  );

  const features = allInitiatives.filter((i) => i.level === InitiativeLevel.FEATURE);
  const stories = allInitiatives.filter((i) => i.level === InitiativeLevel.STORY);
  const tasks = allInitiatives.filter((i) => i.level === InitiativeLevel.TASK);

  return (
    <main className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Portfolio</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Overview of epics, features, and delivery health
          </p>
        </div>
        <nav className="flex gap-3 text-sm">
          <Link
            href="/portfolio/epics"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            All Epics
          </Link>
          <Link
            href="/portfolio/value-streams"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Value Streams
          </Link>
        </nav>
      </div>

      {/* Metric Cards */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          {
            label: "Epics",
            value: epics.length,
            icon: Layers,
            color: "text-violet-600 dark:text-violet-400",
            bg: "bg-violet-50 dark:bg-violet-950",
          },
          {
            label: "Features",
            value: features.length,
            icon: Zap,
            color: "text-blue-600 dark:text-blue-400",
            bg: "bg-blue-50 dark:bg-blue-950",
          },
          {
            label: "Stories",
            value: stories.length,
            icon: BookOpen,
            color: "text-emerald-600 dark:text-emerald-400",
            bg: "bg-emerald-50 dark:bg-emerald-950",
          },
          {
            label: "Tasks",
            value: tasks.length,
            icon: CheckSquare,
            color: "text-amber-600 dark:text-amber-400",
            bg: "bg-amber-50 dark:bg-amber-950",
          },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label}>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${bg} shrink-0`}>
                  <Icon className={`size-4 ${color}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-bold tabular-nums">{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      {/* Epic status breakdown */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Epics by Status
        </h2>
        <div className="flex gap-2 flex-wrap">
          {STATUS_GROUPS.map((s) => {
            const count = epicsByStatus[s] ?? 0;
            if (count === 0) return null;
            return (
              <Link
                key={s}
                href={`/portfolio/epics?status=${s}`}
                className="flex items-center gap-2.5 rounded-lg border bg-card px-3 py-2.5 hover:border-primary/40 hover:bg-accent transition-colors"
              >
                <span className="text-lg font-bold tabular-nums">{count}</span>
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${STATUS_BADGE_CLASSES[s] ?? ""}`}
                >
                  {s.replace("_", " ")}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Stale epics */}
      {staleEpics.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <AlertTriangle className="size-4 text-amber-500" />
            Stale Epics
            <Badge className="bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-800 font-normal">
              {staleEpics.length} no activity &gt;30 days
            </Badge>
          </h2>
          <Card>
            <div className="divide-y divide-border">
              {staleEpics.map((e) => (
                <div key={e.id} className="px-4 py-3 flex items-center justify-between gap-4">
                  <Link
                    href={`/portfolio/epics/${e.id}`}
                    className="text-sm font-medium hover:text-primary transition-colors truncate"
                  >
                    {e.title}
                  </Link>
                  <div className="flex items-center gap-2 shrink-0 text-xs text-muted-foreground">
                    <span>{e.valueStream?.name ?? "—"}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded-full ${STATUS_BADGE_CLASSES[e.status] ?? "bg-muted text-muted-foreground"}`}
                    >
                      {e.status}
                    </span>
                    <span className="text-amber-600 dark:text-amber-400 font-medium">
                      {Math.floor(
                        (Date.now() - new Date(e.updatedAt).getTime()) / (1000 * 60 * 60 * 24),
                      )}
                      d ago
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </section>
      )}

      {/* Kanban board */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Epic Stage Gates
        </h2>
        <KanbanBoard
          epics={epics.map((e) => ({
            id: e.id,
            title: e.title,
            stageGate: e.stageGate,
            status: e.status,
            valueStream: e.valueStream,
          }))}
          canEdit={canEdit}
          tenantId={principal.tenantId}
        />
      </section>
    </main>
  );
}
