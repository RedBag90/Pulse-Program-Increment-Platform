import { redirect } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { getGoal } from "@/server/services/target-goal";
import { goalKpiProgress } from "@/server/services/transformation";
import { listTenantUserLabels } from "@/server/services/tenant-users";

const GOAL_STATUS_LABELS: Record<string, string> = {
  active: "Aktiv",
  achieved: "Erreicht",
  archived: "Archiviert",
};

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

/** Read-focused detail of one strategic goal: KPIs with progress + realising Epics. */
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

  return (
    <div className="max-w-3xl space-y-6 p-6">
      <div>
        <Link
          href="/transformation/ziele"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Zurück zu den Zielen
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">{goal.title}</h1>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {GOAL_STATUS_LABELS[goal.status] ?? goal.status}
          </span>
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
                    <div className="h-full rounded-full bg-primary" style={{ width: pct(prog) }} />
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
