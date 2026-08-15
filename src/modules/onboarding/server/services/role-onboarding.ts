import type { PrismaClient } from "@/generated/prisma";
import type { RequestContext } from "@/server/http/mutation-handler";
import { withAuditedTransaction, toMutationContext } from "@/modules/core/kernel/server/mutation";
import { ok, type Result } from "@/modules/core/kernel/domain/errors";
import type { Role } from "@/modules/core/kernel/domain/roles";
import type { RoleOnboardingState } from "@/modules/onboarding/domain/role-tour";

/**
 * Persistenz des Rollen-Onboardings. Rein persönlich: jede Funktion schreibt
 * hart auf `userId = principal.id`, zusätzlich isoliert die RLS-Policy
 * `tenant_user_isolation_role_onboarding` die Zeilen auf Tenant **und** Nutzer.
 * Es gibt bewusst keinen Weg, fremde Quittungen zu lesen oder zu setzen — auch
 * nicht für den Tenant-Admin.
 */

export async function listRoleOnboarding(
  db: PrismaClient,
  tenantId: string,
  userId: string,
): Promise<RoleOnboardingState[]> {
  const rows = await db.roleOnboarding.findMany({
    where: { tenantId, userId },
    select: { role: true, acknowledgedAt: true, seenStepKeys: true },
  });
  return rows.map((r) => ({
    role: r.role,
    acknowledgedAt: r.acknowledgedAt,
    seenStepKeys: r.seenStepKeys,
  }));
}

/**
 * Rolle zur Kenntnis genommen. Idempotent — ein zweiter Aufruf lässt den
 * ursprünglichen Zeitpunkt stehen, damit die Quittung im Audit-Log das erste
 * Mal datiert und nicht das letzte.
 */
export async function acknowledgeRole(
  ctx: RequestContext,
  input: { role: Role },
): Promise<Result<{ acknowledged: boolean }>> {
  const mctx = toMutationContext(ctx);
  // Generic explizit: sonst verengt TS auf das Literal des ersten `return`.
  return withAuditedTransaction<{ acknowledged: boolean }>(mctx, async (tx) => {
    const existing = await tx.roleOnboarding.findUnique({
      where: {
        tenantId_userId_role: {
          tenantId: mctx.tenantId,
          userId: mctx.actorId,
          role: input.role,
        },
      },
      select: { id: true, acknowledgedAt: true },
    });

    if (existing?.acknowledgedAt) {
      return ok({
        result: { acknowledged: false },
        audit: {
          action: "role.onboarding.acknowledged" as const,
          resourceType: "role_onboarding" as const,
          resourceId: existing.id,
        },
      });
    }

    const row = await tx.roleOnboarding.upsert({
      where: {
        tenantId_userId_role: {
          tenantId: mctx.tenantId,
          userId: mctx.actorId,
          role: input.role,
        },
      },
      create: {
        tenantId: mctx.tenantId,
        userId: mctx.actorId,
        role: input.role,
        acknowledgedAt: new Date(),
        seenStepKeys: [],
      },
      update: { acknowledgedAt: new Date() },
      select: { id: true },
    });

    return ok({
      result: { acknowledged: true },
      audit: {
        action: "role.onboarding.acknowledged" as const,
        resourceType: "role_onboarding" as const,
        resourceId: row.id,
        changes: { role: { before: null, after: input.role } },
      },
    });
  });
}

/**
 * Gesehene Schritte ergänzen — **additiv, nie überschreibend**.
 *
 * `push` statt Lesen-Rechnen-Schreiben: die Tour läuft oft in mehreren Tabs, und
 * ein Read-Modify-Write würde unter READ COMMITTED die Schritte des jeweils
 * anderen Tabs verlieren. Prisma übersetzt `push` in ein Array-Append direkt in
 * der Anweisung, also geht nichts verloren.
 *
 * Kein Roh-SQL: `createPrismaClient` liefert einen per `$extends` erweiterten
 * Client, dessen `$allOperations`-Hook die Argumente durchreicht. Ein
 * `$executeRaw` mit `Prisma.sql`-Objekt verliert dabei seine Tagged-Template-Form
 * und scheitert mit „Argument `query` is missing" — mit einem rohen Client
 * funktioniert dasselbe SQL dagegen problemlos, weshalb der Fehler erst im
 * Browser auftrat.
 *
 * Doppelte Einträge sind unkritisch: gelesen wird die Spalte ausschließlich als
 * Menge (`openSteps` baut ein `Set`), und `restartTour` leert sie wieder.
 *
 * Kein Audit-Eintrag: das feuert bei jedem Schrittwechsel und hat keinen
 * Compliance-Wert — quittiert wird die Rolle, nicht der Klick.
 */
export async function markStepsSeen(
  ctx: RequestContext,
  input: { role: Role; stepKeys: readonly string[] },
): Promise<Result<void>> {
  if (input.stepKeys.length === 0) return ok(undefined);

  const { principal, db } = ctx;
  const keys = [...input.stepKeys];
  await db.roleOnboarding.upsert({
    where: {
      tenantId_userId_role: {
        tenantId: principal.tenantId,
        userId: principal.id,
        role: input.role,
      },
    },
    create: {
      tenantId: principal.tenantId,
      userId: principal.id,
      role: input.role,
      seenStepKeys: keys,
    },
    update: { seenStepKeys: { push: keys } },
    select: { id: true },
  });
  return ok(undefined);
}

/**
 * Tour zurücksetzen — leert die gesehenen Schritte, lässt die Quittung stehen.
 * Dadurch startet die Tour neu, ohne dass das Willkommensfenster erneut kommt.
 */
export async function restartTour(
  ctx: RequestContext,
  input: { role: Role },
): Promise<Result<void>> {
  const { principal, db } = ctx;
  await db.roleOnboarding.updateMany({
    where: { tenantId: principal.tenantId, userId: principal.id, role: input.role },
    data: { seenStepKeys: [] },
  });
  return ok(undefined);
}
