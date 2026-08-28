"use client";

import { useActionState, useMemo } from "react";
import { useUrlState } from "@/lib/hooks/use-url-state";
import { Button } from "@/components/ui/button";
import { Page, PageHeader, PageSection } from "@/components/layout";
import type { IssuesListModel, IssueListRow } from "@/modules/risks/server/views/issues-list";
import { wouldCreateCycle } from "@/modules/risks/domain/issue-tree";
import { RiskMatrix } from "@/modules/risks/features/risk/components/risk-matrix";
import { exposureRank } from "@/modules/risks/features/lib/issue-badges";
import type { ExposureBand } from "@/modules/risks/domain/risk-matrix";
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

const DEFAULT_SORT: IssueSortKey = "created:desc";

function rowRank(r: IssueListRow): number {
  return exposureRank(r.band as ExposureBand | null);
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

export function IssuesListShell({
  model,
  userLabels,
  caps,
  initiativeId,
  featureOptions,
  embedded,
}: Props) {
  const { params, push } = useUrlState();

  const roamParam = params.get("roam") ?? "";
  const categoryParam = params.get("category") ?? "";
  const ownerParam = params.get("owner") ?? "";
  const bandParam = params.get("band") ?? "";
  const vsParam = params.get("vs") ?? "";
  const artParam = params.get("art") ?? "";
  const query = params.get("q") ?? "";
  const sort = isSort(params.get("sort")) ? (params.get("sort") as IssueSortKey) : DEFAULT_SORT;
  const density = (params.get("density") === "compact" ? "compact" : "comfortable") as IssueDensity;

  const split = (s: string): string[] => (s ? s.split(",").filter(Boolean) : []);
  const roams = split(roamParam);
  const categories = split(categoryParam);
  const owners = split(ownerParam);
  const bands = split(bandParam);
  const valueStreams = split(vsParam);
  const arts = split(artParam);
  const setParam = (key: string, arr: string[]) =>
    push({ [key]: arr.length ? arr.join(",") : null });

  const canReparent = caps.canUpdate;
  const parentOf = useMemo(() => new Map(model.rows.map((r) => [r.id, r.parentId])), [model.rows]);
  const dnd = useIssueTreeDnd({
    isDescendant: (ancestorId, maybeDescId) => wouldCreateCycle(ancestorId, maybeDescId, parentOf),
  });

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const roamSet = new Set(split(roamParam));
    const catSet = new Set(split(categoryParam));
    const ownerSet = new Set(split(ownerParam));
    const bandSet = new Set(split(bandParam));
    const vsSet = new Set(split(vsParam));
    const artSet = new Set(split(artParam));
    const rows = model.rows.filter((r) => {
      if (roamSet.size && !roamSet.has(r.roamStatus)) return false;
      if (catSet.size && (!r.category || !catSet.has(r.category))) return false;
      if (ownerSet.size && (!r.ownerId || !ownerSet.has(r.ownerId))) return false;
      if (bandSet.size && (!r.band || !bandSet.has(r.band))) return false;
      if (vsSet.size && (!r.valueStreamId || !vsSet.has(r.valueStreamId))) return false;
      if (artSet.size && (!r.artId || !artSet.has(r.artId))) return false;
      if (q) {
        const hay = `${r.title} ${r.description ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    return rows.slice().sort(compareBy(sort));
  }, [model.rows, roamParam, categoryParam, ownerParam, bandParam, vsParam, artParam, query, sort]);

  // Matrix folgt denselben Filtern wie die Tabelle: Plots auf die gefilterten
  // Issue-Ids einschränken und die Zell-Zähler daraus neu rechnen.
  const filteredIssueIds = new Set(filteredRows.map((r) => r.id));
  const filteredPlots = model.matrix.plots.filter((p) => filteredIssueIds.has(p.issueId));
  const matrixCells = (() => {
    const counts = new Map<string, number>();
    for (const p of filteredPlots) {
      const cur = p.trail[p.trail.length - 1];
      if (cur) {
        const k = `${cur.probability}:${cur.impact}`;
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
    }
    return model.matrix.cells.map((c) => ({
      ...c,
      count: counts.get(`${c.probability}:${c.impact}`) ?? 0,
    }));
  })();

  const allRows = [...model.rows, ...model.suggestions];
  const createProps = initiativeId ? { initiativeId } : {};
  const featureProps = featureOptions ? { featureOptions } : {};
  const rootZone = dnd.dropProps({ kind: "root" });

  const createAction = (
    <CreateIssueDialog canDocument={caps.canDocument} {...createProps} {...featureProps} />
  );

  const content = (
    <div className="space-y-4">
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

      {filteredPlots.length > 0 && (
        <PageSection title="Risk-Matrix">
          <RiskMatrix
            cells={matrixCells}
            plots={filteredPlots.map((p) => ({
              riskId: p.issueId,
              displayNumber: p.displayNumber,
              title: p.title,
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
        activeRoams={roams}
        onToggleRoam={(s) =>
          setParam("roam", roams.includes(s) ? roams.filter((r) => r !== s) : [...roams, s])
        }
        onClear={() => push({ roam: null })}
      />

      <IssuesFilterBar
        query={query}
        categories={categories}
        owners={owners}
        bands={bands}
        valueStreams={valueStreams}
        arts={arts}
        sort={sort}
        density={density}
        categoryOptions={model.facets.categories}
        ownerOptions={model.facets.owners}
        valueStreamOptions={model.facets.valueStreams}
        artOptions={model.facets.arts}
        onQueryChange={(v) => push({ q: v || null })}
        onCategoriesChange={(v) => setParam("category", v)}
        onOwnersChange={(v) => setParam("owner", v)}
        onBandsChange={(v) => setParam("band", v)}
        onValueStreamsChange={(v) => setParam("vs", v)}
        onArtsChange={(v) => setParam("art", v)}
        onSortChange={(v) => push({ sort: v === DEFAULT_SORT ? null : v })}
        onDensityChange={(v) => push({ density: v === "comfortable" ? null : v })}
      />

      <IssuesListTable
        rows={filteredRows}
        compact={density === "compact"}
        dnd={canReparent ? dnd : null}
      />

      <IssueDetailDrawer issues={allRows} userLabels={userLabels} caps={caps} {...featureProps} />
    </div>
  );

  // Epic-Tab: eingebettet, ohne PageHeader/-Rahmen. Standalone `/issues`: der
  // geteilte App-Rahmen wie überall.
  if (embedded) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">{model.counts.total} Issues</p>
          {createAction}
        </div>
        {content}
      </div>
    );
  }

  return (
    <Page>
      <PageHeader
        title="Issues · Risiko-Register"
        subtitle={`${model.counts.total} Issues — Risiken & Impedimente je ART/Epic, verschachtelbar unter einem Head-Issue.`}
        actions={createAction}
      />
      {content}
    </Page>
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
