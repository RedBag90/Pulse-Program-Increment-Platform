import type { PrismaClient } from "@/generated/prisma";
import type { EpicId, StageGate } from "@/modules/core/kernel/domain/types";
import type { Gated } from "@/modules/core/kernel/domain/gated";
import { currentGateStep, type GateStep } from "@/modules/work/domain/stage-gate";
import type { Principal } from "@/server/auth/principal";
import { authorize, hasCapability } from "@/server/auth/authorize";
import { getEpic } from "@/modules/work/server/services/epic";
import { loadBreakdownLayout } from "@/modules/work/server/services/breakdown-layout";
import { listInitiativeHistory, ACTIVITY_PAGE_SIZE } from "@/modules/core/kernel/server/initiative";
import { listKpis } from "@/modules/core/kpi/server/kpi";
import { getTenantPractices } from "@/server/services/target-model";
import { parseKpiMeasurements, latestKpiValue } from "@/modules/core/kpi/domain/kpi";
import {
  parseBenefitHypothesis,
  benefitHypothesisHasContent,
  type BenefitHypothesis,
  type BenefitHypothesisFields,
} from "@/modules/work/domain/benefit-hypothesis";
import {
  parseBusinessCase,
  businessCaseHasContent,
  computeBusinessCaseTotals,
  type BusinessCase,
  type BusinessCaseFields,
  type BusinessCaseTotals,
} from "@/modules/work/domain/business-case";
import { parseTimeline, type TimelineFields } from "@/modules/work/domain/timeline";
import { epicBenefitFromKpis, type EpicBenefit } from "@/modules/work/domain/epic-economics";
import {
  kpiAttainment,
  kpiFulfillmentMean,
  kpiPlanned,
} from "@/modules/core/kpi/domain/kpi-valuation";
import { subStageFor } from "@/modules/work/domain/stage-gate";
import { type GateReadiness, nextGate, previousGate } from "@/modules/work/domain/gate-readiness";
import { type ApprovalStatus, type Quorum } from "@/modules/work/domain/approval-primitives";
import {
  GATE_APPROVER_ROLE_KEYS,
  BUSINESS_CASE_PARTY_ROLES,
  allowsAdHocApprovers,
  isGateApproverRole,
  type GateApproverRole,
} from "@/modules/work/domain/gate-policy";
import type { GateTransitionStatus } from "@/modules/work/domain/gate-transition";
import {
  getOpenGateTransition,
  listGateTransitions,
  loadGateReadiness,
} from "@/modules/work/server/services/stage-gate-transition";
import { computeEpicRevisionVisibility } from "@/modules/work/domain/epic-revision-visibility";
import { epicNextStep, type EpicNextStep } from "@/modules/work/domain/epic-next-step";
import { fieldChanges, type FieldChangeContext } from "@/modules/work/domain/audit-field-changes";
import { EPIC_TYPE_KEYS, HORIZON_KEYS } from "@/modules/work/domain/portfolio-guardrails";
import { EPIC_CLASS_KEYS } from "@/modules/work/domain/pb-submission";

/**
 * Die Aufzählungs-Tabellen, die die Zeitleiste braucht — je Feld eine.
 *
 * Sie stehen hier und nicht in `audit-field-changes.ts`, damit die reine
 * Funktion nicht drei Domänen-Module importiert, um eine Karte zu füllen. Was
 * fehlt, zeigt keinen Wert; das ist die Regel aus G2.
 */
const EPIC_ENUM_KEYS: Record<string, Record<string, string>> = {
  epicType: EPIC_TYPE_KEYS,
  investmentHorizon: HORIZON_KEYS,
  intendedClass: EPIC_CLASS_KEYS,
};
import {
  epicLifecycleSteps,
  type LifecycleStep,
} from "@/modules/work/features/portfolio/lib/epic-lifecycle";
import type { ActivityItem } from "@/components/detail/initiative-activity-sidebar";
import type { KpiRow } from "@/modules/work/features/portfolio/components/epic-kpis-tab";
import type { BreakdownFeature } from "@/modules/work/features/portfolio/components/epic-breakdown-tab";

// ---------------------------------------------------------------------------
// Structural ports (ADR-0013 / P7) — the Drumbeat PI data, the Drumbeat
// dependency edges, and the Budgeting allocation enter ONLY through injected
// ports whose types are defined STRUCTURALLY here, so `@/modules/work/**` never
// imports `@/modules/drumbeat/**` or `@/modules/budgeting/**`. The composition
// root (the Epic route) supplies the adapters.
// ---------------------------------------------------------------------------

/** A Program Increment as the epic-detail read-model consumes it (page lines 258-276). */
export interface EpicPi {
  id: string;
  name: string;
  artId: string | null;
  startDate: Date | string;
}

/** Port: the PIs for the Epic's ARTs (Drumbeat). */
export type EpicPisPort = (artIds: string[]) => Promise<EpicPi[]>;

/**
 * A Feature-Feature dependency edge as the Breakdown tab consumes it (page lines
 * 149-189). Cross-Epic endpoints carry their parent Epic for the ghost-node
 * render. Structurally matches `EpicBreakdownTab`'s `dependencies` prop.
 */
export interface BreakdownEdge {
  id: string;
  fromId: string;
  toId: string;
  type: string;
  from: { id: string; title: string; parent: { id: string; title: string } | null } | null;
  to: { id: string; title: string; parent: { id: string; title: string } | null } | null;
}

/** Port: the dependency edges touching the Epic's Features (Drumbeat). */
export type EpicDependenciesPort = (featureIds: string[]) => Promise<BreakdownEdge[]>;

/**
 * **Habe ich Budget — und für wann?** Der Stand des Epics, vom Budgeting-Modul
 * fertig gefaltet hereingereicht.
 *
 * Die Form steht hier, nicht drüben: Work deklariert sie selbst (wie
 * `BreakdownEdge`) und importiert nichts aus Budgeting (ADR-0013).
 *
 * `state` unterscheidet, was ein blosses „Budget erhalten" verschweigt:
 * `applies` = das Geld gilt jetzt · `upcoming` = zugeteilt, der Rahmen gilt noch
 * nicht · `expired` = der Rahmen ist abgelaufen · `none` = kein Geld.
 */
