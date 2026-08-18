import { Prisma } from "@/generated/prisma";
import { buildEpicDetailModel, type EpicDetailInputs, type EpicDetailModel } from "./epic-detail";

/**
 * Ein erfundenes Epic für die Rollen-Tour — **kein Datenbankeintrag**.
 *
 * Warum das so gebaut ist: Der Epic Owner arbeitet auf der Epic-Detailseite, die
 * Tour muss also dorthin führen. Ein echtes Demo-Epic anzulegen scheidet aus
 * (`epic.delete` hat nur der Portfolio Manager — der Epic Owner könnte es nie
 * wieder entfernen; außerdem erschiene es sofort im Funnel und in der
 * „letzte Aktivität"-Liste aller Kollegen). Ein vorhandenes Epic scheidet aus,
 * weil es im leeren Workspace keines gibt — dort ist die Einführung am wichtigsten.
 *
 * Also: dieselbe Oberfläche, gefüttert aus einem Fixture. Möglich, weil
 * `epic-detail.ts` den unreinen Loader vom reinen `buildEpicDetailModel` trennt.
 *
 * **Alle `can*`-Flags sind `false`.** Damit rendert die Seite durchgängig
 * schreibgeschützt, ohne dass irgendwo einzelne Schaltflächen ausgeblendet werden
 * müssten — die Detailkomponenten werten diese Flags ohnehin aus. Ein Test hält
 * diese Zusicherung fest, damit sie nicht versehentlich aufweicht.
 *
 * Typsicherheit ist hier der eigentliche Schutz: ändert sich `EpicDetailInputs`,
 * bricht der Build. Das Beispiel kann nicht unbemerkt vom Produkt abdriften.
 */

const DEMO_TENANT = "00000000-0000-0000-0000-0000000000de";
const DEMO_EPIC_ID = "00000000-0000-0000-0000-0000000000e1";
const DEMO_VS_ID = "00000000-0000-0000-0000-0000000000v1";
const DEMO_USER = "00000000-0000-0000-0000-0000000000u1";

/** Fester Zeitpunkt — ein `new Date()` würde die Seite bei jedem Aufruf ändern. */
const T0 = new Date("2026-01-15T09:00:00.000Z");

/** Ein Deliverable des Beispiel-Epics, exakt in der Form, die der Loader liefert. */
type DemoChild = EpicDetailInputs["epic"]["children"][number];

function demoFeature(over: {
  id: string;
  title: string;
  status: string;
  wsjf: number;
}): DemoChild {
  return {
    id: over.id,
    title: over.title,
    level: 1,
    status: over.status,
    description: null,
    artId: null,
    piId: null,
    acceptanceCriteria: [] as string[],
    wsjfBusinessValue: 8,
    wsjfTimeCriticality: 5,
    wsjfRiskReduction: 3,
    wsjfJobSize: 5,
    wsjfComputed: new Prisma.Decimal(over.wsjf),
    featureType: null,
    art: null,
    pi: null,
    createdAt: T0,
  };
}

