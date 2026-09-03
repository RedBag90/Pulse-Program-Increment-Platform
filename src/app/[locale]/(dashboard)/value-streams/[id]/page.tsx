import type { ReactNode } from "react";
import { requirePrincipal } from "@/server/auth/principal";
import { hasCapability } from "@/server/auth/authorize";
import { createPrismaClient } from "@/server/db/prisma";
import { getValueStream } from "@/modules/core/org/server/services/value-stream";
import { getValueStreamBudget } from "@/modules/budgeting/server/services/budgeting";
import { loadArtBudgetModel } from "@/modules/budgeting/server/views/art-budget-breakdown";
import { ArtBudgetView } from "@/modules/budgeting/features/components/art-budget/art-budget-view";
import { ValueStreamBudgetPlan } from "@/modules/budgeting/features/components/value-stream/value-stream-budget-plan";
import { loadValueStreamCourse } from "@/modules/budgeting/server/views/art-budget-detail";
import { listValueStreamGuardrailTargets } from "@/modules/work/server/services/guardrail-targets";
import {
  loadClassificationPreview,
  loadValueStreamCapacityMix,
} from "@/modules/work/server/views/value-stream-capacity-mix";
import { getTenantPractices } from "@/server/services/target-model";
import { resolveGuardrailTargets } from "@/modules/work/domain/portfolio-guardrails";
import { ValueStreamGuardrailsSection } from "@/modules/work/features/portfolio/components/value-stream-guardrails-section";
import { AllocationCourseChart } from "@/modules/budgeting/features/components/art-budget/allocation-course-chart";
import { listRtbItems } from "@/modules/budgeting/server/services/rtb-item-service";
import { RtbSection } from "@/modules/budgeting/features/components/rtb/rtb-section";
import { listAuditHistory } from "@/server/services/audit-history";
import { listTenantApprovers } from "@/modules/work/server/services/tenant-approvers";
import { listGateApproverRules } from "@/modules/work/server/services/stage-gate-transition";
import { listTenantUserLabels } from "@/server/services/tenant-users";
import { userLabel } from "@/components/detail/initiative-labels";
import { GateApproverRulesSection } from "@/modules/work/features/portfolio/components/gate-approver-rules-section";
import {
  EntityDetailShell,
  resolveTab,
  type DetailTab,
} from "@/components/detail/entity-detail-shell";
import { AuditTimeline } from "@/components/detail/audit-timeline";
import { ValueStreamOverviewForm } from "@/modules/core/org/features/capacity/components/value-stream-overview-form";
import { CreateArtDialog } from "@/modules/core/org/features/art/components/create-art-dialog";
import { Link } from "@/i18n/navigation";
import { redirect } from "next/navigation";
import type { ValueStreamId } from "@/modules/core/kernel/domain/types";

const BASE_TABS: readonly DetailTab[] = [
  { key: "overview", label: "Overview" },
  { key: "arts", label: "ARTs" },
  { key: "history", label: "Verlauf" },
];

/** Budget nur mit aktivem Modul — und stets vor „Verlauf", wie auf der Epic-Seite. */
function tabsFor(budgetingEnabled: boolean): readonly DetailTab[] {
  return budgetingEnabled
    ? [...BASE_TABS.slice(0, -1), { key: "budget", label: "Budget" }, ...BASE_TABS.slice(-1)]
    : BASE_TABS;
}

interface Props {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export default async function ValueStreamDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { tab } = await searchParams;

  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const vs = await getValueStream(db, principal.tenantId, id as ValueStreamId);
  if (!vs) redirect("/structure");

  const canEdit = hasCapability(principal, "value_stream.update", {
    tenantId: principal.tenantId,
    valueStreamId: vs.id,
  });

  const canConfigureGates = hasCapability(principal, "epic.gate.approvers.configure", {
    tenantId: principal.tenantId,
    valueStreamId: vs.id,
  });

  // Budgeting ist ein oberes Modul: ohne Entitlement laedt die Seite seine Daten
  // gar nicht erst und blendet beide Abschnitte aus (Degradation, ADR-0013).
  // Der schmale `getValueStreamBudget`-Seam ersetzt das frueher tenant-weite
  // `getValueStreamBudgets(...).find(...)`.
  const budgetingEnabled = principal.enabledModules.includes("budgeting");
  // Der Reiter existiert nur mit Modul; `resolveTab` fängt ein `?tab=budget`
  // ohne Modul auf den ersten Reiter ab.
  const tabs = tabsFor(budgetingEnabled);
  const activeTab = resolveTab(tabs, tab);

  const [history, approvers, userLabels, budgeting, gateRules, guardrailRows, tenant] =
    await Promise.all([
      listAuditHistory(db, principal.tenantId, "value_stream", vs.id),
      listTenantApprovers(db, principal.tenantId),
      listTenantUserLabels(db, principal.tenantId),
      budgetingEnabled
        ? Promise.all([
            getValueStreamBudget(db, principal.tenantId, vs.id as ValueStreamId),
            loadArtBudgetModel(db, principal.tenantId, vs.id as ValueStreamId),
            listRtbItems(db, principal.tenantId, { valueStreamId: vs.id }),
            loadValueStreamCourse(db, principal.tenantId, vs.id),
            db.solution.findMany({
              where: { tenantId: principal.tenantId, valueStreamId: vs.id, deletedAt: null },
              select: { id: true, name: true },
              orderBy: { name: "asc" },
            }),
          ]).then(([plan, artModel, rtbItems, course, solutions]) => ({
            plan,
            artModel,
            rtbItems,
            course,
            solutions,
          }))
        : Promise.resolve(null),
      listGateApproverRules(db, principal.tenantId, vs.id),
      listValueStreamGuardrailTargets(db, principal.tenantId),
      db.tenant.findUnique({
        where: { id: principal.tenantId },
        select: { guardrailTargets: true },
      }),
    ]);