export interface EpicBudgetStandingView {
  state: "applies" | "upcoming" | "expired" | "none";
  /** Betrag im angewandten Rahmen. */
  currentAmount: number;
  currentPeriod: { cycleKey: string; start: Date | null; end: Date | null } | null;
  /** Summe über alle Zyklen mit Geld. */
  totalAmount: number;
  cycleCount: number;
  span: { start: Date; end: Date } | null;
  /** Bei `upcoming`: ab wann der früheste noch nicht geltende Rahmen beginnt. */
  startsAt: Date | null;
  /** Die tragenden Zyklen einzeln — „wann wovon", nicht nur „wie viel". */
  periods: EpicBudgetPeriodView[];
}

/** Ein tragender Zyklus: Betrag und Geltungsdaten. */
export interface EpicBudgetPeriodView {
  cycleKey: string;
  amount: number;
  start: Date | null;
  end: Date | null;
  applies: boolean;
}

/**
 * Wie weit die Zuteilung dieses Epics gediehen ist.
 *
 * Das **Etikett reist mit**, statt in Work zweitgeschrieben zu werden: die
 * Wörter „Nicht begonnen" · „Gebunden" · „Verbraucht" gehören Budgeting, und
 * die ART-Budgetseite zeigt sie für dasselbe Epic. Zwei Fassungen desselben
 * Vokabulars wären zwei Fassungen, die auseinanderlaufen.
 */
export interface EpicAllocationStateView {
  key: string;
  label: string;
}

/**
 * Die Reifegrad-Fakten, die Budgeting über dieses Epic braucht.
 *
 * Sie gehen **hinein**, damit die Regeln drüben bleiben: ab wann ein Epic Geld
 * halten darf (`FIRST_FUNDABLE_STEP`) und ob sein Geld gebunden oder verbraucht
 * ist, entscheidet Budgeting. Work reicht Fakten und fragt — es baut die Regeln
 * nicht nach.
 */
export interface EpicBudgetFacts {
  step: GateStep;
  stageGate: string;
  implementationCompletedAt: Date | null;
}

/**
 * Port: the Epic's budget allocation (Budgeting), or null when none exists.
 *
 * `allocatedByPeriod` = per-half-year €-map, consumed by the cost-over-time calc.
 */
export interface EpicBudgetPortResult {
  allocatedSum: number;
  allocatedByPeriod: Record<string, number>;
  standing: EpicBudgetStandingView;
  allocationState: EpicAllocationStateView | null;
  /** `may` = darf dieses Epic schon Geld halten; `firstStep` = ab welchem Schritt. */
  fundable: { may: boolean; firstStep: string };
}

export type EpicBudgetPort = (facts: EpicBudgetFacts) => Promise<EpicBudgetPortResult | null>;

/**
 * Port: die Einordnung dieses Epics — Portfolio-Epic oder ART-Epic.
 *
 * **Warum ein Port und kein Import.** Die Antwort braucht den Schwellenwert aus
 * den Guardrails und, bei einem ART-Epic, den Blick in den ART-Rahmen
 * (`RunTheBusinessItem`) — eine Budgeting-Tabelle. Work importiert nichts aus
 * Budgeting (ADR-0013), also stellt die Route die Antwort zusammen und Work
 * besitzt nur ihre **Gestalt**. Genau wie beim Budget daneben.
 *
 * `null` heisst: die Practice `artEpics` ist aus — dann gibt es die
 * Unterscheidung nicht, und die Scheibe meldet `disabled`.
 */
export interface EpicClassificationPortResult {
  /** Die **entschiedene** Klasse; `null`, solange der Business Case nicht freigegeben ist. */
  epicClass: "portfolio" | "art" | null;
  /**
   * Die Klasse, die der **Entwurf** ergäbe — `null` ohne eingetragene Kosten.
   *
   * Nur für den Hinweis vor dem L2-Antrag. Sie entscheidet nichts und darf in
   * keinen Budgeting-Weg geraten; siehe `provisionalEpicClass`.
   */
  provisional: "portfolio" | "art" | null;
  /** Die Kosten aus dem **Entwurf** — dieselbe Summe, die `provisional` erzeugt hat. */
  provisionalCost: number | null;
  /** Die Kosten, aus denen sie entstand; `null` ohne Freigabe. */
  cost: number | null;
  /** Die Portfolio-Schwelle dieses Wertstroms. */
  threshold: number;
  /** Per `portfolioOverrideAt` von Hand auf Portfolio gesetzt. */
  overridden: boolean;
  /** Woher der Schwellenwert stammt (Wertstrom oder Mandant). */
  source: string;
  /** Die **erwartete** Klasse aus dem Anlege-Dialog. Vor L2 ist sie alles, was es gibt. */
  intended: "portfolio" | "art" | null;
  /** Ein ART-Epic ohne ART oder ohne aktiven Rahmen hat keinen Geldweg. */
  fundingGap: "noArt" | "noPot" | null;
  valueStreamId: string | null;
}

export type EpicClassificationPort = () => Promise<EpicClassificationPortResult | null>;

export interface EpicDetailPorts {
  pis: EpicPisPort;
  dependencies: EpicDependenciesPort;
  budget: EpicBudgetPort;
  classification: EpicClassificationPort;
}

// ---------------------------------------------------------------------------
// Explicit degradation — Drumbeat, Budgeting, Risks, die Reifegrad-Achse und
// die Einordnung sind optional. Ist eine Fähigkeit aus, liefert der Lader
// leere Port-Ergebnisse UND der Erbauer `{ disabled: true }` — nie eine
// Scheibe mit `disabled: false` und leerem Inhalt.
//
// Die Regel steht seit September 2026 nicht mehr nur hier, sondern als Typ:
// `Gated<T>` (`kernel/domain/gated.ts`). Sie ist zweimal gebrochen worden,
// beide Male, weil `T | null` „abwesend" und „leer" nicht unterscheidet; der
// Docblock dort nennt beide Fälle.
// ---------------------------------------------------------------------------

