"use client";

import { useActionState, useEffect, useMemo, useRef, type ReactNode } from "react";
import { useUrlState } from "@/lib/hooks/use-url-state";
import { Button } from "@/components/ui/button";
import { Page, PageHeader } from "@/components/layout";
import type { IssuesListModel, IssueListRow } from "@/modules/risks/server/views/issues-list";
import { wouldCreateCycle } from "@/modules/risks/domain/issue-tree";
import { RiskMatrix } from "@/modules/risks/features/risk/components/risk-matrix";
import { exposureRank, riskExposure } from "@/modules/core/kernel/domain/exposure";
import { ISSUE_GROUP_AXES, type IssueGroupAxis } from "@/modules/risks/domain/issue-grouping";
import { ROAM_STATUSES, normalizeRoamStatus } from "@/modules/core/kernel/domain/roam";
import { buildFunnelCounts } from "@/server/views/lib/page-model-utils";
import { ChevronDown } from "lucide-react";
import type { ExposureBand } from "@/modules/risks/domain/risk-matrix";
import { reviewIssueAction } from "@/modules/risks/features/issue/actions/issue";
import type { ActionState } from "@/server/http/server-action";
import {
  IssueDetailDrawer,
  type IssueCaps,
} from "@/modules/risks/features/issue/components/issue-detail-drawer";
import { CreateIssueDialog } from "@/modules/risks/features/issue/components/create-issue-dialog";
import { IssuesFunnelBar } from "@/modules/risks/features/issue/components/issues-funnel-bar";
import { SavedFilterControls } from "@/components/ui/saved-filter-controls";
import type { SavedFilterDTO } from "@/server/services/saved-filter";
import {
  criteriaFromParams,
  criteriaToParams,
  hasAnyCriteria,
} from "@/modules/risks/domain/issue-filter-keys";
import {
  saveIssueFilterAction,
  deleteIssueFilterAction,
} from "@/modules/risks/features/issue/actions/saved-filter";
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
  /**
   * Persönlich gespeicherte Filter dieser Fläche. Im Epic-Reiter gibt es keine
   * — dort trägt die URL die Filter nicht, und ein Filter, den man nicht
   * anwenden kann, gehört nicht auf die Fläche.
   */
  savedFilters?: SavedFilterDTO[];
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

const isGroupAxis = (v: string | null): v is IssueGroupAxis =>
  v != null && (ISSUE_GROUP_AXES as readonly string[]).includes(v);

const isSort = (v: string | null): v is IssueSortKey =>
  v === "created:desc" || v === "daysOpen:desc" || v === "exposure:desc" || v === "title:asc";

