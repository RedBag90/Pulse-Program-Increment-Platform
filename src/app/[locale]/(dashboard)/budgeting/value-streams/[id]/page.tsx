import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { hasCapability } from "@/server/auth/authorize";
import { halfYearLabel } from "@/modules/core/kernel/domain/calendar";
import { resolveCycle } from "@/modules/budgeting/domain/cycle";
import { listRtbItems } from "@/modules/budgeting/server/services/rtb-item-service";
import { loadRtbAwards } from "@/modules/budgeting/server/services/rtb-award-service";
import { loadArtGridModel } from "@/modules/budgeting/server/views/art-budget-breakdown";
import { loadValueStreamCourse } from "@/modules/budgeting/server/views/value-stream-course";
import { loadFundingPhases } from "@/modules/budgeting/server/views/art-funding";
import { getValueStreamBudget } from "@/modules/budgeting/server/services/budgeting";
import { RtbSection } from "@/modules/budgeting/features/components/rtb/rtb-section";
import { RtbAwardsSection } from "@/modules/budgeting/features/components/rtb/rtb-awards-section";
import { ArtBudgetView } from "@/modules/budgeting/features/components/art-budget/art-budget-view";
import { ValueStreamBudgetPlan } from "@/modules/budgeting/features/components/value-stream/value-stream-budget-plan";
import { AllocationCourseChart } from "@/modules/budgeting/features/components/art-budget/allocation-course-chart";
import { ArtFundingRail } from "@/modules/budgeting/features/components/art-funding-rail";
import { EntityDetailShell, resolveTab } from "@/components/detail/entity-detail-shell";

/**
 * Das Budget **eines** Wertstroms — und die Fläche, auf der ein ART-Epic-Budget
 * entsteht.
 *
 * Zwei Reiter: **Budget** ist das Abgeleitete zum Lesen, **Run the Business**
 * trägt die Positionen und die Aufteilung des Zuspruchs. Beide Hälften der
 * Kette liegen damit nebeneinander; vorher erzeugte sie `components/rtb/` und
 * verteilte sie `components/art-budget/` — zwei Ordner auf zwei Seiten.
 */

const TABS = [
  { key: "budget", label: "Budget" },
  { key: "betrieb", label: "Run the Business" },
] as const;

export default async function BudgetingValueStreamPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; cycle?: string }>;
}) {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const { id } = await params;
  const { tab, cycle } = await searchParams;
  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const vs = await db.valueStream.findFirst({
    where: { id, tenantId: principal.tenantId, deletedAt: null },
    select: { id: true, name: true, financeApproverId: true },
  });
  if (!vs) notFound();

  const canManage =
    vs.financeApproverId === principal.id ||
    hasCapability(principal, "rtb_item.manage", {
      tenantId: principal.tenantId,
      valueStreamId: vs.id,
    });

  const { cycleKey, options: cycles } = resolveCycle(cycle, new Date());
  const active = resolveTab(TABS, tab);
  const basePath = `/budgeting/value-streams/${vs.id}`;

  return (
    <EntityDetailShell
      backHref="/budgeting/value-streams"
      backLabel="Wertströme"
      title={vs.name}
      badge="Wertstrom"
      tabs={TABS}
      activeTab={active}
      basePath={basePath}
      tabQuery={{ cycle: cycleKey }}
      headerActions={
        <nav className="flex items-center gap-1" aria-label="Halbjahr">
          {cycles.map((c) => (
            <Link
              key={c.key}
              href={`${basePath}?tab=${active}&cycle=${c.key}`}
              aria-current={c.key === cycleKey ? "page" : undefined}
              className={`rounded-md border px-2.5 py-1 text-sm ${
                c.key === cycleKey
                  ? "border-primary bg-primary/10 font-medium text-primary"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {c.label}
            </Link>
          ))}
        </nav>
      }
      subHeader={
        // Eigene Insel: der Leitfaden braucht sechs Abfragen, die niemand sonst
        // auf dieser Seite braucht. Vorher stand hier ein nacktes `await` vor
        // dem `return` und hielt den Reiter auf, bis die Leiste stand.
        <Suspense fallback={<RailSkeleton />}>
          <FundingRail db={db} tenantId={principal.tenantId} vsId={vs.id} cycleKey={cycleKey} />
        </Suspense>
      }
    >
      {active === "budget" ? (
        <BudgetTab db={db} tenantId={principal.tenantId} vsId={vs.id} cycleKey={cycleKey} />
      ) : (
        <OperationsTab
          db={db}
          tenantId={principal.tenantId}
          vsId={vs.id}
          cycleKey={cycleKey}
          canManage={canManage}
        />
      )}
    </EntityDetailShell>
  );
}

/** Der Leitfaden als eigene Insel — er blockiert die Reiter nicht mehr. */
async function FundingRail({
  db,
  tenantId,
  vsId,
  cycleKey,
}: {
  db: ReturnType<typeof createPrismaClient>;
  tenantId: string;
  vsId: string;
  cycleKey: string;
}) {
  const phases = await loadFundingPhases(db, tenantId as never, vsId, cycleKey);
  return <ArtFundingRail phases={phases} surface="value_stream" />;
}

/** Platzhalter in der Höhe der Leiste, damit der Kopf nicht springt. */
function RailSkeleton() {
  return <div className="h-[58px] animate-pulse rounded-lg border bg-muted/40" />;
}

async function BudgetTab({
  db,
  tenantId,
  vsId,
  cycleKey,
}: {
  db: ReturnType<typeof createPrismaClient>;
  tenantId: string;
  vsId: string;
  cycleKey: string;
}) {
  const [plan, model, course] = await Promise.all([
    getValueStreamBudget(db, tenantId as never, vsId as never),
    loadArtGridModel(db, tenantId as never, vsId as never),
    loadValueStreamCourse(db, tenantId as never, vsId, { cycleKey }),
  ]);

  return (
    <div className="space-y-6">
      <ValueStreamBudgetPlan plan={plan.budget ?? undefined} periods={plan.periods} />
      {course.course && (
        <AllocationCourseChart
          course={course.course}
          todayIndex={course.todayIndex}
          title={`Verlauf · ${halfYearLabel(course.cycleKey)}`}
          subtitle="Alle Zuteilungen dieses Wertstroms, auf die Monate des Halbjahres verteilt."
        />
      )}
      <ArtBudgetView model={model} />
    </div>
  );
}

async function OperationsTab({
  db,
  tenantId,
  vsId,
  cycleKey,
  canManage,
}: {
  db: ReturnType<typeof createPrismaClient>;
  tenantId: string;
  vsId: string;
  cycleKey: string;
  canManage: boolean;
}) {
  const [items, solutions, arts, awards] = await Promise.all([
    listRtbItems(db, tenantId as never, { valueStreamId: vsId }),
    db.solution.findMany({
      where: { tenantId, valueStreamId: vsId, deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.art.findMany({
      where: { tenantId, valueStreamId: vsId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    loadRtbAwards(db, tenantId as never, vsId, cycleKey),
  ]);

  return (
    <div className="space-y-6">
      <RtbSection
        valueStreamId={vsId}
        items={items}
        canManage={canManage}
        solutions={solutions}
        arts={arts}
      />
      <RtbAwardsSection valueStreamId={vsId} view={awards} canManage={canManage} />
    </div>
  );
}