/**
 * **Was an dieser Seite wirklich Drumbeat ist: die Program Increments.**
 *
 * Die Abhängigkeiten standen bis September 2026 hier drin und sind daran
 * gescheitert. `dependency.` ist mit dem Netzplan im Epic nach **Work**
 * gewandert (`kernel/domain/modules.ts`) — der Schreibweg ging danach durch die
 * Modul-Schranke, der Leseweg hing weiter an dieser Scheibe. Ein Mandant mit
 * Work ohne Drumbeat legte eine Kante an, bekam die Bestätigung, und der
 * nächste `router.refresh()` lieferte `[]` zurück: die Kante war geschrieben
 * und wurde weggelesen.
 *
 * Deshalb steht `dependencies` jetzt im Modell selbst. Ein Program Increment
 * *ist* Drumbeat; eine Abhängigkeit zwischen zwei Features eines Epics ist es
 * seit dem Umzug nicht mehr.
 */
export type DrumbeatSlice = Gated<{
  pisByArt: Record<string, { id: string; name: string }[]>;
  breakdownPis: { id: string; name: string; startDate: string }[];
}>;

export type BudgetingSlice = Gated<{
  allocated: boolean;
  allocatedByPeriod: Record<string, number>;
  /** Der Stand für das Budget-Panel im Overview: Betrag, Zeitraum, Zustand. */
  standing: EpicBudgetStandingView;
  /** „Nicht begonnen" · „Gebunden" · „Verbraucht"; `null` ohne Zuteilung. */
  allocationState: EpicAllocationStateView | null;
  /** Vor `firstStep` kann dieses Epic gar kein Geld halten — das erklärt ein
   *  leeres Budget, statt es nur zu melden. */
  fundable: { may: boolean; firstStep: string };
}>;

/** Risks is composed in the Epic route (composition root) off the full risks
 *  model; Work only carries the entitlement gate. Kein `Gated`, weil die
 *  Scheibe gar keinen Inhalt trägt — es gibt nichts, was „leer" heissen
 *  könnte. */
export type RisksSlice = { disabled: boolean };

/**
 * **Die Einordnung: Portfolio-Epic oder ART-Epic.**
 *
 * Eine `Gated`-Scheibe, und das ist der ganze Punkt. Bis September 2026 stand
 * hier `X | null`, zusammengebaut in der Route statt in der Lesesicht — und
 * weil das Auswahlfeld **vor** der Practice-Bedingung stand und seine
 * Lesestelle dahinter, machte `classification?.intended ?? null` aus „die
 * Practice ist aus" ein „noch nicht eingeordnet". Gespeichert wurde,
 * angezeigt nicht. Siehe {@link Gated}.
 */
export type ClassificationSlice = Gated<EpicClassificationPortResult>;

// ---------------------------------------------------------------------------
// Inputs — the plain-data bag the loader hands the pure builder.
// ---------------------------------------------------------------------------

/** The Epic aggregate as loaded by `getEpic` (non-null). */
export type LoadedEpic = NonNullable<Awaited<ReturnType<typeof getEpic>>>;

export interface EpicDetailInputs {
  epic: LoadedEpic;
  historyEvents: Awaited<ReturnType<typeof listInitiativeHistory>>;
  kpis: Awaited<ReturnType<typeof listKpis>>;
  /** Port result — empty when `enabled.drumbeat` is false. */
  pis: EpicPi[];
  /** Port result — **immer** geladen; siehe {@link DrumbeatSlice}. */
  dependencies: BreakdownEdge[];
  /** Port result — null when `enabled.budgeting` is false. */
  budget: EpicBudgetPortResult | null;
  /** Port result — null, wenn die Practice `artEpics` aus ist. */
  classification: EpicClassificationPortResult | null;
  /** Persisted breakdown-network node positions (Work-owned, always loaded). */
  breakdownPositions: Map<string, { x: number; y: number }>;
  enabled: { drumbeat: boolean; budgeting: boolean; risks: boolean };
  /**
   * `practices.multiPartyApproval` — an ⇒ die fünf Business-Case-Parteien
   * besetzen den Schritt L2 → L3.1, aus ⇒ der VMO allein.
   */
  multiPartyApproval: boolean;
  /** `practices.wsjf` — blendet die WSJF-Spalte der Deliverables-Tabelle aus. */
  showWsjf: boolean;
  /** The viewing principal's id — drives the sign-off / open-approval checks. */
  principalId: string;
  // Capability booleans (resolved in the loader; the builder never authorizes).
  canEdit: boolean;
  canAssignOwner: boolean;
  canLinkDependency: boolean;
  /**
   * `epic.portfolio_override` — die **zusätzliche** Hürde für den mit der
   * Business-Case-Freigabe eingefrorenen Horizont. Vor dem Einfrieren genügt
   * `canEdit`; danach gehört der Wert einer Abnahme durch fünf Parteien.
   */
  canOverrideHorizon: boolean;
  /** Alles zum Reifegrad-Wechsel, vom Loader aufgelöst (siehe {@link EpicGateSlice}). */
  gate: EpicGateSlice;
  /**
   * `feature.delivery.set` — steuert nur, ob die Status-Zelle der
   * Deliverables-Tabelle ein Dropdown zeigt. Die Server-Action autorisiert
   * ohnehin erneut; `canEdit` (= `epic.update`) reicht dafür nicht, weil der
   * Lieferstatus ART-scoped am Feature hängt.
   */
  canSetDelivery: boolean;
  /**
   * `feature.delete`, **je ART aufgeloest**. Als Praedikat statt als Boolean,
   * weil die Features eines Epics in verschiedenen ARTs liegen koennen und das
   * Recht `art`-scoped ist — ein einzelnes Flag traefe die falsche Aussage fuer
   * einen Teil der Zeilen. Der Builder autorisiert nach wie vor nicht; er ruft
   * nur, was der Loader aufgeloest hat.
   */
  canDeleteFeature: (artId: string) => boolean;
}

// ---------------------------------------------------------------------------
// Output — the render-ready DTO the Epic detail page consumes. Field names
// mirror the page's locals so the later cutover is mechanical.
// ---------------------------------------------------------------------------