/** Die Eingaben des Builders — bewusst als eigene Funktion, damit Tests sie prüfen können. */
export function demoEpicDetailInputs(): EpicDetailInputs {
  const epic = {
    id: DEMO_EPIC_ID,
    tenantId: DEMO_TENANT,
    level: 0,
    parentId: null,
    path: DEMO_EPIC_ID,
    title: "Beispiel: Kundenportal modernisieren",
    description:
      "Ein erfundenes Epic, an dem die Einführung zeigt, wie ein Vorhaben ausgearbeitet wird.",
    ownerId: DEMO_USER,
    assigneeIds: [] as string[],
    valueStreamId: DEMO_VS_ID,
    artId: null,
    piId: null,
    wsjfBusinessValue: null,
    wsjfTimeCriticality: null,
    wsjfRiskReduction: null,
    wsjfJobSize: null,
    wsjfComputed: null,
    // Die Parser akzeptieren die flache Form — kein Versions-Umschlag nötig.
    benefitHypothesis: {
      measuresHypothesis: "Anteil digital abgeschlossener Vorgänge",
      changeFromBaseline: "Kunden erledigen Standardanliegen selbst statt über die Hotline.",
      businessOutcomes: [
        "Weniger Anrufe im Kundenservice",
        "Kürzere Bearbeitungszeit je Vorgang",
      ],
      leadingIndicators: ["Self-Service-Quote", "Wiederanrufquote"],
      risks: ["Akzeptanz bei älteren Kundengruppen"],
    },
    businessCase: {
      keyStakeholders: "Vertrieb, Kundenservice, IT-Betrieb",
      initiativeDescription: "Ablösung des bestehenden Portals durch eine neue Oberfläche.",
      businessOutcomeHypothesis: "Die Self-Service-Quote steigt von 38 % auf 60 %.",
      leadingIndicators: "Anteil abgeschlossener Self-Service-Vorgänge je Woche",
      inScope: "Antragsstrecke, Statusabfrage, Dokumentenabruf",
      outOfScope: "Vertragsänderungen, Beschwerdemanagement",
      recurringBenefit: 480000,
      oneTimeBenefit: 0,
      costSlices: [{ amount: 180000 }, { amount: 120000 }],
    },
    baselineBenefitHypothesis: null,
    baselineBusinessCase: null,
    timeline: null,
    selectedForDetailingAt: T0,
    hypothesisApprovedAt: T0,
    selectedForAnalyzingAt: null,
    businessCaseApprovedAt: null,
    implementationStartedAt: null,
    plannedStartAt: new Date("2026-04-01T00:00:00.000Z"),
    plannedEndAt: new Date("2026-09-30T00:00:00.000Z"),
    acceptanceCriteria: [] as string[],
    externalId: null,
    externalSystem: null,
    stageGate: "L2",
    status: "draft",
    completedAt: null,
    approvalPhase: "business_case",
    approvalRevision: 1,
    approvedBy: null,
    approvedAt: null,
    approvalComment: null,
    impactRecognizedAt: null,
    impactRecognizedBy: null,
    impactComment: null,
    epicType: null,
    investmentHorizon: null,
    featureType: null,
    needsSteeringAttention: false,
    stagedForBudgeting: false,
    createdAt: T0,
    createdBy: DEMO_USER,
    updatedAt: T0,
    updatedBy: DEMO_USER,
    deletedAt: null,
    valueStream: {
      id: DEMO_VS_ID,
      name: "Digital Banking",
      financeApproverId: null,
      vmoId: null,
    },
    children: [
      demoFeature({ id: "f1", title: "Antragsstrecke neu", status: "in_progress", wsjf: 3.2 }),
      demoFeature({ id: "f2", title: "Statusabfrage", status: "approved", wsjf: 2.4 }),
      demoFeature({ id: "f3", title: "Dokumentenabruf", status: "approved", wsjf: 1.8 }),
    ],
  } satisfies EpicDetailInputs["epic"];

  return {
    epic,
    historyEvents: [],
    kpis: [],
    approvals: [],
    pis: [],
    dependencies: [],
    budget: null,
    breakdownPositions: new Map(),
    enabled: { drumbeat: false, budgeting: false, risks: false },
    multiPartyApproval: true,
    principalId: DEMO_USER,
    // Durchgängig schreibgeschützt — siehe Kopfkommentar.
    canEdit: false,
    canDecideHypothesis: false,
    canSubmitHypothesis: false,
    canSubmitBusinessCase: false,
    canAssignOwner: false,
    gate: { disabled: true },
    canLinkDependency: false,
    showWsjf: true,
    canSetDelivery: false,
  };
}

/** Das fertige Read-Model der Beispielseite — über denselben Builder wie das Produkt. */
export function demoEpicDetailModel(): EpicDetailModel {
  return buildEpicDetailModel(demoEpicDetailInputs());
}
