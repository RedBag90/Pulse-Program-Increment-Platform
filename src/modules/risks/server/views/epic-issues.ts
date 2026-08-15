import type { PrismaClient } from "@/generated/prisma";
import type { Principal } from "@/server/auth/principal";
import { getIssueSettings } from "@/modules/risks/server/services/issue-settings";
import { ISSUE_LIST_INCLUDE, issueReadFilter } from "@/modules/risks/server/services/issue";
import { listTenantUserLabels } from "@/server/services/tenant-users";
import { buildIssuesListModel, type IssuesListModel } from "@/modules/risks/server/views/issues-list";

export interface EpicIssuesView {
  model: IssuesListModel;
  prefix: string;
  userLabels: Record<string, string>;
  issueCount: number;
  suggestionCount: number;
}

/**
 * Epic-scoped roll-up: every Issue (risk AND impediment) raised on this Epic or
 * on any Feature in its subtree, read-scoped to the principal, through the shared
 * `buildIssuesListModel`. The Epic detail page's Issues tab renders off this.
 *
 * Subtree = the Epic itself (`initiative.id == epicId`) plus every descendant via
 * the materialized `path` prefix (`${epicPath}/…`). Work never imports risks — the
 * Epic route, as composition root, does (ADR-0013).
 */
export async function loadEpicIssuesModel(
  db: PrismaClient,
  principal: Principal,
  epicId: string,
): Promise<EpicIssuesView> {
  const epic = await db.initiative.findFirst({
    where: { id: epicId, tenantId: principal.tenantId, deletedAt: null },
    select: { id: true, path: true },
  });
  // Match the Epic itself + its whole subtree by materialized path. When `path`
  // is unset (older rows), fall back to the direct id so at least epic-level
  // issues surface.
  const subtree = epic?.path
    ? { OR: [{ id: epicId }, { path: { startsWith: `${epic.path}/` } }] }
    : { id: epicId };

  const [settings, userLabels, issues] = await Promise.all([
    getIssueSettings(db, principal.tenantId),
    listTenantUserLabels(db, principal.tenantId),
    db.issue.findMany({
      where: {
        tenantId: principal.tenantId,
        deletedAt: null,
        initiative: subtree,
        AND: [issueReadFilter(principal)],
      },
      orderBy: { createdAt: "desc" },
      include: ISSUE_LIST_INCLUDE,
    }),
  ]);

  const model = buildIssuesListModel({ issues, prefix: settings.prefix, userLabels });
  return {
    model,
    prefix: settings.prefix,
    userLabels,
    issueCount: model.counts.total,
    suggestionCount: model.suggestions.length,
  };
}
