import type { PrismaClient } from "@/generated/prisma";
import type { TenantId } from "@/domain/types";
import { listCustomFieldDefs } from "@/server/services/goal-custom-field";
import { parseOptions } from "@/domain/goal-custom-field";

export interface GoalFieldRow {
  id: string;
  name: string;
  /** "text" | "number" | "select". */
  type: string;
  options: string[];
}

export interface GoalFieldsPageModel {
  fields: GoalFieldRow[];
  canManage: boolean;
}

/** Page-Model der Admin-Seite „Custom Fields" (Epic 7). */
export async function buildGoalFieldsPageModel(
  db: PrismaClient,
  tenantId: TenantId,
  canManage: boolean,
): Promise<GoalFieldsPageModel> {
  const defs = await listCustomFieldDefs(db, tenantId);
  return {
    fields: defs.map((d) => ({
      id: d.id,
      name: d.name,
      type: d.type,
      options: parseOptions(d.options),
    })),
    canManage,
  };
}
