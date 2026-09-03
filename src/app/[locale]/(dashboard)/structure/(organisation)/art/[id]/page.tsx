import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { hasCapability } from "@/server/auth/authorize";
import { createPrismaClient } from "@/server/db/prisma";
import { getArt } from "@/modules/core/org/server/services/art";
import { canOpenArt } from "@/modules/core/org/domain/structure-access";
import {
  EntityDetailShell,
  resolveTab,
  type DetailTab,
} from "@/components/detail/entity-detail-shell";
import { RememberTab } from "@/modules/core/org/features/structure/components/remember-tab";
import { tabCookieName } from "@/modules/core/org/features/structure/components/tab-memory";
import { AuditTimeline } from "@/components/detail/audit-timeline";
import { listAuditHistory } from "@/server/services/audit-history";
import { listTenantApprovers } from "@/modules/work/server/services/tenant-approvers";
import { listTenantUserLabels } from "@/server/services/tenant-users";
import { userLabel } from "@/components/detail/initiative-labels";
import { ArtOverviewForm } from "@/modules/core/org/features/capacity/components/art-overview-form";
import { DeleteArtButton } from "@/modules/core/org/features/art/components/delete-art-button";
import { loadArtBudgetDetail } from "@/modules/budgeting/server/views/art-budget-detail";
import { ArtBudgetTab } from "@/modules/budgeting/features/components/art-budget/art-budget-tab";
import { getTenantPractices } from "@/server/services/target-model";
import { listValueStreamGuardrailTargets } from "@/modules/work/server/services/guardrail-targets";
import { resolveGuardrailTargets } from "@/modules/work/domain/portfolio-guardrails";
import { SolutionsOfNode } from "@/modules/work/features/portfolio/components/solutions/solutions-of-node";
import { loadSolutionsList } from "@/modules/work/server/views/solutions-list";
import type { ArtId } from "@/modules/core/kernel/domain/types";

/**
 * Der ART-Knoten der Struktur-Fläche.
 *
 * Der Budget-Reiter bleibt **einer** — anders als beim Wertstrom. Deckung,
 * Rahmen, Verlauf und Aufteilung beantworten dort eine einzige Frage: reicht
 * mein Geld für meine Last. Sie zu zerschneiden nähme ihnen den Zusammenhang.
 *
 * Die frühere Trennung „Overview" (lesend) / „Settings" (schreibend) ist
 * entfallen: ein Formular, das ohne Recht als Definitionsliste rendert, kann
 * beides — so hält es der Wertstrom seit jeher.
 */
interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; cycle?: string }>;
}

