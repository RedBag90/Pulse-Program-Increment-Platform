import type { PrismaClient } from "@/generated/prisma";
import type { Principal } from "@/server/auth/principal";
import { getIssueSettings } from "@/modules/risks/server/services/issue-settings";
import { ISSUE_LIST_INCLUDE, issueReadFilter } from "@/modules/risks/server/services/issue";
import { listTenantUserLabels } from "@/server/services/tenant-users";
import { buildIssuesListModel, type IssuesListModel } from "@/modules/risks/server/views/issues-list";

export interface IssuesRegisterView {
  model: IssuesListModel;
  prefix: string;
  userLabels: Record<string, string>;
}

/**
 * Tenant-wide unified Issue register — every risk + impediment the principal may
 * see (`issueReadFilter`), through the shared `buildIssuesListModel`. Backs the
 * `/issues` page (the merged replacement for the separate risk + impediment lists).
 */
export async function loadIssuesRegister(
  db: PrismaClient,
  principal: Principal,
): Promise<IssuesRegisterView> {
  const [settings, userLabels, issues] = await Promise.all([
    getIssueSettings(db, principal.tenantId),
    listTenantUserLabels(db, principal.tenantId),
    db.issue.findMany({
      where: {
        tenantId: principal.tenantId,
        deletedAt: null,
        AND: [issueReadFilter(principal)],
      },
      orderBy: { createdAt: "desc" },
      include: ISSUE_LIST_INCLUDE,
    }),
  ]);

  const model = buildIssuesListModel({ issues, prefix: settings.prefix, userLabels });
  return { model, prefix: settings.prefix, userLabels };
}
