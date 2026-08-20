/**
 * Controlling-Übersicht page-model — the view seam for the controlling landing
 * page. Mirrors Work's `server/views/*` pattern: an impure loader
 * (`loadControllingModelInputs`) that hits the DB in one parallel wave, and a
 * pure builder (`buildControllingModel`) that owns every derivation the page
 * used to compute inline. The page becomes load → build → render.
 *
 * Pure builder: no I/O, no `Date.now()` — `now` is injected so tests can pin
 * the active half-year cycle deterministically.
 */

import type { PrismaClient } from "@/generated/prisma";
import type { TenantId } from "@/modules/core/kernel/domain/types";
import { halfYearKey, halfYearLabel } from "@/modules/core/kernel/domain/calendar";
import { resolveActiveCycle } from "@/modules/budgeting/domain/budget-cycle";
import {
  getLatestBudgetPlanRevision,
  listBudgetPlanRevisions,
  type BudgetPlanRevisionHeader,
} from "@/modules/budgeting/server/services/budget-plan-revision";
import type { BudgetPlanSnapshot } from "@/modules/budgeting/domain/budget-plan-snapshot";
import { getPortfolioGuardrailsInputs } from "@/modules/work/server/services/portfolio-dashboard";
import { listTenantUserLabels } from "@/server/services/tenant-users";
import type { GuardrailTargets } from "@/modules/work/domain/portfolio-guardrails";

/** The latest revision header enriched with its full frozen snapshot. */
export type LatestRevision = BudgetPlanRevisionHeader & { snapshot: BudgetPlanSnapshot };

/**
 * Capability flags resolved at the composition root (they need the `principal`,
 * so `authorize(...)` stays in the page). The builder only reads booleans —
 * keeps it pure and trivially testable.
 */
export interface ControllingCapabilities {
  /** `budget_plan.revision.capture` — may freeze a new revision. */
  canCapture: boolean;
  /** `target.manage` — may edit the guardrail targets. */
  canManageTargets: boolean;
}

export interface ControllingModelInputs {
  latest: LatestRevision | null;
  history: BudgetPlanRevisionHeader[];
  /** ownerId → display name, for resolving `capturedBy`. */
  userLabels: Record<string, string>;
  guardrailTargets: GuardrailTargets;
  capabilities: ControllingCapabilities;
  /** Injected "today" — Fallback für den aktiven Zyklus, wenn kein Anker gesetzt ist. */
  now: Date;
  /** Der gespeicherte Anker (Rolling-Window); überschreibt `now` als aktiver Zyklus. */
  activeCycle?: string;
}

export interface ControllingModel {
  /** Active half-year key, e.g. "2026-H1" — derived from `now`. */
  cycleKey: string;
  cycleLabel: string;
  latest: LatestRevision | null;
  /** Whether the latest captured revision belongs to the active cycle. */
  latestIsCurrentCycle: boolean;
  history: BudgetPlanRevisionHeader[];
  userLabels: Record<string, string>;
  guardrailTargets: GuardrailTargets;
  canCapture: boolean;
  canManageTargets: boolean;
}

/**
 * Whether a revision's cycle is the currently-active half-year. Drives the
 * "re-capture" affordance on the detail page and `latestIsCurrentCycle` on the
 * overview. Pure — `now` injected.
 */
export function isCurrentCycle(cycleKey: string, now: Date): boolean {
  return cycleKey === halfYearKey(now);
}

/**
 * Controlling-Übersicht page-model — folds the loaded revisions, guardrail
 * targets and capability flags into the render-ready DTO the page consumes.
 * Pure: `now` is injected so the "active cycle" is deterministic in tests.
 */
export function buildControllingModel(inputs: ControllingModelInputs): ControllingModel {
  const { latest, history, userLabels, guardrailTargets, capabilities, now, activeCycle } = inputs;

  const cycleKey = activeCycle ?? halfYearKey(now);
  const cycleLabel = halfYearLabel(cycleKey);
  const latestIsCurrentCycle = latest != null && latest.cycleKey === cycleKey;

  return {
    cycleKey,
    cycleLabel,
    latest,
    latestIsCurrentCycle,
    history,
    userLabels,
    guardrailTargets,
    canCapture: capabilities.canCapture,
    canManageTargets: capabilities.canManageTargets,
  };
}

/**
 * Loads every input the controlling page-model needs in one parallel wave.
 * Pure I/O — no reshape, no derivation (the builder owns that). Capabilities
 * are resolved by the caller (composition root) and passed through, since
 * `authorize(...)` needs the request `principal`.
 */
export async function loadControllingModelInputs(
  db: PrismaClient,
  tenantId: TenantId,
  capabilities: ControllingCapabilities,
): Promise<ControllingModelInputs> {
  const [latest, history, userLabels, guardrailsInputs, tenant] = await Promise.all([
    getLatestBudgetPlanRevision(db, tenantId),
    listBudgetPlanRevisions(db, tenantId),
    listTenantUserLabels(db, tenantId),
    getPortfolioGuardrailsInputs(db, tenantId),
    db.tenant.findUnique({ where: { id: tenantId }, select: { activeBudgetCycle: true } }),
  ]);

  return {
    latest,
    history,
    userLabels,
    guardrailTargets: guardrailsInputs.targets,
    capabilities,
    now: new Date(),
    activeCycle: resolveActiveCycle(
      { activeBudgetCycle: tenant?.activeBudgetCycle ?? null },
      new Date(),
    ),
  };
}

/**
 * Convenience wrapper: load + build, returned as one DTO. The page calls this;
 * tests prefer `buildControllingModel` with fixtures.
 */
export async function loadControllingModel(
  db: PrismaClient,
  tenantId: TenantId,
  capabilities: ControllingCapabilities,
): Promise<ControllingModel> {
  return buildControllingModel(await loadControllingModelInputs(db, tenantId, capabilities));
}
