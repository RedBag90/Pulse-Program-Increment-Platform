// One-time id-preserving migration: merge key_results into objectives as a
// unified recursive goal node. Each KeyResult becomes an Objective row with the
// SAME UUID, so all FK references (checkins, comments, kpi contributions, epic
// links) stay valid. Repoints those FKs from keyResultId to objectiveId.
// Idempotent: skips a KR whose Objective row already exists.
//
// Run AFTER the additive schema push, BEFORE the destructive drop.
import { PrismaClient } from "../src/generated/prisma/index.js";

const db = new PrismaClient();

try {
  const before = {
    objectives: await db.objective.count(),
    keyResults: await db.keyResult.count(),
  };
  console.log("before:", before);

  await db.$transaction(
    async (tx) => {
      // 0. Existing top-level objectives → level 0, path = id.
      const roots = await tx.objective.findMany({
        where: { nodeKind: "objective" },
        select: { id: true },
      });
      for (const r of roots) {
        await tx.objective.update({ where: { id: r.id }, data: { level: 0, path: r.id } });
      }

      // 1. Each KeyResult → Objective row with the SAME id (skip if present).
      const krs = await tx.keyResult.findMany({ include: { objective: true } });
      let created = 0;
      for (const kr of krs) {
        const exists = await tx.objective.findUnique({
          where: { id: kr.id },
          select: { id: true },
        });
        if (exists) continue;
        await tx.objective.create({
          data: {
            id: kr.id,
            tenantId: kr.tenantId,
            themeId: kr.objective.themeId,
            parentObjectiveId: kr.objectiveId,
            nodeKind: "key_result",
            level: 1,
            path: `${kr.objectiveId}/${kr.id}`,
            title: kr.title,
            metricName: kr.metricName,
            metricUnit: kr.metricUnit,
            metricType: kr.metricType,
            precision: kr.precision,
            currencyCode: kr.currencyCode,
            rollupWeight: kr.rollupWeight,
            baseline: kr.baseline,
            target: kr.target,
            current: kr.current,
            period: kr.period,
            formula: kr.formula,
            status: kr.status,
            dueDate: kr.dueDate,
            ownerId: kr.ownerId,
            sortOrder: kr.sortOrder,
            createdBy: kr.createdBy,
            updatedBy: kr.updatedBy,
          },
        });
        created++;
      }
      console.log(`created ${created} key-result objectives`);

      // 2. Repoint FK columns keyResultId → objectiveId (ids preserved, so the
      //    target objective row now exists).
      const c1 = await tx.$executeRawUnsafe(
        `UPDATE kr_kpi_contributions SET objective_id = key_result_id WHERE objective_id IS NULL AND key_result_id IS NOT NULL`,
      );
      const c2 = await tx.$executeRawUnsafe(
        `UPDATE goal_checkins SET objective_id = COALESCE(objective_id, key_result_id) WHERE objective_id IS NULL AND key_result_id IS NOT NULL`,
      );
      const c3 = await tx.$executeRawUnsafe(
        `UPDATE goal_comments SET objective_id = COALESCE(objective_id, key_result_id) WHERE objective_id IS NULL AND key_result_id IS NOT NULL`,
      );
      const c4 = await tx.$executeRawUnsafe(
        `UPDATE goal_epic_links SET objective_id = COALESCE(objective_id, key_result_id) WHERE objective_id IS NULL AND key_result_id IS NOT NULL`,
      );
      console.log(
        `repointed FKs: contributions=${c1} checkins=${c2} comments=${c3} epicLinks=${c4}`,
      );
    },
    { timeout: 30000 },
  );

  // 3. Verify.
  const after = {
    objectives: await db.objective.count(),
    keyResults: await db.keyResult.count(),
    contribNullObj: await db.krKpiContribution.count({ where: { objectiveId: null } }),
    checkinBadObj: await db.goalCheckin.count({
      where: { objectiveId: null, keyResultId: { not: null } },
    }),
    commentBadObj: await db.goalComment.count({
      where: { objectiveId: null, keyResultId: { not: null } },
    }),
    linkBadObj: await db.goalEpicLink.count({
      where: { objectiveId: null, keyResultId: { not: null } },
    }),
    krNodes: await db.objective.count({ where: { nodeKind: "key_result" } }),
  };
  console.log("after:", after);

  const ok =
    after.objectives === before.objectives + before.keyResults &&
    after.contribNullObj === 0 &&
    after.checkinBadObj === 0 &&
    after.commentBadObj === 0 &&
    after.linkBadObj === 0 &&
    after.krNodes === before.keyResults;
  console.log(ok ? "\nMIGRATION VERIFIED OK" : "\nMIGRATION VERIFY FAILED");
  if (!ok) process.exitCode = 1;
} catch (e) {
  console.error("\nMIGRATION FAILED:", e.message);
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
