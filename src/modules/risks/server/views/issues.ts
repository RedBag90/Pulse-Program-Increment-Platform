import type { PrismaClient, Prisma } from "@/generated/prisma";
import type { Principal } from "@/server/auth/principal";
import { getIssueSettings } from "@/modules/risks/server/services/issue-settings";
import { ISSUE_LIST_INCLUDE, issueReadFilter } from "@/modules/risks/server/services/issue";
import { listTenantUserLabels } from "@/server/services/tenant-users";
import {
  buildIssuesListModel,
  type IssuesListModel,
  type IssueListRow,
} from "@/modules/risks/server/views/issues-list";

/**
 * **Der** Issue-Register-Loader — ersetzt die zuvor fast identischen
 * `loadIssuesRegister` (tenant-weit) und `loadEpicIssuesModel` (Epic-Subtree).
 * Scope entscheidet nur die `initiative`-Klausel; alles andere (Read-Filter,
 * Settings, User-Labels, `buildIssuesListModel`) ist gemeinsam.
 *
 * Epic-Scope = das Epic selbst (`id == epicId`) plus jeder Nachfahre über das
 * materialisierte `path`-Präfix. Work importiert nie risks — die Epic-Route ruft
 * als Composition-Root (ADR-0013).
 */
export type IssuesScope = { kind: "tenant" } | { kind: "epic"; epicId: string };

export interface IssuesView {
  model: IssuesListModel;
  prefix: string;
  userLabels: Record<string, string>;
}

export async function loadIssues(
  db: PrismaClient,
  principal: Principal,
  scope: IssuesScope = { kind: "tenant" },
): Promise<IssuesView> {
  let initiativeFilter: Prisma.IssueWhereInput["initiative"];
  if (scope.kind === "epic") {
    const epic = await db.initiative.findFirst({
      where: { id: scope.epicId, tenantId: principal.tenantId, deletedAt: null },
      select: { id: true, path: true },
    });
    // Bei fehlendem `path` (Altbestand) nur das Epic selbst, damit wenigstens
    // Epic-Ebene-Issues erscheinen.
    initiativeFilter = epic?.path
      ? { OR: [{ id: scope.epicId }, { path: { startsWith: `${epic.path}/` } }] }
      : { id: scope.epicId };
  }

  const [settings, userLabels, issues] = await Promise.all([
    getIssueSettings(db, principal.tenantId),
    listTenantUserLabels(db, principal.tenantId),
    db.issue.findMany({
      where: {
        tenantId: principal.tenantId,
        deletedAt: null,
        ...(initiativeFilter ? { initiative: initiativeFilter } : {}),
        AND: [issueReadFilter(principal)],
      },
      orderBy: { createdAt: "desc" },
      include: ISSUE_LIST_INCLUDE,
    }),
  ]);

  const model = buildIssuesListModel({ issues, prefix: settings.prefix, userLabels });
  return { model, prefix: settings.prefix, userLabels };
}

export interface IssueDetailView {
  row: IssueListRow;
  userLabels: Record<string, string>;
}

/**
 * Ein einzelnes Issue als Listen-Row (über denselben `buildIssuesListModel`,
 * damit Detail und Register dieselbe Ableitung teilen) — für die Voll-Route
 * `/issues/[id]`. `null` wenn nicht sichtbar/vorhanden.
 */
export async function loadIssueDetail(
  db: PrismaClient,
  principal: Principal,
  id: string,
): Promise<IssueDetailView | null> {
  const [settings, userLabels, issue] = await Promise.all([
    getIssueSettings(db, principal.tenantId),
    listTenantUserLabels(db, principal.tenantId),
    db.issue.findFirst({
      where: {
        id,
        tenantId: principal.tenantId,
        deletedAt: null,
        AND: [issueReadFilter(principal)],
      },
      include: ISSUE_LIST_INCLUDE,
    }),
  ]);
  if (!issue) return null;
  const model = buildIssuesListModel({ issues: [issue], prefix: settings.prefix, userLabels });
  const row = model.rows[0] ?? model.suggestions[0] ?? null;
  return row ? { row, userLabels } : null;
}