export function IssuesListShell({
  model,
  userLabels,
  caps,
  initiativeId,
  featureOptions,
  embedded,
  savedFilters = [],
}: Props) {
  const { params, push } = useUrlState();
  const rootRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Die Höhe der Klebeleiste als CSS-Variable an der Wurzel: `TREE_THEAD` liest
  // sie als `top`. Ein `ResizeObserver` statt einer einmaligen Messung, weil die
  // Chip-Reihe bei schmalem Fenster umbricht.
  useEffect(() => {
    const bar = toolbarRef.current;
    const root = rootRef.current;
    if (!bar || !root) return;
    const setzen = () =>
      root.style.setProperty("--issues-toolbar-h", `${Math.round(bar.offsetHeight)}px`);
    setzen();
    const ro = new ResizeObserver(setzen);
    ro.observe(bar);
    return () => ro.disconnect();
  }, []);

  const roamParam = params.get("roam") ?? "";
  const categoryParam = params.get("category") ?? "";
  const ownerParam = params.get("owner") ?? "";
  const bandParam = params.get("band") ?? "";
  const vsParam = params.get("vs") ?? "";
  const artParam = params.get("art") ?? "";
  const query = params.get("q") ?? "";
  const sort = isSort(params.get("sort")) ? (params.get("sort") as IssueSortKey) : DEFAULT_SORT;
  const density = (params.get("density") === "compact" ? "compact" : "comfortable") as IssueDensity;
  const group = isGroupAxis(params.get("group"))
    ? (params.get("group") as IssueGroupAxis)
    : "flach";
  const aufParam = params.get("auf") ?? "";

  const split = (s: string): string[] => (s ? s.split(",").filter(Boolean) : []);
  const roams = split(roamParam);
  const categories = split(categoryParam);
  const owners = split(ownerParam);
  const bands = split(bandParam);
  const valueStreams = split(vsParam);
  const arts = split(artParam);
  const setParam = (key: string, arr: string[]) =>
    push({ [key]: arr.length ? arr.join(",") : null });

  // **Aufgeklappt ist die Ausnahme, nicht die Regel.** In der URL steht deshalb
  // die kleine Menge (die geöffneten Heads), nicht die grosse. `alle` ist der
  // Sonderfall, den „alle aufklappen" schreibt — sonst stünden 73 Ids im Link.
  const expanded: ReadonlySet<string> | "alle" =
    aufParam === "alle" ? "alle" : new Set(split(aufParam));
  const toggleRow = (id: string) => {
    if (expanded === "alle") {
      // Aus „alle offen" heraus eine Zeile zu schliessen heisst: alle anderen
      // bleiben offen — das sind die Ids, die jetzt in die URL müssen.
      const rest = headIds.filter((h) => h !== id);
      push({ auf: rest.length ? rest.join(",") : null });
      return;
    }
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    push({ auf: next.size ? [...next].join(",") : null });
  };

  // Was gerade eingestellt ist — Facetten, Suche **und** Ansicht. Beim Anwenden
  // geht derselbe Satz zurück in die URL; `f: "0"` fällt dabei weg, weil ein
  // angewandter Filter das Gegenteil von „bewusst leer" ist.
  const criteria = criteriaFromParams((k) => params.get(k));
  const applySaved = (c: typeof criteria) => push({ ...criteriaToParams(c), f: null });
  // `f: "0"` ist der Marker „bewusst leer": ohne ihn wäre zurückgesetzt nicht
  // von „frisch geöffnet" zu unterscheiden, und der Standard schlüge sofort
  // wieder zu.
  const clearAll = () =>
    push({
      q: null,
      roam: null,
      category: null,
      owner: null,
      band: null,
      vs: null,
      art: null,
      f: "0",
    });

  const canReparent = caps.canUpdate;
  const parentOf = useMemo(() => new Map(model.rows.map((r) => [r.id, r.parentId])), [model.rows]);
  const dnd = useIssueTreeDnd({
    isDescendant: (ancestorId, maybeDescId) => wouldCreateCycle(ancestorId, maybeDescId, parentOf),
  });

  // **Zwei Mengen aus einem Filterlauf.** `base` trägt alle Filter **ausser**
  // ROAM — daraus zählen die Funnel-Chips, sonst stünde nach einem Klick auf
  // „Owned" bei allen anderen Dispositionen eine 0, und die Leiste könnte nicht
  // mehr sagen, wohin man wechseln kann. `rows` trägt zusätzlich ROAM und ist,
  // was die Tabelle und die Matrix zeigen.
  const { base, filteredRows } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const roamSet = new Set(split(roamParam));
    const catSet = new Set(split(categoryParam));
    const ownerSet = new Set(split(ownerParam));
    const bandSet = new Set(split(bandParam));
    const vsSet = new Set(split(vsParam));
    const artSet = new Set(split(artParam));
    const rows = model.rows.filter((r) => {
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
    const sorted = rows.slice().sort(compareBy(sort));
    return {
      base: sorted,
      filteredRows: roamSet.size ? sorted.filter((r) => roamSet.has(r.roamStatus)) : sorted,
    };
  }, [model.rows, roamParam, categoryParam, ownerParam, bandParam, vsParam, artParam, query, sort]);

  // Die Chips zählen dieselbe Menge, die Tabelle und Matrix zeigen — bis auf die
  // Achse, die sie selbst schalten.
  const funnelCounts = useMemo(
    () => buildFunnelCounts(base, ROAM_STATUSES, (r) => normalizeRoamStatus(r.roamStatus)),
    [base],
  );

  // Matrix folgt denselben Filtern wie die Tabelle: Plots auf die gefilterten
  // Issue-Ids einschränken. **Gezählt wird nicht mehr hier** — die Matrix zählt
  // die Punkte, die sie zeichnet; zwei Zähler für dieselbe Zelle waren einer
  // zu viel.
  const filteredIssueIds = new Set(filteredRows.map((r) => r.id));
  const filteredPlots = model.matrix.plots.filter((p) => filteredIssueIds.has(p.issueId));

  // Was der zugeklappte Streifen verrät: wie viele Zeichen im Raster stehen und
  // wie viele davon im obersten Band — die Zahl, wegen der man ihn aufmacht.
  const criticalPlots = filteredPlots.filter((p) => {
    const cur = p.trail[p.trail.length - 1];
    return cur ? riskExposure(cur.probability, cur.impact).band === "critical" : false;
  }).length;

  // **Der Kopf zählt, was die Seite zeigt.** Bis September 2026 stand dort die
  // ungefilterte Gesamtzahl, während Matrix und Tabelle darunter gefiltert
  // waren — wer filterte, las auf einer Seite zwei Wahrheiten.
  const countLabel =
    filteredRows.length === model.counts.total
      ? `${model.counts.total} Issues`
      : `${filteredRows.length} von ${model.counts.total} Issues`;

  // Die Heads, die überhaupt etwas zum Aufklappen haben — Grundlage für
  // „alle auf/zu" und für die `disabled`-Zustände der beiden Knöpfe.
  const headIds = model.rows.filter((r) => (r.rollup?.descendantCount ?? 0) > 0).map((r) => r.id);
  const alleAuf =
    expanded === "alle" || (headIds.length > 0 && headIds.every((h) => expanded.has(h)));
  const alleZu = expanded !== "alle" && headIds.every((h) => !expanded.has(h));

  const allRows = [...model.rows, ...model.suggestions];
  const createProps = initiativeId ? { initiativeId } : {};
  const featureProps = featureOptions ? { featureOptions } : {};
  const rootZone = dnd.dropProps({ kind: "root" });

  const createAction = (
    <CreateIssueDialog canDocument={caps.canDocument} {...createProps} {...featureProps} />
  );

  const content = (
    <div ref={rootRef} className="space-y-4">
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

      {/* **Das Register führt.** Matrix und Vorschläge standen bis September 2026
          in voller Höhe über der Liste — zusammen 970 px, bei 1051 px sichtbarer
          Höhe: auf einer Seite namens „Issues" war ohne Scrollen kein Issue zu
          sehen. Sie stehen weiter oben, aber als Streifen, der seine Zahl schon
          zugeklappt trägt. */}
      {filteredPlots.length > 0 && (
        // Der Tour-Anker steht hier als **Literal** und an einem Element, das
        // auch zugeklappt im DOM ist: drei geführte Touren zeigen darauf, und
        // der Wächter (`emittedAnchors`) liest den Quelltext nach
        // `data-tour="…"` ab — eine durchgereichte Prop fände er nicht.
        <div data-tour="risk-matrix">
          <CollapsibleStrip
            urlKey="matrix"
            label="Risk-Matrix"
            note={`${filteredPlots.length} Head-Issue${filteredPlots.length === 1 ? "" : "s"}${
              criticalPlots > 0 ? ` · ${criticalPlots} kritisch` : ""
            }`}
            open={params.get("matrix") === "1"}
            onToggle={(next) => push({ matrix: next ? "1" : null })}
          >
            <RiskMatrix
              cells={model.matrix.cells}
              plots={filteredPlots.map((p) => ({
                riskId: p.issueId,
                displayNumber: p.displayNumber,
                title: p.title,
                roamStatus: p.roamStatus,
                trail: p.trail,
              }))}
            />
          </CollapsibleStrip>
        </div>
      )}

      {caps.canReview && model.suggestions.length > 0 && (
        <CollapsibleStrip
          urlKey="vorschlaege"
          label="Vorschläge"
          note={`${model.suggestions.length} warte${model.suggestions.length === 1 ? "t" : "n"} auf Prüfung`}
          open={params.get("vorschlaege") === "1"}
          onToggle={(next) => push({ vorschlaege: next ? "1" : null })}
        >
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
        </CollapsibleStrip>
      )}

      {/* **Die Bedienleiste klebt.** Bei 148 Issues ist die Tabelle 5,7
          Bildschirme lang; ohne das sind Chips, Filter und Spaltenkopf nach dem
          ersten Bildschirm weg, und wer nachfiltern will, scrollt fünf
          Bildschirme zurück. Ihre Höhe wandert als CSS-Variable an die Wurzel,
          weil der Spaltenkopf darunter kleben muss und die Chip-Reihe umbrechen
          kann — eine Zahl in einer Klasse wäre dann falsch. */}
      <div ref={toolbarRef} className="sticky top-0 z-30 space-y-2 bg-background py-2">
        {/* Die gespeicherten Filter teilen sich die Zeile mit den ROAM-Chips:
            rechts ist dort Platz, und ihre eigenen Chips landen in einer Zeile,
            die ohnehin eine Chip-Zeile ist. Die klebende Leiste wächst dadurch
            nur, wenn es überhaupt gespeicherte Filter gibt. */}
        <div className="flex flex-wrap items-center gap-2">
          <IssuesFunnelBar
            counts={funnelCounts}
            activeRoams={roams}
            onToggleRoam={(s) =>
              setParam("roam", roams.includes(s) ? roams.filter((r) => r !== s) : [...roams, s])
            }
            onClear={() => push({ roam: null })}
          />
          {!embedded && (
            <SavedFilterControls
              filters={savedFilters}
              criteria={criteria}
              anyActive={hasAnyCriteria(criteria)}
              onApply={applySaved}
              saveAction={saveIssueFilterAction}
              deleteAction={deleteIssueFilterAction}
            />
          )}
        </div>

        <IssuesFilterBar
          query={query}
          roams={roams}
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
          onClearAll={clearAll}
          onSortChange={(v) => push({ sort: v === DEFAULT_SORT ? null : v })}
          onDensityChange={(v) => push({ density: v === "comfortable" ? null : v })}
          group={group}
          onGroupChange={(v) => push({ group: v === "flach" ? null : v })}
          {...(headIds.length > 0
            ? {
                tree: {
                  alleAuf,
                  alleZu,
                  onAlleAuf: () => push({ auf: "alle" }),
                  onAlleZu: () => push({ auf: null }),
                },
              }
            : {})}
        />
      </div>

      <IssuesListTable
        rows={filteredRows}
        compact={density === "compact"}
        dnd={canReparent ? dnd : null}
        group={group}
        expanded={expanded}
        onToggleRow={toggleRow}
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
          <p className="text-sm text-muted-foreground">{countLabel}</p>
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
        subtitle={`${countLabel} — Risiken & Impedimente je ART/Epic, verschachtelbar unter einem Head-Issue.`}
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

/**
 * **Ein Streifen, der seine Zahl schon zugeklappt trägt.**
 *
 * Zugeklappt eine Zeile: Name, die Kennzahl, ein Chevron. Aufgeklappt steht der
 * Inhalt in voller Grösse darunter — derselbe Block wie vorher, nur nicht mehr
 * ungefragt.
 *
 * Der Zustand steht **in der URL**, wie jeder andere Filter dieser Fläche: ein
 * weitergegebener Link zeigt dann, was der Absender gesehen hat.
 */
function CollapsibleStrip({
  urlKey,
  label,
  note,
  open,
  onToggle,
  children,
}: {
  urlKey: string;
  label: string;
  note: string;
  open: boolean;
  onToggle: (next: boolean) => void;
  children: ReactNode;
}) {
  const panelId = `strip-${urlKey}`;
  return (
    <section>
      <button
        type="button"
        onClick={() => onToggle(!open)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center gap-2 rounded-lg bg-card px-3 py-2 text-left shadow-card hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="text-label font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          {label}
        </span>
        <span className="text-xs tabular-nums text-muted-foreground">{note}</span>
        <ChevronDown
          aria-hidden
          className={`ml-auto size-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open && (
        <div id={panelId} className="mt-2">
          {children}
        </div>
      )}
    </section>
  );
}