export interface EpicDetailModel {
  // Raw aggregates the page's child components still consume directly (exposed so
  // the route renders off the model alone and never re-queries what the loader
  // already fetched).
  epic: LoadedEpic;
  kpis: EpicDetailInputs["kpis"];
  multiPartyApproval: boolean;
  /** `practices.wsjf` — Sichtbarkeit der WSJF-Spalte. */
  showWsjf: boolean;
  /** `feature.delivery.set` — Status-Dropdown in der Deliverables-Tabelle. */
  canSetDelivery: boolean;

  breakdownFeatures: BreakdownFeature[];
  /**
   * Die Kanten zwischen den Kind-Features — **ohne Modul-Vorbehalt**, seit
   * `dependency.` zu Work gehört. Siehe {@link DrumbeatSlice}.
   */
  dependencies: BreakdownEdge[];
  artIds: string[];
  featureIds: string[];
  /** Work-owned persisted network positions (always present). */
  breakdownLayoutPositions: Record<string, { x: number; y: number }>;

  drumbeat: DrumbeatSlice;
  budgeting: BudgetingSlice;
  risks: RisksSlice;
  classification: ClassificationSlice;

  activityEvents: ActivityItem[];
  /** `true` ⇒ es gibt aeltere Ereignisse, die diese Seite nicht zeigt. */
  activityTruncated: boolean;

  kpiRows: KpiRow[];
  kpiBenefit: EpicBenefit;

  benefitHypothesis: BenefitHypothesis;
  businessCase: BusinessCase;
  timeline: TimelineFields;

  heroTotals: BusinessCaseTotals;
  heroKpiAvgPct: number | null;

  bcBaseline: BusinessCaseFields | null;
  hypoBaseline: BenefitHypothesisFields | null;
  bcEditable: boolean;
  hypoEditable: boolean;

  hypoLockReason: string | undefined;
  bcLockReason: string | undefined;

  showHypoReviewDiff: boolean;
  showBcReviewDiff: boolean;
  showHypoOwnerEdit: boolean;
  showBcOwnerEdit: boolean;

  childStats: { total: number; completed: number };
  subStage: ReturnType<typeof subStageFor>;
  nextStep: EpicNextStep | null;
  lifecycleSteps: LifecycleStep[];

  /**
   * Der Reifegrad-Wechsel als eine Slice — Antrag, Abnehmer, Reife, Rechte.
   * Ersetzt die früheren Einzelfelder `proposedStageGate`,
   * `canConfirmProposedAdvance`, `canConfirmImpact` und `canAdvance`, die vier
   * Aspekte desselben Vorgangs an vier Stellen verstreut hatten.
   */
  gate: EpicGateSlice;

  // Capability booleans — the page JSX consumes these directly.
  canEdit: boolean;
  canAssignOwner: boolean;
  canLinkDependency: boolean;
  /** `epic.portfolio_override` — s. {@link EpicDetailModel.canOverrideHorizon}. */
  canOverrideHorizon: boolean;
}

// ---------------------------------------------------------------------------
// Reifegrad-Slice
// ---------------------------------------------------------------------------

/** Eine namentliche Abnahme, render-fertig. */
export interface EpicGateApproverView {
  id: string;
  userId: string;
  /** Anzeige-Rolle ("Finance", "VMO", …) oder null bei direkt benannten Personen. */
  roleLabelKey: string | null;
  status: ApprovalStatus;
  decidedAt: string | null;
  comment: string | null;
}

export interface EpicGateRequestView {
  id: string;
  fromGate: GateStep;
  toGate: GateStep;
  quorum: Quorum;
  requestedBy: string;
  requestedAt: string;
  reason: string | null;
  approvers: EpicGateApproverView[];
  /** Wer noch nicht entschieden hat. */
  pendingUserIds: string[];
}

/**
 * Die Parteien, die den nächsten Schritt besetzen müssen, plus die
 * Vorbelegung aus der Wertstrom-Governance.
 *
 * Nur belegt, wo der Schritt eine Besetzung je Epic zulässt — heute L2 → L3.1,
 * wo die fünf Business-Case-Parteien zeichnen. Wer für MGMT, den Business Owner
 * oder den IRT-Owner *dieses* Epics steht, ist keine Wertstrom-Regel; genau das
 * hat vorher der Approver-Dialog des Business Case erfasst.
 */
export interface GatePartyStaffing {
  roles: { role: GateApproverRole; labelKey: string }[];
  /** Rolle → vorbelegte userIds (Finance und LACE/VMO aus dem Wertstrom). */
  defaults: Record<string, string[]>;
}

export interface EpicGateHistoryView {
  id: string;
  fromGate: GateStep;
  toGate: GateStep;
  kind: "forward" | "revert";
  status: GateTransitionStatus;
  requestedBy: string;
  requestedAt: string;
  resolvedAt: string | null;
  reason: string | null;
}

/**
 * Die Reifegrad-Achse eines Epics. Discriminated auf `disabled`, wie die
 * Modul-Slices: ist die Stage-Gate-Practice im Zielbild aus, gibt es die Achse
 * nicht, und die UI rendert gar nichts statt leerer Zustände.
 */
export type EpicGateSlice = Gated<{
  /** Der aktuelle Schritt — innerhalb L4 ggf. bereits „L4.2". */
  current: GateStep;
  /** Der nächste Schritt, oder null am Endschritt L5. */
  next: GateStep | null;
  /** Kriterien-Checkliste für `current → next`; null am Endgate. */
  readiness: GateReadiness | null;
  openRequest: EpicGateRequestView | null;
  history: EpicGateHistoryView[];
  canRequest: boolean;
  canWithdraw: boolean;
  canRevert: boolean;
  /** Der Betrachter ist selbst ein noch offener Abnehmer. */
  viewerMustDecide: boolean;
  /** „I need help" ist gesetzt (Owner bittet um Unterstützung). */
  helpRequested: boolean;
  /** Der Betrachter darf die Bitte setzen/zurücknehmen (= ist der Epic-Owner). */
  canRequestHelp: boolean;
  /** Besetzung je Partei am Antrag; null, wo der Schritt keine zulässt. */
  partyStaffing: GatePartyStaffing | null;
}>;

/** Pull the free-text comment out of an audit event's `changes` diff, if any.
 *  Hypothesis approve/reject and the legacy stage-gate write it as
 *  `changes.comment.after`. (page lines 78-81) */
