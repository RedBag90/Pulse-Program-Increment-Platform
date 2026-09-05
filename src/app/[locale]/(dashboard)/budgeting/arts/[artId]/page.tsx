import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { hasCapability } from "@/server/auth/authorize";
import { getTenantPractices } from "@/server/services/target-model";
import { mayReadArtBudget } from "@/modules/budgeting/server/services/art-budget-access";
import { resolveCycle } from "@/modules/budgeting/domain/cycle";
import { listValueStreamGuardrailTargets } from "@/modules/work/server/services/guardrail-targets";
import { resolveGuardrailTargets } from "@/modules/work/domain/portfolio-guardrails";
import { loadArtBudgetDetail } from "@/modules/budgeting/server/views/art-budget-detail";
import { loadFundingPhases } from "@/modules/budgeting/server/views/art-funding";
import { ArtBudgetTab } from "@/modules/budgeting/features/components/art-budget/art-budget-tab";
import { ArtFundingRail } from "@/modules/budgeting/features/components/art-funding-rail";
import { EntityDetailShell, resolveTab } from "@/components/detail/entity-detail-shell";

/**
 * Das Budget **eines** ARTs — die Fläche, die der Spec ihren Namen gibt.
 *
 * Erreichbar ohne Umweg über eine Kachel: der Halbjahres-Umschalter steht in der
 * Titelzeile, der Leitfaden im Unterkopf. Zwei Reiter, geschnitten nach Modus:
 * **Übersicht** ist alles zum Lesen, **Verteilen** ist die Arbeit.
 */

const TABS = [
  { key: "uebersicht", label: "Übersicht" },
  { key: "verteilen", label: "Verteilen" },
] as const;

export default async function ArtBudgetDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ artId: string }>;
  searchParams: Promise<{ tab?: string; cycle?: string }>;
}) {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const { artId } = await params;
  const { tab, cycle } = await searchParams;
  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const practices = await getTenantPractices(db, principal.tenantId);
  if (!practices.artEpics) redirect("/budgeting/periods");

  const art = await db.art.findFirst({
    where: { id: artId, tenantId: principal.tenantId },
    select: {
      id: true,
      name: true,
      valueStream: { select: { id: true, name: true, financeApproverId: true } },
    },
  });
  if (!art?.valueStream) notFound();

  const mayRead = await mayReadArtBudget(db, principal, {
    id: art.id,
    valueStreamId: art.valueStream.id,
    financeApproverId: art.valueStream.financeApproverId,
  });
  if (!mayRead) notFound();

  const { cycleKey, options: cycles } = resolveCycle(cycle, new Date());

  const [guardrailRows, tenantRow] = await Promise.all([
    listValueStreamGuardrailTargets(db, principal.tenantId),
    db.tenant.findUnique({ where: { id: principal.tenantId }, select: { guardrailTargets: true } }),
  ]);
  const threshold = resolveGuardrailTargets(
    guardrailRows,
    tenantRow?.guardrailTargets ?? null,
    art.valueStream.id,
  ).targets.approval.portfolioThreshold;

  const detail = await loadArtBudgetDetail(
    db,
    principal.tenantId,
    { id: art.id, valueStreamId: art.valueStream.id },
    {
      cycleKey,
      artEpics: practices.artEpics,
      threshold,
      viewer: {
        userId: principal.id,
        isValueStreamFinance: art.valueStream.financeApproverId === principal.id,
        hasRtbCapability: hasCapability(principal, "rtb_item.manage", {
          tenantId: principal.tenantId,
          valueStreamId: art.valueStream.id,
        }),
        hasArtDistributeCapability: hasCapability(principal, "art_budget.distribute", {
          tenantId: principal.tenantId,
          artId: art.id,
        }),
      },
    },
  );

  const canDistribute =
    art.valueStream.financeApproverId === principal.id ||
    hasCapability(principal, "rtb_item.manage", {
      tenantId: principal.tenantId,
      valueStreamId: art.valueStream.id,
    }) ||
    hasCapability(principal, "art_budget.distribute", {
      tenantId: principal.tenantId,
      artId: art.id,
    }) ||
    (detail.pot?.rows.some((r) => r.canDistribute) ?? false);

  const basePath = `/budgeting/arts/${art.id}`;
  const active = resolveTab(TABS, tab);

  return (
    <EntityDetailShell
      backHref="/budgeting/arts"
      backLabel="ART-Budgets"
      title={art.name}
      badge={`ART · ${art.valueStream.name}`}
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
        // Eigene Insel — der Leitfaden kostet sechs Abfragen für einen Streifen,
        // den niemand liest, bevor er die Zahlen darunter gesehen hat.
        <Suspense fallback={<RailSkeleton />}>
          <FundingRail
            db={db}
            tenantId={principal.tenantId}
            vsId={art.valueStream.id}
            cycleKey={cycleKey}
            artId={art.id}
          />
        </Suspense>
      }
    >
      <ArtBudgetTab
        detail={detail}
        basePath={basePath}
        canDistribute={canDistribute}
        view={active === "verteilen" ? "distribute" : "overview"}
      />
    </EntityDetailShell>
  );
}

/** Der Leitfaden als eigene Insel, damit er die Reiter nicht aufhält. */
async function FundingRail({
  db,
  tenantId,
  vsId,
  cycleKey,
  artId,
}: {
  db: ReturnType<typeof createPrismaClient>;
  tenantId: string;
  vsId: string;
  cycleKey: string;
  artId: string;
}) {
  const phases = await loadFundingPhases(db, tenantId as never, vsId, cycleKey, artId);
  return <ArtFundingRail phases={phases} surface="art" />;
}

/** Platzhalter in der Höhe der Leiste, damit der Kopf nicht springt. */
function RailSkeleton() {
  return <div className="h-[58px] animate-pulse rounded-lg border bg-muted/40" />;
}
