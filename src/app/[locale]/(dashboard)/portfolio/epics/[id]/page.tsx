import { requirePrincipal } from "@/server/auth/principal";
import { hasCapability } from "@/server/auth/authorize";
import { createPrismaClient } from "@/server/db/prisma";
import { loadEpicDetail } from "@/modules/work/server/views/epic-detail";
import { listProgramIncrementsForArts } from "@/modules/drumbeat/server/services/pi";
import { listBreakdownDependencies } from "@/modules/drumbeat/server/services/dependency";
import { classifyEpics } from "@/modules/work/server/services/epic-class";
import {
  getEpicBudgetAllocation,
  getEpicBudgetStanding,
} from "@/modules/budgeting/server/services/epic-allocation";
import {
  allocationState,
  ALLOCATION_STATE_LABELS,
} from "@/modules/budgeting/domain/allocation-state";
import {
  mayHoldAllocation,
  FIRST_FUNDABLE_STEP,
} from "@/modules/budgeting/domain/allocation-eligibility";
import { loadIssues } from "@/modules/risks/server/views/issues";
import { IssuesListShell } from "@/modules/risks/features/issue/components/issues-list-shell";
import { loadEpicGoalLinks } from "@/modules/core/goals/server/views/epic-goal-contributions";
import { listTenantApprovers } from "@/modules/work/server/services/tenant-approvers";
import { listTenantUserLabels } from "@/server/services/tenant-users";
import { EpicGoalsBadge } from "@/modules/work/features/portfolio/components/epic-goals-badge";
import { EpicRealizedTile } from "@/modules/work/features/portfolio/components/epic-realized-tile";
import { EntityDetailShell, resolveTab } from "@/components/detail/entity-detail-shell";
import { loadCockpitFeatureDetail } from "@/modules/drumbeat/server/views/cockpit-feature-detail";
import { FeatureSlideOver } from "@/modules/drumbeat/features/cockpit/components/feature-slide-over";
import { InitiativeActivitySidebar } from "@/components/detail/initiative-activity-sidebar";
import { EpicHistoryTimeline } from "@/modules/work/features/portfolio/components/epic-history-timeline";
import { EPIC_TABS } from "@/modules/work/features/portfolio/components/epic-detail-shell";
import { EpicOverviewTab } from "@/modules/work/features/portfolio/components/epic-overview-tab";
import { getTenantPractices } from "@/server/services/target-model";
import { listValueStreamGuardrailTargets } from "@/modules/work/server/services/guardrail-targets";
import { resolveGuardrailTargets } from "@/modules/work/domain/portfolio-guardrails";
import { classifyEpic, classificationDrift } from "@/modules/work/domain/pb-submission";
import { EpicGateCard } from "@/modules/work/features/portfolio/components/gate/epic-gate-card";
import { EpicKpisTab } from "@/modules/work/features/portfolio/components/epic-kpis-tab";
import { EpicBusinessCaseCalcTab } from "@/modules/work/features/portfolio/components/epic-business-case-calc-tab";
import { buildEpicBusinessCaseCalcForTab } from "@/modules/work/domain/epic-bc-calculation";
import { kpiOutcome } from "@/modules/core/kpi/domain/kpi-outcome";
import { EpicBreakdownTab } from "@/modules/work/features/portfolio/components/epic-breakdown-tab";
import { BenefitHypothesisEditor } from "@/modules/work/features/portfolio/components/benefit-hypothesis-editor";
import { BusinessCaseEditor } from "@/modules/work/features/portfolio/components/business-case-editor";
import { EpicTimelineTab } from "@/modules/work/features/portfolio/components/epic-timeline-tab";
import { EpicOwnerAssign } from "@/modules/work/features/portfolio/components/epic-owner-assign";
import { EpicGateLadder } from "@/modules/work/features/portfolio/components/epic-gate-ladder";
import { HorizonBadge } from "@/modules/core/org/features/solution/components/horizon-badge";
import { currentGateStep, gateStepLabel } from "@/modules/work/domain/stage-gate";
import { EPIC_CLASS_LABELS } from "@/modules/work/domain/pb-submission";
import { EPIC_TYPE_LABEL, isEpicType } from "@/modules/work/domain/portfolio-guardrails";
import { resolveEpicHorizon } from "@/modules/work/domain/epic-horizon";
import {
  RevisionDiff,
  RevisionEditLayout,
  businessCaseDiffRows,
  benefitHypothesisDiffRows,
} from "@/modules/work/features/portfolio/components/revision-diff";
import { DeleteEpicButton } from "@/modules/work/features/portfolio/components/delete-epic-button";
import { redirect } from "next/navigation";
import type { EpicId } from "@/modules/core/kernel/domain/types";