function auditComment(changes: unknown): string | undefined {
  const after = (changes as { comment?: { after?: unknown } } | null)?.comment?.after;
  return typeof after === "string" && after.trim() !== "" ? after : undefined;
}

// ---------------------------------------------------------------------------
// Builder — pure. No I/O. This is the test surface.
// ---------------------------------------------------------------------------

/**
 * Turns the loaded Epic aggregate + resolved capabilities into the render-ready
 * Epic-detail DTO. The derivation is moved verbatim from the page (lines
 * 83-463); the loader resolves the capability booleans and awaits the ports so
 * this stays a pure function testable against in-memory fixtures.
 */
export function buildEpicDetailModel(inputs: EpicDetailInputs): EpicDetailModel {
  const {
    epic,
    historyEvents,
    kpis,
    pis,
    dependencies,
    budget,
    classification,
    enabled,
    multiPartyApproval,
    showWsjf,
    principalId,
    canEdit,
    canAssignOwner,
    canLinkDependency,
    canOverrideHorizon,
    canSetDelivery,
    canDeleteFeature,
    gate,
  } = inputs;

  /** Der offene Reifegrad-Antrag, sofern die Reifegrad-Achse aktiv ist. */
  const gateOpenRequest = gate.disabled ? null : gate.openRequest;

  const breakdownFeatures: BreakdownFeature[] = epic.children.map((c) => ({
    id: c.id,
    title: c.title,
    status: c.status,
    description: c.description ?? "",
    artId: c.artId ?? "",
    artName: c.art?.name ?? "—",
    piId: c.piId,
    piName: c.pi?.name ?? null,
    createdAtMs: c.createdAt.getTime(),
    acceptanceCriteria: c.acceptanceCriteria,
    wsjf: {
      bv: c.wsjfBusinessValue ?? 0,
      tc: c.wsjfTimeCriticality ?? 0,
      rr: c.wsjfRiskReduction ?? 0,
      js: c.wsjfJobSize ?? 0,
      computed: Number(c.wsjfComputed ?? 0),
    },
    featureType: c.featureType,
    canDelete: canDeleteFeature(c.artId ?? ""),
  }));
  const artIds = [...new Set(breakdownFeatures.map((f) => f.artId).filter(Boolean))];
  const featureIds = breakdownFeatures.map((f) => f.id);

  const breakdownLayoutPositions: Record<string, { x: number; y: number }> = {};
  for (const [k, v] of inputs.breakdownPositions) breakdownLayoutPositions[k] = v;

  // Budgeting slice — `allocated` = Σ allocations > 0 (page lines 196-202).
  const budgetingSlice: BudgetingSlice = enabled.budgeting
    ? {
        disabled: false,
        allocated: (budget?.allocatedSum ?? 0) > 0,
        allocatedByPeriod: budget?.allocatedByPeriod ?? {},
        standing: budget?.standing ?? {
          state: "none",
          currentAmount: 0,
          currentPeriod: null,
          totalAmount: 0,
          cycleCount: 0,
          span: null,
          startsAt: null,
          periods: [],
        },
        allocationState: budget?.allocationState ?? null,
        // Ohne Port-Antwort ist „darf Geld halten" unbekannt — dann lieber
        // nichts behaupten als ein „nein" erfinden.
        fundable: budget?.fundable ?? { may: true, firstStep: "" },
      }
    : { disabled: true };
  const budgetAllocated = budgetingSlice.disabled ? false : budgetingSlice.allocated;

  // Risks slice — entitlement gate only; the tab content is composed in the route.
  const risksSlice: RisksSlice = { disabled: !enabled.risks };

  // Einordnungs-Scheibe. Der Port antwortet `null`, wenn die Practice aus ist;
  // daraus wird `{ disabled: true }` — **nicht** eine Scheibe mit leeren
  // Feldern. Wer sie rendert, muss den Fall behandeln, sonst kompiliert es
  // nicht. Genau das war die Lücke.
  const classificationSlice: ClassificationSlice = classification
    ? { disabled: false, ...classification }
    : { disabled: true };

  // Drumbeat slice — die PI-Gruppierungen. Die Kanten stehen daneben im Modell.
  let drumbeatSlice: DrumbeatSlice;
  if (enabled.drumbeat) {
    const pisByArt: Record<string, { id: string; name: string }[]> = {};
    for (const pi of pis) {
      if (!pi.artId) continue;
      (pisByArt[pi.artId] ??= []).push({ id: pi.id, name: pi.name });
    }
    // Flat-distinct PI list for the network-plan PI-mode: sorted by startDate
    // ascending, deduplicated by id.
    const breakdownPis = (() => {
      const m = new Map<string, { id: string; name: string; startDate: string }>();
      for (const pi of pis) {
        if (m.has(pi.id)) continue;
        m.set(pi.id, {
          id: pi.id,
          name: pi.name,
          startDate:
            pi.startDate instanceof Date ? pi.startDate.toISOString() : String(pi.startDate),
        });
      }
      return [...m.values()].sort((a, b) => (a.startDate < b.startDate ? -1 : 1));
    })();
    drumbeatSlice = { disabled: false, pisByArt, breakdownPis };
  } else {
    drumbeatSlice = { disabled: true };
  }

  // The right-hand activity feed merges audit events and approval comments into
  // one stream, newest-first (page lines 282-307).
  const activityTruncated = historyEvents.length > ACTIVITY_PAGE_SIZE;

  /**
   * **Die Namen, die eine Id lesbar machen** — und nur die, die ohnehin geladen
   * sind: der Wertstrom, das ART und die Solutions des Epics, dazu die ARTs
   * seiner Kind-Features.
   *
   * Eine Id, die hier fehlt, zeigt **keinen Wert** — die Zeile sagt dann nur,
   * *dass* sich der Wertstrom geändert hat. Das trifft alte Einträge, die auf
   * einen Wertstrom zeigen, in dem das Epic längst nicht mehr liegt. Sie
   * nachzuladen hiesse, für eine Zeitleiste beliebig viele Namen aufzulösen;
   * eine UUID auf dem Bildschirm wäre der schlechtere Handel.
   */
  const namen = new Map<string, string>();
  if (epic.valueStream) namen.set(epic.valueStream.id, epic.valueStream.name);
  if (epic.art) namen.set(epic.art.id, epic.art.name);
  for (const link of epic.solutionLinks) namen.set(link.solution.id, link.solution.name);
  for (const c of epic.children) if (c.art) namen.set(c.art.id, c.art.name);

  const changeCtx: FieldChangeContext = {
    nameOf: (id) => namen.get(id) ?? null,
    enumKey: (field, value) => EPIC_ENUM_KEYS[field]?.[value] ?? null,
    // Das Read-Model reicht ISO durch; die Oberfläche formatiert in der
    // Sprache des Lesers, wie überall sonst auch.
    formatDay: (iso) => iso.slice(0, 10),
  };

  const auditItems: ActivityItem[] = historyEvents.slice(0, ACTIVITY_PAGE_SIZE).map((e) => ({
    id: e.id,
    action: e.action,
    occurredAt: e.occurredAt.toISOString(),
    actorId: e.actorId,
    comment: auditComment(e.changes),
    changes: fieldChanges(e.changes, changeCtx),
  }));

  // Die Kommentare der Abnehmer stecken jetzt im Audit-Strom: jede
  // Gate-Entscheidung schreibt ihren Kommentar als `changes.comment.after`,
  // den `auditComment` oben herauszieht. Ein zweiter Zweig entfällt.
  const activityEvents: ActivityItem[] = [...auditItems].sort((x, y) =>
    x.occurredAt < y.occurredAt ? 1 : -1,
  );

  const kpiRows: KpiRow[] = kpis.map((k) => {
    const baseline = k.baseline === null ? null : Number(k.baseline);
    const target = k.target === null ? null : Number(k.target);
    const latest = latestKpiValue(parseKpiMeasurements(k.measurements));
    const valuePerUnit = k.valuePerUnit === null ? null : Number(k.valuePerUnit);
    return {
      id: k.id,
      name: k.name,
      unit: k.unit,
      baseline,
      target,
      latest,
      weight: k.benefitWeight === null ? null : Number(k.benefitWeight),
      valuePerUnit,
      benefitKind: k.benefitKind,
      recurringInterval: k.recurringInterval,
      calculationNote: k.calculationNote,
      measurements: parseKpiMeasurements(k.measurements),
      // Precomputed in the read-model so the KPIs tab renders instead of
      // recomputing the attainment / €-total math client-side.
      attainment: kpiAttainment({ baseline, target, current: latest }),
      // `kpiPlanned` statt `kpiPlannedAtTarget`: **eine** Bewertungsfunktion
      // fuer alle Flaechen. Beide rechnen `|Ziel − Baseline| × €/Einheit`,
      // aber nur `kpiPlanned` annualisiert einen monatlich wiederkehrenden
      // Nutzen. Vorher zeigte der KPI-Reiter denselben KPI um Faktor 12
      // niedriger als Rechen-Reiter und Overview — heute nicht sichtbar, weil
      // `recurringInterval` ueber keine Oberflaeche setzbar ist, aber die
      // Luecke schnappt zu, sobald sie es wird.
      plannedTotal:
        valuePerUnit == null || baseline == null || target == null
          ? null
          : kpiPlanned({
              baseline,
              target,
              valuePerUnit,
              benefitKind: k.benefitKind,
              recurringInterval: k.recurringInterval,
            }),
    };
  });

  const kpiBenefit = epicBenefitFromKpis(kpiRows);

  const benefitHypothesis = parseBenefitHypothesis(epic.benefitHypothesis);
  const businessCase = parseBusinessCase(epic.businessCase);
  const timeline = parseTimeline(epic.timeline);

  const heroTotals = computeBusinessCaseTotals(businessCase.current, kpiBenefit);
  const heroKpiMean = kpiFulfillmentMean(
    kpiRows.map((k) => ({ baseline: k.baseline, target: k.target, current: k.latest })),
  );
  const heroKpiAvgPct = heroKpiMean == null ? null : Math.round(heroKpiMean * 100);

  const bcBaseline =
    epic.baselineBusinessCase != null ? parseBusinessCase(epic.baselineBusinessCase).current : null;
  const hypoBaseline =
    epic.baselineBenefitHypothesis != null
      ? parseBenefitHypothesis(epic.baselineBenefitHypothesis).current
      : null;
  // Sperr- und Diff-Algebra — beide Texte folgen jetzt dem Reifegrad-Antrag,
  // der sie trägt: L0 → L1 die Hypothese, L2 → L3.1 den Business Case.
  const {
    bcEditable,
    hypoEditable,
    hypoLockReason,
    bcLockReason,
    showHypoReviewDiff,
    showBcReviewDiff,
    showHypoOwnerEdit,
    showBcOwnerEdit,
  } = computeEpicRevisionVisibility({
    stageGate: epic.stageGate as StageGate,
    openGateRequestTo: gateOpenRequest?.toGate ?? null,
    viewerIsGateApprover: gateOpenRequest?.pendingUserIds.includes(principalId) ?? false,
    hasHypoBaseline: hypoBaseline != null,
    hasBcBaseline: bcBaseline != null,
    canEdit,
  });

  const childStats = {
    total: epic.children.length,
    completed: epic.children.filter((c) => c.status === "completed").length,
  };
  const subStage = subStageFor({
    stageGate: epic.stageGate as StageGate,
    implementationCompletedAt: epic.implementationCompletedAt,
  });
  const nextStep = epicNextStep({
    epicId: epic.id,
    stageGate: epic.stageGate as StageGate,
    subStage,
    openGateRequestTo: gateOpenRequest?.toGate ?? null,
    hasHypothesis: benefitHypothesisHasContent(benefitHypothesis.current),
    hasBusinessCase: businessCaseHasContent(businessCase.current),
    budgetAllocated,
    budgetingEnabled: enabled.budgeting,
    selectedForAnalyzingAt: epic.selectedForAnalyzingAt,
    impactRecognizedAt: epic.impactRecognizedAt,
    childFeatureStats: childStats,
  });

  // Same axis as `epicNextStep` above → the highlighted tile always matches the
  // embedded "Nächster Schritt" (never diverges from milestone timestamps).
  const lifecycleSteps = epicLifecycleSteps({
    stageGate: epic.stageGate as StageGate,
    subStage,
    impactRecognizedAt: epic.impactRecognizedAt,
    // Zwei Meilensteine bewegen den Reifegrad nicht — die Erstsichtung auf L0
    // und die Analyse-Entscheidung auf L1. Auf ihrem jeweiligen Grad sind diese
    // Stempel die einzige Auskunft darueber, ob sie schon waren.
    selectedForDetailingAt: epic.selectedForDetailingAt,
    selectedForAnalyzingAt: epic.selectedForAnalyzingAt,
  });

  return {
    epic,
    showWsjf,
    canSetDelivery,
    kpis,
    multiPartyApproval,
    breakdownFeatures,
    dependencies,
    artIds,
    featureIds,
    breakdownLayoutPositions,
    drumbeat: drumbeatSlice,
    budgeting: budgetingSlice,
    risks: risksSlice,
    classification: classificationSlice,
    activityEvents,
    activityTruncated,
    kpiRows,
    kpiBenefit,
    benefitHypothesis,
    businessCase,
    timeline,
    heroTotals,
    heroKpiAvgPct,
    bcBaseline,
    hypoBaseline,
    bcEditable,
    hypoEditable,
    hypoLockReason,
    bcLockReason,
    showHypoReviewDiff,
    showBcReviewDiff,
    showHypoOwnerEdit,
    showBcOwnerEdit,
    childStats,
    subStage,
    nextStep,
    lifecycleSteps,
    gate,
    canEdit,
    canAssignOwner,
    canLinkDependency,
    canOverrideHorizon,
  };
}

