import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { hasCapability } from "@/server/auth/authorize";
import { createPrismaClient } from "@/server/db/prisma";
import { getValueStream } from "@/modules/core/org/server/services/value-stream";
import { canOpenValueStream } from "@/modules/core/org/domain/structure-access";
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
import { ValueStreamOverviewForm } from "@/modules/core/org/features/capacity/components/value-stream-overview-form";
import { GateApproverRulesSection } from "@/modules/work/features/portfolio/components/gate-approver-rules-section";
import { listGateApproverRules } from "@/modules/work/server/services/stage-gate-transition";
import { DeleteValueStreamButton } from "@/modules/core/org/features/value-stream/components/delete-value-stream-button";
import { listValueStreamGuardrailTargets } from "@/modules/work/server/services/guardrail-targets";
import { resolveGuardrailTargets } from "@/modules/work/domain/portfolio-guardrails";
import {
  loadClassificationPreview,
  loadValueStreamCapacityMix,
} from "@/modules/work/server/views/value-stream-capacity-mix";
import { ValueStreamGuardrailsSection } from "@/modules/work/features/portfolio/components/value-stream-guardrails-section";
import { getTenantPractices } from "@/server/services/target-model";
import { SolutionsOfNode } from "@/modules/work/features/portfolio/components/solutions/solutions-of-node";
import { loadSolutionsList } from "@/modules/work/server/views/solutions-list";
import type { ValueStreamId } from "@/modules/core/kernel/domain/types";

/**
 * Der Wertstrom-Knoten der Struktur-Fläche.
 *
 * Zwei Dinge unterscheiden ihn von der früheren `/value-streams/[id]`:
 *
 * 1. **Der Budget-Reiter ist aufgeteilt.** Fünf Abschnitte in einem Reiter
 *    waren drei Fragen in einem Topf — wie viel Geld ist da (Budget), welche
 *    Regeln gelten (Guardrails), was kostet der Betrieb (Betrieb).
 * 2. **Geladen wird nur, was der aktive Reiter braucht.** Vorher lief bei jedem
 *    Aufruf eine Welle über alles — Budget, Guardrails, Kapazitätsmix,
 *    Freigabe-Regeln, Audit —, unabhängig davon, was zu sehen war. Bei sechs
 *    Reitern ist das nicht mehr vertretbar.
 */
interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export default async function ValueStreamNodePage({ params, searchParams }: Props) {
  const { id } = await params;
  const { tab } = await searchParams;

  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const vs = await getValueStream(db, principal.tenantId, id as ValueStreamId);
  if (!vs) notFound();

  const inScope = canOpenValueStream(principal.scopes, {
    id: vs.id,
    artIds: vs.arts.map((a) => a.id),
  });

  const budgetingEnabled = principal.enabledModules.includes("budgeting");
  // Die Finance-Partei des Wertstroms darf ohne Rolle lesen — derselbe Seam,
  // den `art_budget.manage` für das Verteilen nutzt.
  const canReadBudget =
    budgetingEnabled &&
    inScope &&
    (vs.financeApproverId === principal.id ||
      hasCapability(principal, "budget.read", {
        tenantId: principal.tenantId,
        valueStreamId: vs.id,
      }));

  const tabs: DetailTab[] = [
    { key: "overview", label: "Allgemein" },
    // Budget und Betrieb sind nach `/budgeting/value-streams/[id]` gezogen:
    // Geld wird im Budgeting-Bereich verwaltet, nicht in der Struktur.
    // Guardrails bleibt — das ist `modules/work`, kein Budgeting.
    ...(canReadBudget ? [{ key: "guardrails", label: "Guardrails" }] : []),
    ...(inScope
      ? [
          { key: "solutions", label: "Solutions" },
          { key: "history", label: "Verlauf" },
        ]
      : []),
  ];

  // Ohne `?tab=` greift die Erinnerung — aber nur, wenn das Recht den Reiter
  // noch hergibt; `resolveTab` fängt den Rest auf „Allgemein" ab.
  const remembered = (await cookies()).get(tabCookieName("vs"))?.value;
  const activeTab = resolveTab(tabs, tab ?? remembered);

  const canEdit =
    inScope &&
    hasCapability(principal, "value_stream.update", {
      tenantId: principal.tenantId,
      valueStreamId: vs.id,
    });

  return (
    <EntityDetailShell
      title={vs.name}
      badge={`${vs.arts.length} ART${vs.arts.length !== 1 ? "s" : ""}`}
      tabs={tabs}
      activeTab={activeTab}
      basePath={`/structure/value-stream/${vs.id}`}
    >
      <RememberTab kind="vs" tab={activeTab} />

      {!inScope && (
        <div className="mb-4 rounded-lg border border-dashed bg-muted/40 p-4 text-sm">
          <p className="font-medium">Dieser Wertstrom liegt außerhalb deines Bereichs.</p>
          <p className="mt-1 text-muted-foreground">
            Name und Verantwortliche stehen unten. Budget, Guardrails, Betrieb, Solutions und
            Verlauf bleiben zu. Im Baum bleibt er sichtbar, damit die Landkarte vollständig ist.
          </p>
        </div>
      )}

      {activeTab === "overview" && canReadBudget && (
        <p className="mb-4 rounded-lg border bg-card px-4 py-3 text-sm">
          Budget, Betriebskosten und die ART-Epic-Budgets dieses Wertstroms liegen im
          Budgeting-Bereich.{" "}
          <Link
            href={`/budgeting/value-streams/${vs.id}`}
            className="font-medium text-primary hover:underline"
          >
            Budget dieses Wertstroms →
          </Link>
        </p>
      )}
      {activeTab === "overview" && (
        <OverviewTab db={db} vs={vs} principal={principal} canEdit={canEdit} inScope={inScope} />
      )}
      {activeTab === "guardrails" && (
        <GuardrailsTab db={db} principal={principal} vsId={vs.id} inScope={inScope} />
      )}
      {activeTab === "solutions" && (
        <SolutionsTab db={db} tenantId={principal.tenantId} valueStreamId={vs.id} />
      )}
      {activeTab === "history" && <HistoryTab db={db} tenantId={principal.tenantId} id={vs.id} />}
    </EntityDetailShell>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any -- die Reiter-Teile teilen
   sich den bereits typisierten Prisma-Client und die Service-Rückgaben; ein
   eigener Typ je Teil brächte hier nichts als Wiederholung. */

async function OverviewTab({ db, vs, principal, canEdit, inScope }: any) {
  const [approvers, userLabels, gateRules] = await Promise.all([
    listTenantApprovers(db, principal.tenantId),
    listTenantUserLabels(db, principal.tenantId),
    inScope ? listGateApproverRules(db, principal.tenantId, vs.id) : Promise.resolve([]),
  ]);
  const vmoUsers = approvers.filter((u: { roles: string[] }) =>
    u.roles.includes("portfolio_manager"),
  );
  const canConfigureGates =
    inScope &&
    hasCapability(principal, "epic.gate.approvers.configure", {
      tenantId: principal.tenantId,
      valueStreamId: vs.id,
    });

  return (
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
          <Field label="Portfolio Manager">
            {vs.vmoId ? userLabel(vs.vmoId, userLabels) : "—"}
          </Field>
        </dl>
      )}

      {inScope && (
        <>
          <GateApproverRulesSection
            valueStreamId={vs.id}
            rules={gateRules}
            vmoId={vs.vmoId ?? null}
            financeApproverId={vs.financeApproverId ?? null}
            approvers={approvers}
            userLabels={userLabels}
            canConfigure={canConfigureGates}
          />
          {canEdit && (
            <section>
              <h2 className="mb-2 text-sm font-medium">Wertstrom löschen</h2>
              <DeleteValueStreamButton id={vs.id} name={vs.name} />
            </section>
          )}
        </>
      )}
    </div>
  );
}

async function GuardrailsTab({ db, principal, vsId, inScope }: any) {
  const [guardrailRows, tenant, practices] = await Promise.all([
    listValueStreamGuardrailTargets(db, principal.tenantId),
    db.tenant.findUnique({ where: { id: principal.tenantId }, select: { guardrailTargets: true } }),
    getTenantPractices(db, principal.tenantId),
  ]);
  const resolved = resolveGuardrailTargets(guardrailRows, tenant?.guardrailTargets ?? null, vsId);
  const [mix, preview] = await Promise.all([
    loadValueStreamCapacityMix(db, principal.tenantId, vsId, resolved.targets.capacity),
    practices.artEpics
      ? loadClassificationPreview(
          db,
          principal.tenantId,
          vsId,
          resolved.targets.approval.portfolioThreshold,
        )
      : Promise.resolve(null),
  ]);

  return (
    <ValueStreamGuardrailsSection
      valueStreamId={vsId}
      mix={mix}
      threshold={resolved.targets.approval.portfolioThreshold}
      source={resolved.source}
      overriddenAxes={resolved.overriddenAxes}
      canEdit={
        inScope &&
        hasCapability(principal, "target.manage", {
          tenantId: principal.tenantId,
          valueStreamId: vsId,
        })
      }
      preview={preview}
    />
  );
}

async function SolutionsTab({ db, tenantId, valueStreamId }: any) {
  const rows = await loadSolutionsList(db, tenantId, { valueStreamId });
  return (
    <SolutionsOfNode
      rows={rows}
      emptyText="Für diesen Wertstrom ist noch keine Solution angelegt."
    />
  );
}

async function HistoryTab({ db, tenantId, id }: any) {
  const history = await listAuditHistory(db, tenantId, "value_stream", id);
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}
