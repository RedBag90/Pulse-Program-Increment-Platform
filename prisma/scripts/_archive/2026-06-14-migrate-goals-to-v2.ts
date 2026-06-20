/**
 * Data-Migration: TransformationGoal + TargetOutcome + GoalEpicLink
 * werden auf die V2-Hierarchie (StrategicTheme + Objective + KeyResult +
 * ThemeEpicLink) ueberfuehrt. Pro Tenant ein Default-Theme
 * „Allgemeine Ziele" mit kind=business; alle alten Goals haengen darunter.
 *
 * Idempotent: Quell-IDs werden als Ziel-IDs uebernommen (UUIDs sind
 * eindeutig); ein zweiter Lauf macht create-or-skip-Pattern.
 *
 * Quell-Bestand bleibt UNANGETASTET. P7 droppt ihn nach Verifikation.
 *
 * Aufruf:
 *   set -a; . ./.env.local; set +a
 *   pnpm dlx tsx prisma/scripts/2026-06-14-migrate-goals-to-v2.ts
 */

import { PrismaClient } from "@/generated/prisma";

const REASON = "goals_v2_migration_2026_06_14";
const SYSTEM_ACTOR = "00000000-0000-0000-0000-000000000000";
const DEFAULT_THEME_NAME = "Allgemeine Ziele";

/** Deterministische UUID fuer das Default-Theme pro Tenant: namespace-uuid
 *  ueberlassen wir randomUUID, weil wir uns die Theme-Id am Tenant
 *  separat merken muessten — stattdessen lesen wir Existenz ueber den
 *  Namen + Tenant. */

async function main() {
  const db = new PrismaClient();
  try {
    const tenants = await db.tenant.findMany({ select: { id: true, name: true } });
    let totalThemes = 0;
    let totalObjectives = 0;
    let totalKrs = 0;
    let totalLinks = 0;

    for (const tenant of tenants) {
      console.warn(`\n── Tenant ${tenant.name}`);

      // 1) Default-Theme „Allgemeine Ziele" pro Tenant.
      let defaultTheme = await db.strategicTheme.findFirst({
        where: { tenantId: tenant.id, title: DEFAULT_THEME_NAME },
      });
      if (!defaultTheme) {
        defaultTheme = await db.strategicTheme.create({
          data: {
            tenantId: tenant.id,
            title: DEFAULT_THEME_NAME,
            narrative:
              "Auto-erstellt bei der Migration vom flachen Ziele-Modell. " +
              "Hier liegen alle Altziele bis sie einem konkreten Strategic Theme zugeordnet werden.",
            kind: "business",
            color: "#6366f1",
            status: "active",
            createdBy: SYSTEM_ACTOR,
            updatedBy: SYSTEM_ACTOR,
          },
        });
        totalThemes += 1;
        console.warn(`  ✓ Default-Theme angelegt (${defaultTheme.id})`);
      } else {
        console.warn(`  · Default-Theme existiert (${defaultTheme.id})`);
      }

      // 2) TransformationGoal → Objective.
      const oldGoals = await db.transformationGoal.findMany({
        where: { tenantId: tenant.id },
      });
      for (const g of oldGoals) {
        const existing = await db.objective.findUnique({ where: { id: g.id } });
        if (existing) continue;
        await db.objective.create({
          data: {
            id: g.id, // UUID-Reuse fuer Idempotenz
            tenantId: tenant.id,
            themeId: defaultTheme.id,
            title: g.title,
            narrative: g.description,
            period: null, // Backlog — User entscheidet spaeter ueber Quartal
            status: mapGoalStatus(g.status),
            ownerId: g.ownerId,
            sortOrder: 0,
            createdBy: g.createdBy,
            updatedBy: g.updatedBy,
            createdAt: g.createdAt,
            updatedAt: g.updatedAt,
          },
        });
        totalObjectives += 1;
      }
      console.warn(`  ✓ ${oldGoals.length} Goals → Objectives`);

      // 3) TargetOutcome → KeyResult (nur die mit goalId).
      const oldOutcomes = await db.targetOutcome.findMany({
        where: { tenantId: tenant.id, goalId: { not: null } },
      });
      for (const o of oldOutcomes) {
        const existing = await db.keyResult.findUnique({ where: { id: o.id } });
        if (existing) continue;
        await db.keyResult.create({
          data: {
            id: o.id,
            tenantId: tenant.id,
            objectiveId: o.goalId!, // sicher, dank where-Filter
            title: o.title,
            metricUnit: o.metricUnit,
            baseline: o.baseline ?? null,
            target: o.target,
            formula: "manual", // Kein KPI-Bezug → User pflegt current direkt
            current: o.current ?? null,
            sortOrder: 0,
            createdBy: o.createdBy,
            updatedBy: o.updatedBy,
            createdAt: o.createdAt,
            updatedAt: o.updatedAt,
          },
        });
        totalKrs += 1;
      }
      const orphanCount = await db.targetOutcome.count({
        where: { tenantId: tenant.id, goalId: null },
      });
      console.warn(
        `  ✓ ${oldOutcomes.length} TargetOutcomes → KeyResults (${orphanCount} orphans uebersprungen)`,
      );

      // 4) GoalEpicLink → ThemeEpicLink (Epic an Default-Theme).
      const oldLinks = await db.goalEpicLink.findMany({
        where: { tenantId: tenant.id },
        select: { tenantId: true, epicId: true },
        distinct: ["tenantId", "epicId"],
      });
      for (const l of oldLinks) {
        const existing = await db.themeEpicLink.findUnique({
          where: { themeId_epicId: { themeId: defaultTheme.id, epicId: l.epicId } },
        });
        if (existing) continue;
        await db.themeEpicLink.create({
          data: {
            tenantId: l.tenantId,
            themeId: defaultTheme.id,
            epicId: l.epicId,
            createdBy: SYSTEM_ACTOR,
          },
        });
        totalLinks += 1;
      }
      console.warn(`  ✓ ${oldLinks.length} GoalEpicLinks → ThemeEpicLinks`);

      // 5) Audit-Eintrag pro Tenant.
      await db.auditEvent.create({
        data: {
          tenantId: tenant.id,
          actorId: SYSTEM_ACTOR,
          action: "ziele.migration.v2",
          resourceType: "tenant",
          resourceId: tenant.id,
          changes: {
            reason: REASON,
            themesCreated: 1,
            objectivesCreated: oldGoals.length,
            keyResultsCreated: oldOutcomes.length,
            orphanOutcomes: orphanCount,
            themeEpicLinksCreated: oldLinks.length,
          },
        },
      });
    }

    console.warn(
      `\nDone. ${totalThemes} Themes · ${totalObjectives} Objectives · ${totalKrs} KRs · ${totalLinks} Theme-Epic-Links`,
    );
  } finally {
    await db.$disconnect();
  }
}

function mapGoalStatus(old: string): string {
  // TransformationGoal: active | achieved | archived
  // Objective:          draft | active | achieved | missed | stretched | cancelled
  if (old === "achieved") return "achieved";
  if (old === "archived") return "cancelled";
  return "active";
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
