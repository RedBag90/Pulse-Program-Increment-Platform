/**
 * Numeric ordering is load-bearing: parent.level + 1 === child.level.
 */
export enum InitiativeLevel {
  EPIC = 0,
  FEATURE = 1,
  STORY = 2,
  TASK = 3,
}

// ---------------------------------------------------------------------------
// Branded primitive types – prevent ID confusion across entity boundaries
// ---------------------------------------------------------------------------

export type TenantId = string & { readonly __brand: "TenantId" };
export type EpicId = string & { readonly __brand: "EpicId" };
export type FeatureId = string & { readonly __brand: "FeatureId" };
export type StoryId = string & { readonly __brand: "StoryId" };
export type TaskId = string & { readonly __brand: "TaskId" };
export type InitiativeId = EpicId | FeatureId | StoryId | TaskId;
export type UserId = string & { readonly __brand: "UserId" };
export type ArtId = string & { readonly __brand: "ArtId" };
export type TeamId = string & { readonly __brand: "TeamId" };
export type ValueStreamId = string & { readonly __brand: "ValueStreamId" };
export type PiId = string & { readonly __brand: "PiId" };
export type SprintId = string & { readonly __brand: "SprintId" };

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

export interface LeanBusinessCase {
  problemStatement: string;
  customerValue: string;
  costEstimate?: number;
  roiEstimate?: number;
  successCriteria: string;
  risks: string;
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
  leanBusinessCase: LeanBusinessCase;
}

export interface Feature extends InitiativeBase {
  readonly level: InitiativeLevel.FEATURE;
  readonly id: FeatureId;
  readonly parentId: EpicId;
  readonly artId: ArtId;
  readonly piId: PiId;
  wsjf: WsjfScore;
  acceptanceCriteria: ReadonlyArray<string>;
}

export interface Story extends InitiativeBase {
  readonly level: InitiativeLevel.STORY;
  readonly id: StoryId;
  readonly parentId: FeatureId;
  readonly piId: PiId;
  readonly sprintId: SprintId;
  storyPoints: FibonacciValue;
  acceptanceCriteria: ReadonlyArray<string>;
}

export interface Task extends InitiativeBase {
  readonly level: InitiativeLevel.TASK;
  readonly id: TaskId;
  readonly parentId: StoryId;
  estimateHours: number;
}

/** Discriminated union – use the `level` field to narrow. */
export type Initiative = Epic | Feature | Story | Task;

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

export interface DependencyLinked {
  fromId: InitiativeId;
  toId: InitiativeId;
  type: "blocks" | "depends_on" | "relates_to";
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