// ---------------------------------------------------------------------------
// Loader — impure. Resolves the Epic aggregate, the tenant practices, the
// capability booleans, and the three ports. No reshape/derivation (the builder
// owns that). Returns null when the Epic is not found (the page handles the
// redirect separately).
// ---------------------------------------------------------------------------

export async function loadEpicDetailInputs(
  db: PrismaClient,
  principal: Principal,
  epicId: EpicId,
  ports: EpicDetailPorts,
  enabled: { drumbeat: boolean; budgeting: boolean; risks: boolean },
): Promise<EpicDetailInputs | null> {
  const epic = await getEpic(db, principal.tenantId, epicId);
  if (!epic) return null;

  // Port inputs — the distinct ARTs and the child-Feature ids (page 117/119).
  const artIds = [...new Set(epic.children.map((c) => c.artId ?? "").filter(Boolean))];
  const featureIds = epic.children.map((c) => c.id);

  // Capability booleans — resolved exactly as the page does (lines 94-256).
  const canEdit = hasCapability(principal, "epic.update", {
    tenantId: principal.tenantId,
    valueStreamId: epic.valueStreamId,
  });
  const canAssignOwner = authorize(
    "epic.owner.assign",
    { tenantId: principal.tenantId, valueStreamId: epic.valueStreamId },
    principal,
  ).allow;
  const canLinkDependency = hasCapability(principal, "dependency.link", {
    tenantId: principal.tenantId,
  });
  const canOverrideHorizon = hasCapability(principal, "epic.portfolio_override", {
    tenantId: principal.tenantId,
    valueStreamId: epic.valueStreamId,
  });

  const gateScope = { tenantId: principal.tenantId, valueStreamId: epic.valueStreamId };
  const gateCaps = {
    request: authorize("epic.gate.request", gateScope, principal).allow,
    withdraw: authorize("epic.gate.withdraw", gateScope, principal).allow,
    revert: authorize("epic.gate.revert", gateScope, principal).allow,
  };
  const current = currentGateStep({
    stageGate: epic.stageGate as StageGate,
    selectedForAnalyzingAt: epic.selectedForAnalyzingAt,
    implementationCompletedAt: epic.implementationCompletedAt,
  });
  const to = nextGate(current);

  const [
    historyEvents,
    kpis,
    practices,
    breakdownPositions,
    pis,
    dependencies,
    budget,
    openRequest,
    gateHistory,
    readiness,
  ] = await Promise.all([
    // Eins mehr als angezeigt: nur so laesst sich der Deckel exakt melden,
    // statt ihn zu erraten (genau 50 Ereignisse sind nicht abgeschnitten).
    listInitiativeHistory(db, principal.tenantId, epic.id, ACTIVITY_PAGE_SIZE + 1),
    listKpis(db, principal.tenantId, epic.id as EpicId),
    getTenantPractices(db, principal.tenantId),
    loadBreakdownLayout(db, principal.tenantId, epic.id as EpicId),
    enabled.drumbeat ? ports.pis(artIds) : Promise.resolve([] as EpicPi[]),
    // Ohne Drumbeat-Vorbehalt — `dependency.` gehört zu Work. Stand er hier,
    // war die eben angelegte Kante beim nächsten Lesen wieder weg.
    ports.dependencies(featureIds),
    // `current` steht oben schon fest; die beiden Stempel liegen am Epic.
    enabled.budgeting
      ? ports.budget({
          step: current,
          stageGate: epic.stageGate,
          implementationCompletedAt: epic.implementationCompletedAt,
        })
      : Promise.resolve(null),
    getOpenGateTransition(db, principal.tenantId, epic.id),
    listGateTransitions(db, principal.tenantId, epic.id),
    to
      ? loadGateReadiness(db, principal.tenantId, epic.id, to, enabled.budgeting, enabled.drumbeat)
      : Promise.resolve(null),
  ]);

  /**
   * Die Einordnung, **nach** der Welle — `practices` entsteht in ihr, und die
   * Practice entscheidet, ob überhaupt gefragt wird. Eine Rundreise mehr, aber
   * nur dort, wo die Unterscheidung läuft; sie stur mitzuladen hiesse, die
   * Guardrails auch für Mandanten zu lesen, die sie nicht führen.
   *
   * Die Bedingung steht **hier**, damit sie neben den anderen `enabled`-Toren
   * liegt und nicht in der Route verstreut ist. Der Port antwortet nur.
   */
  const classification = practices.artEpics ? await ports.classification() : null;

  const gate = buildGateSlice({
    stageGatesEnabled: practices.stageGates,
    current,
    next: to,
    readiness,
    openRequest,
    history: gateHistory,
    caps: gateCaps,
    principalId: principal.id,
    ownerId: epic.ownerId,
    helpRequestedAt: epic.helpRequestedAt,
    partyStaffing:
      to && allowsAdHocApprovers(to) && practices.multiPartyApproval
        ? {
            roles: BUSINESS_CASE_PARTY_ROLES.map((role) => ({
              role,
              labelKey: GATE_APPROVER_ROLE_KEYS[role],
            })),
            // **Vier** der fünf Parteien haben eine Governance-Spalte am
            // Wertstrom und werden daraus vorbelegt; nur den IRT-Owner benennt
            // der Antragsteller. Vorbelegt heißt vorbelegt: der Picker schlägt
            // sie. Bis September 2026 waren es drei — an der Stelle des
            // Architekten stand MGMT, und das hatte gar keine Spalte.
            defaults: {
              ...(epic.valueStream?.architectLeadId && {
                "epic.party.architect": [epic.valueStream.architectLeadId],
              }),
              ...(epic.valueStream?.financeApproverId && {
                "epic.party.finance": [epic.valueStream.financeApproverId],
              }),
              ...(epic.valueStream?.vmoId && {
                "epic.party.lace_vmo": [epic.valueStream.vmoId],
              }),
              ...(epic.valueStream?.businessOwnerId && {
                "epic.party.business_owner": [epic.valueStream.businessOwnerId],
              }),
            },
          }
        : null,
  });

  return {
    epic,
    historyEvents,
    kpis,
    pis,
    dependencies,
    budget,
    classification,
    breakdownPositions,
    enabled,
    multiPartyApproval: practices.multiPartyApproval,
    showWsjf: practices.wsjf,
    // Der Lieferstatus haengt ART-scoped am Feature, nicht am Epic — deshalb
    // ein eigenes Flag statt `canEdit` mitzubenutzen.
    canSetDelivery: hasCapability(principal, "feature.delivery.set", {
      tenantId: principal.tenantId,
    }),
    // Dasselbe fuer das Loeschen — nur muss es **je ART** entschieden werden,
    // weil `feature.delete` `art`-scoped ist und die Kinder eines Epics ueber
    // mehrere ARTs verteilt sein koennen.
    canDeleteFeature: (artId: string) =>
      hasCapability(principal, "feature.delete", {
        tenantId: principal.tenantId,
        ...(artId ? { artId } : {}),
      }),
    principalId: principal.id,
    canEdit,
    canAssignOwner,
    canLinkDependency,
    canOverrideHorizon,
    gate,
  };
}

