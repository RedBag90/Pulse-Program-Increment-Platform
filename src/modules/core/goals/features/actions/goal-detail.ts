"use server";

import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { listTenantUserLabels } from "@/server/services/tenant-users";
import {
  loadGoalDetail,
  type GoalDetail,
  type GoalTarget,
} from "@/modules/core/goals/server/views/ziele-view";

export type GoalDetailPayload = GoalDetail & {
  userLabels: Record<string, string>;
  /**
   * Wer gerade liest. Der Verlauf zeigt Bearbeiten/Löschen nur am eigenen
   * Eintrag (`goal-entry-access.ts`), und das kann erst entscheiden, wer den
   * Leser kennt — der Loader selbst sieht nur den Mandanten.
   */
  viewerId: string;
};

/**
 * Read-only detail bundle (check-in history + comments + activity + the actor
 * label map) for one goal, loaded on demand when the drawer opens. Returns
 * null when unauthed.
 */
export async function getGoalDetailAction(
  target: GoalTarget,
  id: string,
): Promise<GoalDetailPayload | null> {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) return null;
  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const [detail, userLabels] = await Promise.all([
    loadGoalDetail(db, principal.tenantId, target, id),
    listTenantUserLabels(db, principal.tenantId),
  ]);
  return { ...detail, userLabels, viewerId: principal.id };
}