  const resolved = resolveGuardrailTargets(guardrailRows, tenant?.guardrailTargets ?? null, vs.id);
  const practices = await getTenantPractices(db, principal.tenantId);
  const [capacityMix, classPreview] = await Promise.all([
    loadValueStreamCapacityMix(db, principal.tenantId, vs.id, resolved.targets.capacity),
    practices.artEpics
      ? loadClassificationPreview(
          db,
          principal.tenantId,
          vs.id,
          resolved.targets.approval.portfolioThreshold,
        )
      : Promise.resolve(null),
  ]);
  const canSetTargets = hasCapability(principal, "target.manage", {
    tenantId: principal.tenantId,
    valueStreamId: vs.id,
  });

  // ART budgets are distributed by the VS Finance approver (or anyone the
  // `art_budget.manage` policy grants). Migration note: the previous inline
  // check was strictly narrower than the policy — it omitted VALUE_STREAM_OWNER
  // which the service-seam allows. Aligning with policy now.
  const canEditArtBudget =
    vs.financeApproverId === principal.id ||
    hasCapability(principal, "art_budget.manage", {
      tenantId: principal.tenantId,
      valueStreamId: vs.id,
    });
  const events = history.map((e) => ({
    id: e.id,
    action: e.action,
    occurredAt: e.occurredAt.toISOString(),
  }));
  // Verantwortlicher Prüfer je Value Stream (früher „VMO") — jetzt Portfolio Manager.
  const vmoUsers = approvers.filter((u) => u.roles.includes("portfolio_manager"));

  return (
    <EntityDetailShell
      backHref="/structure"
      backLabel="Zurück zur Struktur"
      title={vs.name}
      badge={`${vs.arts.length} ART${vs.arts.length !== 1 ? "s" : ""}`}
      tabs={tabs}
      activeTab={activeTab}
      basePath={`/value-streams/${vs.id}`}
    >
      {activeTab === "overview" && (
        <div className="space-y-8">
          {canEdit ? (
            <ValueStreamOverviewForm
              key={[
                vs.id,
                vs.name,
                vs.description ?? "",
                vs.financeApproverId ?? "",
                vs.vmoId ?? "",
              ].join("|")}
              id={vs.id}
              name={vs.name}
              description={vs.description ?? ""}
              financeApproverId={vs.financeApproverId ?? ""}
              vmoId={vs.vmoId ?? ""}
              users={approvers}
              vmoUsers={vmoUsers}
              userLabels={userLabels}
            />
          ) : (
            <dl className="max-w-xl space-y-3 text-sm">
              <Field label="Name">{vs.name}</Field>
              <Field label="Beschreibung">{vs.description ?? "—"}</Field>
              <Field label="Finance Approver">
                {vs.financeApproverId ? userLabel(vs.financeApproverId, userLabels) : "—"}
              </Field>
              <Field label="VMO">{vs.vmoId ? userLabel(vs.vmoId, userLabels) : "—"}</Field>
            </dl>
          )}
          <GateApproverRulesSection
            valueStreamId={vs.id}
            rules={gateRules}
            vmoId={vs.vmoId ?? null}
            financeApproverId={vs.financeApproverId ?? null}
            approvers={approvers}
            userLabels={userLabels}
            canConfigure={canConfigureGates}
          />
        </div>
      )}

      {activeTab === "budget" && budgeting && (
        <div className="space-y-8">
          <ValueStreamBudgetPlan
            periods={budgeting.plan.periods}
            plan={budgeting.plan.budget ?? undefined}
          />
          {budgeting.course.course && (
            <AllocationCourseChart
              course={budgeting.course.course}
              todayIndex={budgeting.course.todayIndex}
              title={`Verlauf · ${budgeting.course.cycles.find((c) => c.key === budgeting.course.cycleKey)?.label ?? ""}`}
              subtitle="Alle Zuteilungen dieses Wertstroms, auf die Monate des Halbjahres verteilt."
            />
          )}
          <ArtBudgetView model={budgeting.artModel} />
          <ValueStreamGuardrailsSection
            valueStreamId={vs.id}
            mix={capacityMix}
            threshold={resolved.targets.approval.portfolioThreshold}
            source={resolved.source}
            overriddenAxes={resolved.overriddenAxes}
            canEdit={canSetTargets}
            preview={classPreview}
          />
          <RtbSection
            valueStreamId={vs.id}
            items={budgeting.rtbItems}
            canManage={canEditArtBudget}
            solutions={budgeting.solutions}
          />
        </div>
      )}

      {activeTab === "arts" && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">ARTs</h2>
            {canEdit && <CreateArtDialog valueStreams={[{ id: vs.id, name: vs.name }]} />}
          </div>
          {vs.arts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine ARTs in diesem Value Stream.</p>
          ) : (
            <ul className="space-y-2">
              {vs.arts.map((art) => (
                <li key={art.id}>
                  <Link
                    href={`/art/${art.id}`}
                    className="flex items-center gap-3 rounded border p-3 text-sm transition-colors hover:bg-muted/50"
                  >
                    <span className="font-medium">{art.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {activeTab === "history" && (
        <section>
          <h2 className="mb-3 text-lg font-medium">Verlauf</h2>
          <AuditTimeline events={events} />
        </section>
      )}
    </EntityDetailShell>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}
