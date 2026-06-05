import { redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, Pencil } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { getGoal } from "@/server/services/target-goal";
import { goalKpiProgress } from "@/server/services/transformation";
import { listTenantUserLabels } from "@/server/services/tenant-users";
import { ragTier, type RagTier } from "@/domain/transformation-delta";

const GOAL_STATUS_LABELS: Record<string, string> = {
  active: "Aktiv",
  achieved: "Erreicht",
  archived: "Archiviert",
};

const TIER_CHIP: Record<RagTier, string> = {
  green: "bg-emerald-50 text-emerald-700 border-emerald-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  red: "bg-red-50 text-red-700 border-red-200",
  done: "bg-emerald-100 text-emerald-800 border-emerald-300",
};

const TIER_DOT: Record<RagTier, string> = {
  green: "🟢",
  amber: "🟡",
  red: "🔴",
  done: "✓",
};

const TIER_BAR: Record<RagTier, string> = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  done: "bg-emerald-600",
};

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

/**
 * Read-only deep view of one strategic goal — used as a deep-link target
 * (from the cockpit goal cards, audit log links, etc.). Mirrors the visual
 * language of the master-detail editor at `/transformation/ziele` (RAG
 * badge + chip palette + tiered progress bars) so the two pages feel
 * coherent. A "Bearbeiten" link jumps to the editor with this goal
 * pre-selected via `?selected=g_<id>`.
 */
export default async function GoalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const goal = await getGoal(db, principal.tenantId, id);
  if (!goal) redirect("/transformation/ziele");

  const userLabels = await listTenantUserLabels(db, principal.tenantId);
  const owner = goal.ownerId ? (userLabels[goal.ownerId] ?? goal.ownerId) : null;
  const overall = goalKpiProgress(goal.kpis);
  const tier = ragTier(overall, goal.status === "achieved");

  return (
    <div className="space-y-6 p-6">
      <div>
        <Link
          href="/transformation/ziele"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Zurück zu den Zielen
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-heading text-2xl font-semibold tracking-tight">{goal.title}</h1>
            <span className={`rounded-full border px-2 py-0.5 text-xs ${TIER_CHIP[tier]}`}>
              {TIER_DOT[tier]}{" "}
              {goal.status === "achieved"
                ? "erreicht"
                : goal.kpis.length > 0
                  ? pct(overall)
                  : "noch keine KPIs"}
            </span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {GOAL_STATUS_LABELS[goal.status] ?? goal.status}
            </span>
          </div>
          <Link
            href={`/transformation/ziele?selected=g_${goal.id}`}
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            <Pencil className="h-3.5 w-3.5" /> Bearbeiten
          </Link>
        </div>
        {goal.description && (
          <p className="mt-1 text-sm text-muted-foreground">{goal.description}</p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          {owner ? `Verantwortlich: ${owner}` : "Kein:e Verantwortliche:r"}
          {goal.dueDate ? ` · Zieltermin ${goal.dueDate.toISOString().slice(0, 10)}` : ""}
        </p>
      </div>

      {/* KPIs */}
      <section className="rounded-lg border bg-card p-4">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-heading text-sm font-medium">KPIs</h2>
          {goal.kpis.length > 0 && (
            <span className="text-sm font-semibold tabular-nums">{pct(overall)}</span>
          )}
        </div>
        {goal.kpis.length === 0 ? (
          <p className="text-sm text-muted-foreground">Noch keine KPIs gebunden.</p>
        ) : (
          <ul className="space-y-3">
            {goal.kpis.map((k) => {
              const unit = k.metricUnit ? ` ${k.metricUnit}` : "";
              const prog = goalKpiProgress([k]);
              const kpiTier = ragTier(prog);
              return (
                <li key={k.id} className="space-y-1">
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-medium">{k.title}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {k.current ?? "—"} / {k.target}
                      {unit} · {pct(prog)}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${TIER_BAR[kpiTier]}`}
                      style={{ width: pct(prog) }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Realising Epics */}
      <section className="rounded-lg border bg-card p-4">
        <h2 className="mb-3 font-heading text-sm font-medium">Realisiert durch Epics</h2>
        {goal.epicLinks.length === 0 ? (
          <p className="text-sm text-muted-foreground">Noch keine Epics verknüpft.</p>
        ) : (
          <ul className="divide-y">
            {goal.epicLinks.map((l) => (
              <li key={l.epic.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <Link
                  href={`/portfolio/epics/${l.epic.id}`}
                  className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                >
                  {l.epic.title} <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {l.epic.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
