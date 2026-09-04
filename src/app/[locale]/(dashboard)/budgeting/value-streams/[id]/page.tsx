import { notFound, redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { hasCapability } from "@/server/auth/authorize";
import { halfYearLabel } from "@/modules/core/kernel/domain/calendar";
import { openCycleKeys } from "@/modules/budgeting/domain/art-pot-window";
import { listRtbItems } from "@/modules/budgeting/server/services/rtb-item-service";
import { loadRtbAwards } from "@/modules/budgeting/server/services/rtb-award-service";
import { loadArtBudgetModel } from "@/modules/budgeting/server/views/art-budget-breakdown";
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

  const cycles = openCycleKeys(new Date());
  const cycleKey =
    cycle != null && (cycles as readonly string[]).includes(cycle) ? cycle : cycles[0];
  const active = resolveTab(TABS, tab);
  const basePath = `/budgeting/value-streams/${vs.id}`;

  const phases = await loadFundingPhases(db, principal.tenantId, vs.id, cycleKey);

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
              key={c}
              href={`${basePath}?tab=${active}&cycle=${c}`}
              aria-current={c === cycleKey ? "page" : undefined}
              className={`rounded-md border px-2.5 py-1 text-sm ${
                c === cycleKey
                  ? "border-primary bg-primary/10 font-medium text-primary"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {halfYearLabel(c)}
            </Link>
          ))}
        </nav>
      }
      subHeader={<ArtFundingRail phases={phases} surface="value_stream" />}
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
    loadArtBudgetModel(db, tenantId as never, vsId as never),
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
