"use client";

import { useActionState, useMemo } from "react";
import { useUrlState } from "@/lib/hooks/use-url-state";
import { Button } from "@/components/ui/button";
import { PageSection } from "@/components/layout";
import type { IssuesListModel, IssueListRow } from "@/modules/risks/server/views/issues-list";
import type { RoamStatus } from "@/modules/core/kernel/domain/roam";
import { wouldCreateCycle } from "@/modules/risks/domain/issue-tree";
import { RiskMatrix } from "@/modules/risks/features/risk/components/risk-matrix";
import { reviewIssueAction } from "@/modules/risks/features/issue/actions/issue";
import type { ActionState } from "@/server/http/server-action";
import {
  IssueDetailDrawer,
  type IssueCaps,
} from "@/modules/risks/features/issue/components/issue-detail-drawer";
import { CreateIssueDialog } from "@/modules/risks/features/issue/components/create-issue-dialog";
import { IssuesFunnelBar } from "@/modules/risks/features/issue/components/issues-funnel-bar";
import {
  IssuesFilterBar,
  type IssueSortKey,
  type IssueDensity,
} from "@/modules/risks/features/issue/components/issues-filter-bar";
import { IssuesListTable } from "@/modules/risks/features/issue/components/issues-list-table";
import {
  useIssueTreeDnd,
  dropZoneClass,
} from "@/modules/risks/features/issue/components/issue-tree-dnd";

interface Props {
  model: IssuesListModel;
  userLabels: Record<string, string>;
  caps: IssueCaps;
  /** Pre-link "Issue erfassen" to this work item (Epic tab). */
  initiativeId?: string;
  /** Features of the epic (Epic tab) — the "Betrifft" selector. */
  featureOptions?: { id: string; title: string }[];
  /** Embedded in another page (Epic tab): drop the page header + outer padding. */
  embedded?: boolean;
}

const RANK: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 };
const DEFAULT_SORT: IssueSortKey = "created:desc";

function rowRank(r: IssueListRow): number {
  return r.band ? (RANK[r.band] ?? 0) : 0;
}

function compareBy(sort: IssueSortKey): (a: IssueListRow, b: IssueListRow) => number {
  switch (sort) {
    case "daysOpen:desc":
      return (a, b) => b.daysOpen - a.daysOpen;
    case "exposure:desc":
      return (a, b) => rowRank(b) - rowRank(a);
    case "title:asc":
      return (a, b) => a.title.localeCompare(b.title, "de");
    case "created:desc":
    default:
      return (a, b) => a.daysOpen - b.daysOpen;
  }
}

const isSort = (v: string | null): v is IssueSortKey =>
  v === "created:desc" || v === "daysOpen:desc" || v === "exposure:desc" || v === "title:asc";

export function IssuesListShell({ model, userLabels, caps, initiativeId, featureOptions, embedded }: Props) {
  const { params, push } = useUrlState();

  const roam = params.get("roam") as RoamStatus | null;
  const category = params.get("category");
  const ownerId = params.get("owner");
  const query = params.get("q") ?? "";
  const sort = isSort(params.get("sort")) ? (params.get("sort") as IssueSortKey) : DEFAULT_SORT;
  const density = (params.get("density") === "compact" ? "compact" : "comfortable") as IssueDensity;

  const canReparent = caps.canUpdate;
  const parentOf = useMemo(
    () => new Map(model.rows.map((r) => [r.id, r.parentId])),
    [model.rows],
  );
  const dnd = useIssueTreeDnd({
    isDescendant: (ancestorId, maybeDescId) => wouldCreateCycle(ancestorId, maybeDescId, parentOf),
  });

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = model.rows.filter((r) => {
      if (roam && r.roamStatus !== roam) return false;
      if (category && r.category !== category) return false;
      if (ownerId && r.ownerId !== ownerId) return false;
      if (q) {
        const hay = `${r.title} ${r.description ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    return rows.slice().sort(compareBy(sort));
  }, [model.rows, roam, category, ownerId, query, sort]);

  const allRows = [...model.rows, ...model.suggestions];
  const createProps = initiativeId ? { initiativeId } : {};
  const featureProps = featureOptions ? { featureOptions } : {};
  const rootZone = dnd.dropProps({ kind: "root" });

  return (
    <div className={embedded ? "space-y-4" : "space-y-4 p-6"}>
      {embedded ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">{model.counts.total} Issues</p>
          <CreateIssueDialog canDocument={caps.canDocument} {...createProps} {...featureProps} />
        </div>
      ) : (
        <header className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-heading text-2xl font-semibold">Issues</h1>
            <p className="text-sm text-muted-foreground">
              {model.counts.total} Issues — verschachtelbar unter einem Head-Issue.
            </p>
          </div>
          <CreateIssueDialog canDocument={caps.canDocument} {...createProps} {...featureProps} />
        </header>
      )}

      {canReparent && dnd.dragging && (
        <div
          onDragOver={rootZone.onDragOver}
          onDragLeave={rootZone.onDragLeave}
          onDrop={rootZone.onDrop}
          className={`sticky top-2 z-10 ${dropZoneClass(rootZone.isOver)}`}
        >
          Auf oberste Ebene (aus dem Head lösen) — hier ablegen
        </div>
      )}

      {model.matrix.plots.length > 0 && (
        <PageSection title="Risk-Matrix">
          <RiskMatrix
            cells={model.matrix.cells}
            plots={model.matrix.plots.map((p) => ({
              riskId: p.issueId,
              displayNumber: p.displayNumber,
              roamStatus: p.roamStatus,
              trail: p.trail,
            }))}
          />
        </PageSection>
      )}

      {caps.canReview && model.suggestions.length > 0 && (
        <PageSection title={`Vorschläge (${model.suggestions.length})`}>
          <ul className="divide-y rounded-lg border">
            {model.suggestions.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 p-3">
                <button
                  type="button"
                  className="text-left text-sm hover:underline"
                  onClick={() => push({ issue: s.id })}
                >
                  {s.title}
                </button>
                <ReviewButtons id={s.id} />
              </li>
            ))}
          </ul>
        </PageSection>
      )}

      <IssuesFunnelBar
        counts={model.roamFunnel}
        activeRoam={roam}
        onRoamChange={(v) => push({ roam: v })}
      />

      <IssuesFilterBar
        query={query}
        category={category}
        ownerId={ownerId}
        sort={sort}
        density={density}
        categoryOptions={model.facets.categories}
        ownerOptions={model.facets.owners}
        onQueryChange={(v) => push({ q: v })}
        onCategoryChange={(v) => push({ category: v })}
        onOwnerChange={(v) => push({ owner: v })}
        onSortChange={(v) => push({ sort: v === DEFAULT_SORT ? null : v })}
        onDensityChange={(v) => push({ density: v === "comfortable" ? null : v })}
      />

      <IssuesListTable rows={filteredRows} compact={density === "compact"} dnd={canReparent ? dnd : null} />

      <IssueDetailDrawer
        issues={allRows}
        userLabels={userLabels}
        caps={caps}
        {...featureProps}
      />
    </div>
  );
}

const initialState: ActionState = {};

function ReviewButtons({ id }: { id: string }) {
  const [, action, pending] = useActionState(reviewIssueAction, initialState);
  return (
    <div className="flex items-center gap-2">
      <form action={action}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="decision" value="accept" />
        <Button type="submit" size="sm" disabled={pending}>
          Dokumentieren
        </Button>
      </form>
      <form action={action}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="decision" value="reject" />
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          Ablehnen
        </Button>
      </form>
    </div>
  );
}