/**
 * Pure: setzt die Reifegrad-Slice aus den geladenen Teilen zusammen.
 *
 * Die drei „darf ich"-Flags sind Capability **und** Vorgangszustand: ein
 * Antrag lässt sich nur stellen, wenn keiner offen ist und es ein nächstes Gate
 * gibt; zurückziehen nur, wenn einer offen ist. Diese Kopplung gehört hierher
 * und nicht in fünf JSX-Bedingungen.
 */
function buildGateSlice(input: {
  stageGatesEnabled: boolean;
  current: GateStep;
  next: GateStep | null;
  readiness: GateReadiness | null;
  openRequest: Awaited<ReturnType<typeof getOpenGateTransition>>;
  history: Awaited<ReturnType<typeof listGateTransitions>>;
  caps: { request: boolean; withdraw: boolean; revert: boolean };
  principalId: string;
  /** Epic-Owner (für die Owner-only-Sichtbarkeit von „I need help"). */
  ownerId: string | null;
  /** `helpRequestedAt != null` — der Owner hat um Unterstützung gebeten. */
  helpRequestedAt: Date | null;
  partyStaffing: GatePartyStaffing | null;
}): EpicGateSlice {
  if (!input.stageGatesEnabled) return { disabled: true };

  const openRequest: EpicGateRequestView | null = input.openRequest
    ? {
        id: input.openRequest.id,
        fromGate: input.openRequest.fromGate,
        toGate: input.openRequest.toGate,
        quorum: input.openRequest.quorum,
        requestedBy: input.openRequest.requestedBy,
        requestedAt: input.openRequest.requestedAt.toISOString(),
        reason: input.openRequest.reason,
        approvers: input.openRequest.approvers.map((a) => ({
          id: a.id,
          userId: a.userId,
          roleLabelKey:
            a.role && isGateApproverRole(a.role) ? GATE_APPROVER_ROLE_KEYS[a.role] : null,
          status: a.status,
          decidedAt: a.decidedAt?.toISOString() ?? null,
          comment: a.comment,
        })),
        pendingUserIds: input.openRequest.approvers
          .filter((a) => a.status === "pending")
          .map((a) => a.userId),
      }
    : null;

  return {
    disabled: false,
    current: input.current,
    next: input.next,
    readiness: input.readiness,
    openRequest,
    history: input.history.map((h) => ({
      id: h.id,
      fromGate: h.fromGate,
      toGate: h.toGate,
      kind: h.kind,
      status: h.status,
      requestedBy: h.requestedBy,
      requestedAt: h.requestedAt.toISOString(),
      resolvedAt: h.resolvedAt?.toISOString() ?? null,
      reason: h.reason,
    })),
    canRequest: input.caps.request && openRequest == null && input.next != null,
    canWithdraw: input.caps.withdraw && openRequest != null,
    canRevert: input.caps.revert && previousGate(input.current) != null,
    viewerMustDecide: openRequest?.pendingUserIds.includes(input.principalId) ?? false,
    helpRequested: input.helpRequestedAt != null,
    canRequestHelp: input.ownerId != null && input.ownerId === input.principalId,
    partyStaffing: input.partyStaffing,
  };
}

/**
 * Convenience wrapper: load + build in one call. The page calls this; tests
 * prefer `buildEpicDetailModel` with in-memory fixtures. Returns null when the
 * Epic is not found.
 */
export async function loadEpicDetail(
  db: PrismaClient,
  principal: Principal,
  epicId: EpicId,
  ports: EpicDetailPorts,
  enabled: { drumbeat: boolean; budgeting: boolean; risks: boolean },
): Promise<EpicDetailModel | null> {
  const inputs = await loadEpicDetailInputs(db, principal, epicId, ports, enabled);
  return inputs ? buildEpicDetailModel(inputs) : null;
}
