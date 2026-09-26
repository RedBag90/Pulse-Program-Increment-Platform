/**
 * Numeric ordering is load-bearing: parent.level + 1 === child.level.
 */
export enum InitiativeLevel {
  EPIC = 0,
  FEATURE = 1,
}

// ---------------------------------------------------------------------------
// Branded primitive types – prevent ID confusion across entity boundaries
// ---------------------------------------------------------------------------

export type TenantId = string & { readonly __brand: "TenantId" };
export type EpicId = string & { readonly __brand: "EpicId" };
export type FeatureId = string & { readonly __brand: "FeatureId" };
export type InitiativeId = EpicId | FeatureId;
export type UserId = string & { readonly __brand: "UserId" };
export type ArtId = string & { readonly __brand: "ArtId" };
export type ValueStreamId = string & { readonly __brand: "ValueStreamId" };
export type PiId = string & { readonly __brand: "PiId" };
export type TimelineId = string & { readonly __brand: "TimelineId" };
export type SprintId = string & { readonly __brand: "SprintId" };
export type ImpedimentId = string & { readonly __brand: "ImpedimentId" };

// ---------------------------------------------------------------------------
// Supporting value types
// ---------------------------------------------------------------------------

export type FibonacciValue = 1 | 2 | 3 | 5 | 8 | 13 | 20;
export type StageGate = "L0" | "L1" | "L2" | "L3" | "L4" | "L5";
export type InitiativeStatus =
  | "draft"
  | "in_review"
  | "approved"
  | "in_progress"
  | "blocked"
  | "completed"
  | "cancelled";

export interface WsjfScore {
  readonly businessValue: FibonacciValue;
  readonly timeCriticality: FibonacciValue;
  readonly riskReduction: FibonacciValue;
  readonly jobSize: FibonacciValue;
  /** Server-computed; clients never set this field directly. */
  readonly computed: number;
}

// ---------------------------------------------------------------------------
// Core initiative hierarchy (discriminated union)
// ---------------------------------------------------------------------------

interface InitiativeBase {
  readonly id: InitiativeId;
  readonly tenantId: TenantId;
  /** Materialized path for efficient subtree queries. */
  readonly path: string;
  title: string;
  description: string;
  ownerId: UserId;
  assigneeIds: ReadonlyArray<UserId>;
  stageGate: StageGate;
  status: InitiativeStatus;
  readonly createdAt: Date;
  readonly createdBy: UserId;
  updatedAt: Date;
  updatedBy: UserId;
}

export interface Epic extends InitiativeBase {
  readonly level: InitiativeLevel.EPIC;
  readonly id: EpicId;
  readonly parentId: null;
  readonly valueStreamId: ValueStreamId;
  /** Benefit Hypothesis artefact (JSON, am Use-Site via parseBenefitHypothesis
   *  geparst) — als `unknown` gehalten, damit der Core-Substrat-Typ nicht auf
   *  Work-Typen zeigt (ADR-0013). Die getypte Sicht lebt in Work. */
  benefitHypothesis?: unknown;
  /** Business Case artefact (JSON, am Use-Site via parseBusinessCase geparst) —
   *  siehe oben. */
  businessCase?: unknown;
}

export interface Feature extends InitiativeBase {
  readonly level: InitiativeLevel.FEATURE;
  readonly id: FeatureId;
  /**
   * Das Eltern-Epic — oder `null`.
   *
   * `null` heißt **eigenständiges Feature**: ART-eigene Arbeit, die unter
   * keinem Portfolio-Vorhaben hängt (klassisches SAFe: das ART-Backlog ist
   * nicht der Unterbau des Portfolio-Backlogs). Der Wertstrom kommt dann vom
   * ART, nicht vom Epic — siehe `initiative-value-stream.ts`.
   *
   * Die Konzeptnotiz §6.4 führt dazu eine Invariante I2 („Epic ⟺ parentId ===
   * null"). Sie ist mit dieser Entscheidung überholt; die Korrektur steht in
   * der ADR zum eigenständigen Feature.
   */
  readonly parentId: EpicId | null;
  readonly artId: ArtId;
  readonly piId: PiId;
  wsjf: WsjfScore;
  acceptanceCriteria: ReadonlyArray<string>;
}

/** Discriminated union – use the `level` field to narrow. */
export type Initiative = Epic | Feature;

// ---------------------------------------------------------------------------
// Domain events
// ---------------------------------------------------------------------------

export interface InitiativeCreated {
  initiativeId: InitiativeId;
  level: InitiativeLevel;
  tenantId: TenantId;
  actorId: UserId;
}

export interface InitiativeUpdated {
  initiativeId: InitiativeId;
  tenantId: TenantId;
  actorId: UserId;
  changes: Record<string, { before: unknown; after: unknown }>;
}

export interface StageGateAdvanced {
  initiativeId: InitiativeId;
  tenantId: TenantId;
  actorId: UserId;
  fromGate: StageGate;
  toGate: StageGate;
  comment?: string;
}

/**
 * **Die Abhängigkeitstypen — eine Liste für alle Module.**
 *
 * `blocks`: `from` kommt zuerst und hält `to` auf. `relates_to`: ohne
 * Reihenfolge. Bis September 2026 gab es dazu `depends_on` („hängt ab von"),
 * das der Netzplan als „from zuerst" zeichnete und die Blocker-Regel als „to
 * zuerst" las; es ist entfallen (Bestand: `prisma/scripts/
 * 2026-09-27-depends-on-zu-blocks.ts`).
 *
 * Hier, nicht in Drumbeat, weil auch Work die Liste zum Validieren braucht
 * (ADR-0013: Work importiert nicht aus Drumbeat). Validierungen bauen ihr
 * `z.enum` aus dieser Liste, statt sie abzuschreiben.
 */
export const DEPENDENCY_TYPES = ["blocks", "relates_to"] as const;
export type DependencyType = (typeof DEPENDENCY_TYPES)[number];

export interface DependencyLinked {
  fromId: InitiativeId;
  toId: InitiativeId;
  type: DependencyType;
  tenantId: TenantId;
  actorId: UserId;
}

export interface WsjfScored {
  featureId: FeatureId;
  tenantId: TenantId;
  actorId: UserId;
  before: WsjfScore;
  after: WsjfScore;
}

export interface PiStarted {
  piId: PiId;
  tenantId: TenantId;
  actorId: UserId;
}

export interface PiCompleted {
  piId: PiId;
  tenantId: TenantId;
  actorId: UserId;
}

export interface ImpedimentRaised {
  impedimentId: string;
  tenantId: TenantId;
  actorId: UserId;
  severity: "low" | "medium" | "high" | "critical";
}

export interface ImpedimentResolved {
  impedimentId: string;
  tenantId: TenantId;
  actorId: UserId;
  resolutionComment: string;
}

export type DomainEvent =
  | { type: "initiative.created"; payload: InitiativeCreated }
  | { type: "initiative.updated"; payload: InitiativeUpdated }
  | { type: "initiative.stage_gate.advanced"; payload: StageGateAdvanced }
  | { type: "initiative.dependency.linked"; payload: DependencyLinked }
  | { type: "wsjf.scored"; payload: WsjfScored }
  | { type: "pi.started"; payload: PiStarted }
  | { type: "pi.completed"; payload: PiCompleted }
  | { type: "impediment.raised"; payload: ImpedimentRaised }
  | { type: "impediment.resolved"; payload: ImpedimentResolved };