export default async function ArtNodePage({ params, searchParams }: Props) {
  const { id } = await params;
  const { tab, cycle } = await searchParams;

  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const art = await getArt(db, principal.tenantId, id as ArtId);
  if (!art) notFound();

  const inScope = canOpenArt(principal.scopes, {
    id: art.id,
    valueStreamId: art.valueStream.id,
  });

  const budgetingEnabled = principal.enabledModules.includes("budgeting");
  const canReadBudget =
    budgetingEnabled &&
    inScope &&
    (art.valueStream.financeApproverId === principal.id ||
      hasCapability(principal, "budget.read", {
        tenantId: principal.tenantId,
        valueStreamId: art.valueStream.id,
        artId: art.id,
      }));

  const tabs: DetailTab[] = [
    { key: "overview", label: "Allgemein" },
    ...(canReadBudget ? [{ key: "budget", label: "Budget" }] : []),
    ...(inScope
      ? [
          { key: "solutions", label: "Solutions" },
          { key: "history", label: "Verlauf" },
        ]
      : []),
  ];

  const remembered = (await cookies()).get(tabCookieName("art"))?.value;
  const activeTab = resolveTab(tabs, tab ?? remembered);

  const canEdit =
    inScope &&
    hasCapability(principal, "art.update", { tenantId: principal.tenantId, artId: art.id });

  return (
    <EntityDetailShell
      title={art.name}
      badge={art.valueStream.name}
      tabs={tabs}
      activeTab={activeTab}
      basePath={`/structure/art/${art.id}`}
    >
      <RememberTab kind="art" tab={activeTab} />

      {!inScope && (
        <div className="mb-4 rounded-lg border border-dashed bg-muted/40 p-4 text-sm">
          <p className="font-medium">Dieser ART liegt außerhalb deines Bereichs.</p>
          <p className="mt-1 text-muted-foreground">
            Name und Verantwortliche stehen unten. Budget, Solutions und Verlauf bleiben zu. Im Baum
            bleibt er sichtbar, damit die Landkarte vollständig ist.
          </p>
        </div>
      )}

      {activeTab === "overview" && (
        <OverviewTab db={db} art={art} principal={principal} canEdit={canEdit} />
      )}
      {activeTab === "budget" && (
        <BudgetTab db={db} principal={principal} art={art} cycle={cycle ?? null} />
      )}
      {activeTab === "solutions" && (
        <SolutionsTab db={db} tenantId={principal.tenantId} artId={art.id} />
      )}
      {activeTab === "history" && <HistoryTab db={db} tenantId={principal.tenantId} id={art.id} />}
    </EntityDetailShell>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any -- siehe Wertstrom-Knoten. */

async function OverviewTab({ db, art, principal, canEdit }: any) {
  const [approvers, userLabels] = await Promise.all([
    listTenantApprovers(db, principal.tenantId),
    listTenantUserLabels(db, principal.tenantId),
  ]);
  const rteUsers = approvers.filter((u: { roles: string[] }) => u.roles.includes("rte"));

  return (
    <div className="space-y-8">
      {canEdit ? (
        <ArtOverviewForm
          key={[art.id, art.name, art.description ?? "", art.rteId ?? ""].join("|")}
          id={art.id}
          name={art.name}
          description={art.description ?? ""}
          rteId={art.rteId ?? ""}
          rteUsers={rteUsers}
          userLabels={userLabels}
        />
      ) : (
        <dl className="max-w-xl space-y-3 text-sm">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Name
            </dt>
            <dd className="mt-0.5">{art.name}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Wertstrom
            </dt>
            <dd className="mt-0.5">{art.valueStream.name}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Beschreibung
            </dt>
            <dd className="mt-0.5">{art.description ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              RTE
            </dt>
            <dd className="mt-0.5">{art.rteId ? userLabel(art.rteId, userLabels) : "—"}</dd>
          </div>
        </dl>
      )}

      {canEdit && (
        <section>
          <h2 className="mb-2 text-sm font-medium">ART löschen</h2>
          <DeleteArtButton id={art.id} name={art.name} />
        </section>
      )}
    </div>
  );
}

async function BudgetTab({ db, principal, art, cycle }: any) {
  const [practices, guardrailRows, tenantRow] = await Promise.all([
    getTenantPractices(db, principal.tenantId),
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
      ...(cycle != null ? { cycleKey: cycle } : {}),
      artEpics: practices.artEpics,
      threshold,
    },
  );

  // Verteilt wird der Rahmen *für* den ART — die Rechte hängen am Wertstrom.
  const canDistribute =
    art.valueStream.financeApproverId === principal.id ||
    hasCapability(principal, "rtb_item.manage", {
      tenantId: principal.tenantId,
      valueStreamId: art.valueStream.id,
    });

  return (
    <ArtBudgetTab
      detail={detail}
      basePath={`/structure/art/${art.id}`}
      canDistribute={canDistribute}
    />
  );
}

async function SolutionsTab({ db, tenantId, artId }: any) {
  const rows = await loadSolutionsList(db, tenantId, { artId });
  return (
    <SolutionsOfNode
      rows={rows}
      showArt={false}
      emptyText="Diesem ART ist noch keine Solution zugewiesen."
    />
  );
}

async function HistoryTab({ db, tenantId, id }: any) {
  const history = await listAuditHistory(db, tenantId, "art", id);
  return (
    <section>
      <h2 className="mb-3 text-lg font-medium">Verlauf</h2>
      <AuditTimeline
        events={history.map((e: { id: string; action: string; occurredAt: Date }) => ({
          id: e.id,
          action: e.action,
          occurredAt: e.occurredAt.toISOString(),
        }))}
      />
    </section>
  );
}
