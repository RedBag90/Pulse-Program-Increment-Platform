import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { listEpics } from "@/server/services/epic";
import { getTenantPractices } from "@/server/services/target-model";
import { KanbanBoard } from "@/features/portfolio/components/kanban-board";
import { Link } from "@/i18n/navigation";
import { redirect } from "next/navigation";
import type { TenantId } from "@/domain/types";
import { InitiativeLevel } from "@/domain/types";
import { SectionLabel } from "@/components/ui/section-label";
import { Stat, StatStrip } from "@/components/ui/stat";
import { MarginRail, MarginNote } from "@/components/layout/margin-rail";

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

// German labels for the flat epic list shown when stage gates are switched off.
const STATUS_LABELS: Record<string, string> = {
  draft: "Entwurf",
  in_review: "In Prüfung",
  approved: "Freigegeben",
  in_progress: "In Umsetzung",
  blocked: "Blockiert",
  completed: "Abgeschlossen",
  cancelled: "Abgebrochen",
};

const daysAgo = (d: Date) =>
  Math.floor((Date.now() - new Date(d).getTime()) / (1000 * 60 * 60 * 24));

export default async function PortfolioPage() {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const [epics, allInitiatives, practices] = await Promise.all([
    listEpics(db, principal.tenantId),
    db.initiative.findMany({
      where: { tenantId: principal.tenantId as TenantId, deletedAt: null },
      select: { id: true, level: true, status: true, updatedAt: true },
    }),
    getTenantPractices(db, principal.tenantId),
  ]);

  const canEdit =
    principal.roles.includes("portfolio_manager") ||
    principal.roles.includes("epic_owner") ||
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
  const blockedEpics = epics.filter((e) => e.status === "blocked");

  const features = allInitiatives.filter((i) => i.level === InitiativeLevel.FEATURE);
  const stories = allInitiatives.filter((i) => i.level === InitiativeLevel.STORY);
  const tasks = allInitiatives.filter((i) => i.level === InitiativeLevel.TASK);

  return (
    <main className="mx-auto max-w-7xl p-6 md:p-8">
      {/* Context bar */}
      <header className="flex items-end justify-between border-b pb-4">
        <div>
          <h1 className="font-heading text-2xl font-normal tracking-tight">Portfolio</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Overview of epics, features, and delivery health
          </p>
        </div>
        <nav className="flex gap-4 text-sm">
          <Link
            href="/portfolio/epics"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            All Epics
          </Link>
          <Link
            href="/portfolio/value-streams"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            Value Streams
          </Link>
        </nav>
      </header>

      <div className="mt-6 flex flex-col gap-8 lg:flex-row">
        {/* Content column */}
        <div className="min-w-0 flex-1 space-y-8">
          {/* KPI strip */}
          <StatStrip>
            <Stat label="Epics" value={epics.length} />
            <Stat label="Features" value={features.length} />
            <Stat label="Stories" value={stories.length} />
            <Stat label="Tasks" value={tasks.length} />
          </StatStrip>

          {/* Epic status breakdown */}
          <section className="space-y-3">
            <SectionLabel>Epics by Status</SectionLabel>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {STATUS_GROUPS.map((s) => {
                const count = epicsByStatus[s] ?? 0;
                if (count === 0) return null;
                return (
                  <Link
                    key={s}
                    href={`/portfolio/epics?status=${s}`}
                    className="group flex items-baseline gap-2 transition-colors"
                  >
                    <span className="font-mono text-lg font-light tabular-nums">{count}</span>
                    <span className="text-xs text-muted-foreground group-hover:text-foreground">
                      {STATUS_LABELS[s] ?? s.replace("_", " ")}
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>

          {/* Epic lifecycle view — stage-gate kanban when stage gates are part of the
              target operating model, otherwise a flat list grouped by review status. */}
          {practices.stageGates ? (
            <section className="space-y-3">
              <SectionLabel>Epic Stage Gates</SectionLabel>
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
          ) : (
            <section className="space-y-6">
              <SectionLabel>Epics nach Status</SectionLabel>
              {STATUS_GROUPS.map((s) => {
                const groupEpics = epics.filter((e) => e.status === s);
                if (groupEpics.length === 0) return null;
                return (
                  <div key={s} className="space-y-2">
                    <div className="flex items-baseline gap-2 border-b pb-1.5">
                      <span className="text-xs font-medium">{STATUS_LABELS[s] ?? s}</span>
                      <span className="font-mono text-xs text-muted-foreground tabular-nums">
                        {groupEpics.length}
                      </span>
                    </div>
                    <div className="divide-y divide-border">
                      {groupEpics.map((e) => (
                        <div key={e.id} className="flex items-center justify-between gap-4 py-2.5">
                          <Link
                            href={`/portfolio/epics/${e.id}`}
                            className="truncate text-sm font-medium transition-colors hover:text-primary"
                          >
                            {e.title}
                          </Link>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {e.valueStream?.name ?? "—"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              {epics.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Noch keine Epics vorhanden.
                </p>
              )}
            </section>
          )}
        </div>

        {/* Margin rail — contextual notes from existing signals */}
        <MarginRail>
          <SectionLabel>Randnotizen</SectionLabel>
          {blockedEpics.length > 0 && (
            <MarginNote label="Blockiert" tone="destructive">
              {blockedEpics.length} Epic{blockedEpics.length !== 1 ? "s" : ""} blockiert —{" "}
              <Link
                href="/portfolio/epics?status=blocked"
                className="underline hover:text-foreground"
              >
                ansehen
              </Link>
            </MarginNote>
          )}
          {staleEpics.length > 0 ? (
            <MarginNote label={`Inaktiv · ${staleEpics.length} > 30 Tage`} tone="amber">
              <ul className="space-y-1.5">
                {staleEpics.slice(0, 6).map((e) => (
                  <li key={e.id} className="flex items-baseline justify-between gap-2">
                    <Link
                      href={`/portfolio/epics/${e.id}`}
                      className="truncate text-foreground/80 hover:text-foreground"
                    >
                      {e.title}
                    </Link>
                    <span className="shrink-0 font-mono text-[10px] text-amber-600 tabular-nums dark:text-amber-400">
                      {daysAgo(e.updatedAt)}d
                    </span>
                  </li>
                ))}
              </ul>
            </MarginNote>
          ) : blockedEpics.length === 0 ? (
            <p className="text-xs text-muted-foreground">Keine offenen Hinweise.</p>
          ) : null}
        </MarginRail>
      </div>
    </main>
  );
}