interface Props {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ tab?: string; featureId?: string; bcMonth?: string }>;
}

/**
 * Epic detail — a cross-module composite. The composition itself (Work
 * economics/approvals + Drumbeat PIs/dependencies + Budgeting funded-window +
 * Core goals/KPI) lives in the `loadEpicDetail` read-model; this route wires the
 * Drumbeat/Budgeting adapters per entitlement, loads the few page-only extras
 * (approvers/user-labels/goal-links), and renders. See ADR-0013.
 */
export default async function EpicDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { tab, featureId, bcMonth } = await searchParams;

  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const tenantId = principal.tenantId;
  const epicId = id as EpicId;

  // Entitlement axis (fail-closed): the Drumbeat/Budgeting slices degrade when the
  // tenant lacks the module. Precedent: `ziele/page.tsx`.
  const enabled = {
    drumbeat: principal.enabledModules.includes("drumbeat"),
    budgeting: principal.enabledModules.includes("budgeting"),
    risks: principal.enabledModules.includes("risks"),
  };

  /**
   * Die Einordnung dieses Epics — sie entscheidet, aus welchem Topf sein Geld
   * kommt (`chooseAllocation`). Eigene Abfrage, weil der Budget-Port innerhalb
   * von `loadEpicDetail` läuft und die Klassifikation der Guardrail-Kachel erst
   * danach entsteht.
   */
  const epicClassOf = async () =>
    (await classifyEpics(db, tenantId, [epicId])).get(epicId)?.epicClass ?? null;

  const [model, approvers, userLabels, goalLinks] = await Promise.all([
    loadEpicDetail(
      db,
      principal,
      epicId,
      {
        pis: (artIds) => listProgramIncrementsForArts(db, tenantId, artIds),
        dependencies: (featureIds) => listBreakdownDependencies(db, tenantId, featureIds),
        budget: async (facts) => {
          // Der Stand liest **beide** Töpfe (Portfolio- und ART-Zuteilung) und
          // wählt nach der Klasse — nie beide zusammen. Die Klasse steht hier
          // im Composition-Root; Work importiert nichts aus Budgeting.
          const [allocation, standing] = await Promise.all([
            getEpicBudgetAllocation(db, tenantId, epicId),
            getEpicBudgetStanding(db, tenantId, epicId, await epicClassOf(), new Date()),
          ]);
          const allocatedSum = allocation?.allocatedSum ?? 0;
          // Zustand und Förderfähigkeit beantwortet Budgeting — hier an der
          // Naht, wo beide Module sich sehen dürfen. Das Etikett reist als
          // Wert mit, damit es nicht in Work ein zweites Mal entsteht.
          const state = allocationState({
            stageGate: facts.stageGate,
            implementationCompletedAt: facts.implementationCompletedAt,
          });
          return {
            allocatedSum,
            allocatedByPeriod: allocation?.allocatedByPeriod ?? {},
            standing,
            allocationState:
              allocatedSum > 0 ? { key: state, label: ALLOCATION_STATE_LABELS[state] } : null,
            fundable: {
              may: mayHoldAllocation(facts.step),
              firstStep: FIRST_FUNDABLE_STEP,
            },
          };
        },
      },
      enabled,
    ),
    listTenantApprovers(db, tenantId),
    listTenantUserLabels(db, tenantId),
    loadEpicGoalLinks(db, principal, epicId),
  ]);
  if (!model) redirect("/portfolio/epics");

  // Guardrail 3: Portfolio- oder ART-Epic. Nur mit aktiver Practice — ohne sie
  // gibt es die Unterscheidung nicht, und ein Badge dafür wäre eine Behauptung
  // über ein Verfahren, das nicht läuft.
  const practices = await getTenantPractices(db, tenantId);
  const epicClassification = practices.artEpics
    ? await (async () => {
        const [row, guardrailRows, tenantRow] = await Promise.all([
          db.initiative.findFirst({
            where: { id: epicId, tenantId },
            select: {
              valueStreamId: true,
              businessCase: true,
              businessCaseApprovedAt: true,
              hypothesisApprovedAt: true,
              portfolioOverrideAt: true,
              intendedClass: true,
            },
          }),
          listValueStreamGuardrailTargets(db, tenantId),
          db.tenant.findUnique({ where: { id: tenantId }, select: { guardrailTargets: true } }),
        ]);
        if (!row) return null;
        const resolved = resolveGuardrailTargets(
          guardrailRows,
          tenantRow?.guardrailTargets ?? null,
          row.valueStreamId,
        );
        const classification = classifyEpic(row, resolved.targets.approval.portfolioThreshold);

        // Nach der Quellen-Trennung ist ein ART-Epic vom PB-Liste ausgeschlossen.
        // Fehlt ihm auch ein Rahmen, hat es überhaupt keinen Weg mehr — das
        // wird ausgewiesen, nicht verschwiegen.
        let fundingGap: "noArt" | "noPot" | null = null;
        if (classification.epicClass === "art") {
          const art = await db.initiative.findFirst({
            where: { id: epicId, tenantId },
            select: { artId: true },
          });
          if (art?.artId == null) {
            fundingGap = "noArt";
          } else {
            const pot = await db.runTheBusinessItem.count({
              where: { tenantId, artId: art.artId, kind: "art_change", active: true },
            });
            if (pot === 0) fundingGap = "noPot";
          }
        }

        return {
          classification,
          source: resolved.source,
          fundingGap,
          intended: (row.intendedClass ?? null) as "portfolio" | "art" | null,
          valueStreamId: row.valueStreamId,
        };
      })()
    : null;

  // Weicht die abgeleitete Klasse von der beim Anlegen hinterlegten Erwartung
  // ab, tritt vor dem L3.1-Antrag ein Dialog dazwischen. Bestehen darf man nur
  // nach unten (Portfolio-Sache bleiben) — und nur mit dem Recht dafür.
  const classDrift = (() => {
    if (!epicClassification) return null;
    const { intended, classification } = epicClassification;
    const derived = classification.epicClass;
    if (intended == null || derived == null) return null;
    const drift = classificationDrift(intended, derived);
    if (drift === "none") return null;
    return {
      drift,
      intended,
      derived,
      cost: classification.cost,
      threshold: classification.threshold,
      valueStreamId: epicClassification.valueStreamId ?? "",
      canOverride: hasCapability(principal, "epic.portfolio_override", {
        tenantId: principal.tenantId,
        ...(epicClassification.valueStreamId
          ? { valueStreamId: epicClassification.valueStreamId }
          : {}),
      }),
    };
  })();

  // Issues tab content — risks + impediments rolled up over the Epic's feature
  // subtree (composition root may import the risks module; ADR-0013).
  const epicIssues = enabled.risks
    ? await loadIssues(db, principal, { kind: "epic", epicId })
    : null;
  const issueScope = { tenantId };
  const issueCaps = {
    canDocument: hasCapability(principal, "risk.document", issueScope),
    canUpdate: hasCapability(principal, "risk.update", issueScope),
    canRoam: hasCapability(principal, "risk.roam", issueScope),
    canLink: hasCapability(principal, "risk.link", issueScope),
    canDelete: hasCapability(principal, "risk.delete", issueScope),
    canReview: hasCapability(principal, "risk.review", issueScope),
    canManageSettings: hasCapability(principal, "risk.settings.manage", issueScope),
  };

  const { epic, timeline, benefitHypothesis, businessCase, kpiRows } = model;

  // Zuordenbare Solutions = Solutions im Value Stream des Epics (für die Zuordnung).
  const availableSolutions = epic.valueStreamId
    ? await db.solution.findMany({
        where: { tenantId, valueStreamId: epic.valueStreamId, deletedAt: null },
        select: { id: true, name: true, horizon: true },
        orderBy: { name: "asc" },
      })
    : [];
  // Issues tab only when the module is entitled (slice present) — eingefügt VOR
  // History, damit History der letzte Reiter bleibt.
  const tabs = model.risks.disabled
    ? EPIC_TABS
    : [...EPIC_TABS.slice(0, -2), { key: "issues", label: "Issues" }, ...EPIC_TABS.slice(-2)];
  const activeTab = resolveTab(tabs, tab);

  // Der Stand des Epics auf der Reifegrad-Achse. Er speist **drei** Flaechen:
  // das Abzeichen im Kopf, die Leiter im Unterkopf und die Ringe an den
  // Reitern. Dreimal derselbe Ausdruck waere dreimal dieselbe Gelegenheit,
  // auseinanderzulaufen.
  const gateNow = currentGateStep({
    stageGate: epic.stageGate as never,
    approvedAt: epic.approvedAt,
    implementationCompletedAt: epic.implementationCompletedAt,
  });

  // Slide-Over-Detail nur laden wenn ?featureId= im URL — gleiche Sicht wie im
  // Cockpit; ein Klick auf eine Feature-Karte springt nicht in eine Voll-Route.
  const slideOverDetail = featureId
    ? await loadCockpitFeatureDetail(db, principal, featureId)
    : null;

  const kpiNames = kpiRows.map((k) => k.name);

  return (
    <>
      <EntityDetailShell
        backHref="/portfolio/epics"
        backLabel="Zurück zu den Epics"
        breadcrumb={[
          { label: "Portfolio", href: "/portfolio" },
          { label: "Epics", href: "/portfolio/epics" },
          { label: epic.title },
        ]}
        title={epic.title}
        /**
         * Der Stand auf einen Blick, bevor irgendein Reiter offen ist. Er stand
         * vorher nur im Unterkopf — verteilt über drei Karten.
         */
        badges={
          <>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
              <span aria-hidden className="size-1.5 rounded-full bg-current" />
              {gateStepLabel(gateNow)}
            </span>
            {epicClassification ? (
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                {epicClassification.classification.epicClass
                  ? EPIC_CLASS_LABELS[epicClassification.classification.epicClass]
                  : "Noch nicht eingeordnet"}
              </span>
            ) : null}
            <HorizonBadge
              horizon={resolveEpicHorizon({
                investmentHorizon: epic.investmentHorizon,
                solutionHorizon: epic.primarySolution?.horizon ?? null,
                businessCaseApprovedAt: epic.businessCaseApprovedAt,
              })}
            />
            {epic.epicType && isEpicType(epic.epicType) && (
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                {EPIC_TYPE_LABEL[epic.epicType]}
              </span>
            )}
            {epic.needsSteeringAttention && (
              <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                Zur Steuerung markiert
              </span>
            )}
          </>
        }
        tabs={tabs}
        activeTab={activeTab}
        currentGate={gateNow}
        basePath={`/portfolio/epics/${epic.id}`}
        headerActions={
          model.canEdit ? (
            <DeleteEpicButton
              id={epic.id}
              title={epic.title}
              featureCount={model.breakdownFeatures.length}
            />
          ) : undefined
        }
        /**
         * **Ein Band statt dreier Karten.**
         *
         * Hier standen Reifegrad-Karte, Lebenszyklus-Stepper und ein
         * siebenspaltiges Kernfakten-Band übereinander — über *jedem* der neun
         * Reiter, auch dort, wo sie nichts beitragen. Geblieben sind die Leiter
         * (eine Zeile statt fünf Kacheln) und die Gate-Karte, die als einzige
         * eine Handlung anbietet. Die Kernfakten sind in den Overview-Reiter
         * gewandert, wo sie hingehören: Kosten und Nutzen in die
         * Wirtschaftlichkeit, Owner und Wertstrom in die Zuordnung, das
         * PI-Fenster ins Zeitfenster.
         */
        subHeader={
          <div className="space-y-3">
            <EpicGateLadder current={gateNow} />
            <EpicGateCard
              epicId={epic.id}
              gate={model.gate}
              approvers={approvers}
              userLabels={userLabels}
              classDrift={classDrift}
            />
          </div>
        }
        aside={
          <InitiativeActivitySidebar
            events={model.activityEvents}
            userLabels={userLabels}
            truncated={model.activityTruncated}
          />
        }
      >
        {activeTab === "overview" && (
          /**
           * Der Reiter ordnet selbst; die Seite reicht nur durch, was sie
           * geladen hat. Der **Owner** gehört ausdrücklich dazu: das
           * Tor-Kriterium „Epic Owner ist benannt" verlinkt hierher, und bis zur
           * Überarbeitung gab es hier kein Owner-Feld.
           */
          <EpicOverviewTab
            epic={epic}
            canEdit={model.canEdit}
            canOverrideHorizon={model.canOverrideHorizon}
            totals={model.heroTotals}
            solutions={availableSolutions}
            classification={epicClassification}
            budgetStanding={model.budgeting.disabled ? null : model.budgeting.standing}
            allocationState={model.budgeting.disabled ? null : model.budgeting.allocationState}
            fundable={
              model.budgeting.disabled ? { may: true, firstStep: "" } : model.budgeting.fundable
            }
            ownerSlot={
              <EpicOwnerAssign
                epicId={epic.id}
                ownerId={epic.ownerId}
                canAssignOwner={model.canAssignOwner}
                approvers={approvers}
                userLabels={userLabels}
              />
            }
            realizedSlot={
              <EpicRealizedTile kpis={model.kpis} frozenAt={epic.implementationCompletedAt} />
            }
            goalsSlot={<EpicGoalsBadge goalLinks={goalLinks.links} />}
          />
        )}

        {activeTab === "timeline" && (
          <section>
            <h2 className="mb-4 font-heading text-lg font-medium">Reifegrad-Timeline</h2>
            <EpicTimelineTab
              epicId={epic.id}
              createdAt={epic.createdAt.toISOString()}
              selectedForDetailingAt={epic.selectedForDetailingAt?.toISOString() ?? null}
              hypothesisApprovedAt={epic.hypothesisApprovedAt?.toISOString() ?? null}
              selectedForAnalyzingAt={epic.selectedForAnalyzingAt?.toISOString() ?? null}
              businessCaseApprovedAt={epic.businessCaseApprovedAt?.toISOString() ?? null}
              implementationStartedAt={epic.implementationStartedAt?.toISOString() ?? null}
              impactRecognizedAt={epic.impactRecognizedAt?.toISOString() ?? null}
              approvedAt={epic.approvedAt?.toISOString() ?? null}
              implementationCompletedAt={epic.implementationCompletedAt?.toISOString() ?? null}
              timeline={timeline}
              canEdit={model.canEdit}
              gateHistory={model.gate.disabled ? [] : model.gate.history}
              userLabels={userLabels}
              lifecycleSteps={model.lifecycleSteps}
            />
          </section>
        )}

        {activeTab === "business-case" && (
          <section>
            <h2 className="mb-4 text-lg font-medium">Business Case</h2>
            {model.showBcReviewDiff && model.bcBaseline ? (
              <RevisionDiff rows={businessCaseDiffRows(model.bcBaseline, businessCase.current)} />
            ) : model.showBcOwnerEdit && model.bcBaseline ? (
              <RevisionEditLayout
                left={
                  <BusinessCaseEditor
                    epicId={epic.id}
                    current={model.bcBaseline}
                    history={[]}
                    readOnly
                    kpiNames={kpiNames}
                  />
                }
                right={
                  <BusinessCaseEditor
                    epicId={epic.id}
                    current={businessCase.current}
                    history={businessCase.history}
                    readOnly={!model.bcEditable}
                    kpiNames={kpiNames}
                    cascade={goalLinks.cascade}
                    {...(model.bcLockReason && { lockReason: model.bcLockReason })}
                  />
                }
              />
            ) : (
              <BusinessCaseEditor
                epicId={epic.id}
                current={businessCase.current}
                history={businessCase.history}
                readOnly={!model.bcEditable}
                kpiNames={kpiNames}
                cascade={goalLinks.cascade}
                {...(model.bcLockReason && { lockReason: model.bcLockReason })}
              />
            )}
          </section>
        )}

        {activeTab === "business-case-calc" && (
          <EpicBusinessCaseCalcTab
            dayMonth={bcMonth}
            {...buildEpicBusinessCaseCalcForTab(
              {
                createdAt: epic.createdAt,
                selectedForDetailingAt: epic.selectedForDetailingAt,
                hypothesisApprovedAt: epic.hypothesisApprovedAt,
                selectedForAnalyzingAt: epic.selectedForAnalyzingAt,
                businessCaseApprovedAt: epic.businessCaseApprovedAt,
                implementationStartedAt: epic.implementationStartedAt,
                impactRecognizedAt: epic.impactRecognizedAt,
                plannedEndAt: epic.plannedEndAt,
                timeline: epic.timeline,
                businessCase: epic.businessCase,
                allocatedByPeriod: model.budgeting.disabled
                  ? {}
                  : model.budgeting.allocatedByPeriod,
                kpis: kpiRows.map((k) => ({
                  id: k.id,
                  name: k.name,
                  baseline: k.baseline,
                  target: k.target,
                  measurements: k.measurements,
                  benefitWeight: k.weight,
                  valuePerUnit: k.valuePerUnit,
                  benefitKind: k.benefitKind,
                  recurringInterval: k.recurringInterval,
                })),
                now: new Date(),
              },
              bcMonth,
            )}
          />
        )}

        {activeTab === "benefit-hypothesis" && (
          <section>
            <h2 className="mb-4 text-lg font-medium">Benefit Hypothese</h2>
            {model.showHypoReviewDiff && model.hypoBaseline ? (
              <RevisionDiff
                rows={benefitHypothesisDiffRows(model.hypoBaseline, benefitHypothesis.current)}
              />
            ) : model.showHypoOwnerEdit && model.hypoBaseline ? (
              <RevisionEditLayout
                left={
                  <BenefitHypothesisEditor
                    epicId={epic.id}
                    current={model.hypoBaseline}
                    history={[]}
                    readOnly
                  />
                }
                right={
                  <BenefitHypothesisEditor
                    epicId={epic.id}
                    current={benefitHypothesis.current}
                    history={benefitHypothesis.history}
                    readOnly={!model.hypoEditable}
                    {...(model.hypoLockReason && { lockReason: model.hypoLockReason })}
                  />
                }
              />
            ) : (
              <BenefitHypothesisEditor
                epicId={epic.id}
                current={benefitHypothesis.current}
                history={benefitHypothesis.history}
                readOnly={!model.hypoEditable}
                {...(model.hypoLockReason && { lockReason: model.hypoLockReason })}
              />
            )}
          </section>
        )}

        {activeTab === "breakdown" && (
          <EpicBreakdownTab
            view="list"
            epicId={epic.id}
            tenantId={tenantId}
            epicTitle={epic.title}
            epicValueStreamId={epic.valueStreamId}
            canEdit={model.canEdit}
            features={model.breakdownFeatures}
            pisByArt={model.drumbeat.disabled ? {} : model.drumbeat.pisByArt}
            showWsjf={model.showWsjf}
            canSetDelivery={model.canSetDelivery}
            dependencies={model.drumbeat.disabled ? [] : model.drumbeat.dependencies}
            canLinkDependency={model.canLinkDependency}
            breakdownLayoutPositions={model.breakdownLayoutPositions}
            breakdownPis={model.drumbeat.disabled ? [] : model.drumbeat.breakdownPis}
          />
        )}

        {activeTab === "dependencies" && (
          <EpicBreakdownTab
            view="graph"
            epicId={epic.id}
            tenantId={tenantId}
            epicTitle={epic.title}
            epicValueStreamId={epic.valueStreamId}
            canEdit={model.canEdit}
            features={model.breakdownFeatures}
            pisByArt={model.drumbeat.disabled ? {} : model.drumbeat.pisByArt}
            showWsjf={model.showWsjf}
            canSetDelivery={model.canSetDelivery}
            dependencies={model.drumbeat.disabled ? [] : model.drumbeat.dependencies}
            canLinkDependency={model.canLinkDependency}
            breakdownLayoutPositions={model.breakdownLayoutPositions}
            breakdownPis={model.drumbeat.disabled ? [] : model.drumbeat.breakdownPis}
          />
        )}

        {/* `kpiOutcome` lief bisher je Ziel-Verknüpfung im Browser — gegen die
            Regel, die `epic-detail.ts` für dieselben KPIs ausdrücklich festhält
            („so the KPIs tab renders instead of recomputing client-side"). Die
            Ziel-Links waren davon ausgenommen, weil ihr Read-Model mandantenweit
            lädt und das epic-eigene `frozenAt` nicht kennt. Hier stehen beide
            zusammen. */}
        {activeTab === "kpis" && (
          <EpicKpisTab
            initiativeId={epic.id}
            kpis={kpiRows}
            canEdit={model.canEdit}
            goalLinks={goalLinks.links.map((link) => ({
              ...link,
              outcome: kpiOutcome({
                baseline: link.kpiBaseline,
                target: link.kpiTarget,
                valuePerUnit: link.conversionFactor,
                benefitKind: link.impactKind,
                recurringInterval: link.recurringInterval,
                measurements: link.kpiMeasurements,
                planSnapshot: link.planSnapshot,
                frozenAt: epic.implementationCompletedAt,
              }),
            }))}
          />
        )}

        {activeTab === "history" && (
          <section>
            <h2 className="mb-3 font-heading text-lg font-medium">History</h2>
            <EpicHistoryTimeline
              events={model.activityEvents}
              userLabels={userLabels}
              truncated={model.activityTruncated}
            />
          </section>
        )}

        {activeTab === "issues" && epicIssues && (
          <IssuesListShell
            model={epicIssues.model}
            userLabels={epicIssues.userLabels}
            caps={issueCaps}
            initiativeId={epic.id}
            featureOptions={epic.children.map((c) => ({ id: c.id, title: c.title }))}
            embedded
          />
        )}
      </EntityDetailShell>
      {slideOverDetail && <FeatureSlideOver detail={slideOverDetail} />}
    </>
  );
}
