import type { PrismaClient } from "@/generated/prisma";
import type { Principal } from "@/server/auth/principal";
import { hasCapability } from "@/server/auth/authorize";
import { listTenantUserLabels } from "@/server/services/tenant-users";
import { InitiativeLevel } from "@/modules/core/kernel/domain/types";
import { classifyScopedEdges } from "@/modules/drumbeat/domain/graph-scope";
import type { PiWindow } from "@/modules/drumbeat/domain/timeline-grid";

/**
 * Delivery-Cockpit view-model (Umsetzungs-Modul-Redesign Phase 1).
 *
 * Eine einzige Page (/umsetzung) tritt an die Stelle von Hub +
 * PI-Workspace + ART-Hub. Daten teilen sich Board / Tabelle / Roadmap;
 * dieser Loader liefert sie konsolidiert. Slide-Over fuer Feature-Detail
 * faehrt eine separate Lookup-Route (P5).
 *
 * Scope-Default per Entscheidung #2: Single-ART direkt rein, Multi-ART
 * Picker mit Last-used. „Last used" wird im MVP via URL-Param ausgedrueckt
 * (`?art=<id>`); Persistenz per Cookie ist ein Folgeschritt.
 */

export type CockpitView = "board" | "table" | "roadmap" | "network";
export type FeatureStatus = "approved" | "in_progress" | "blocked" | "completed" | "cancelled";

export interface CockpitArtRef {
  id: string;
  name: string;
  valueStreamName: string | null;
  /** Anzahl Features im aktiven PI dieser ART — fuer den Multi-ART-Picker. */
  activeFeatureCount: number;
}

export interface CockpitPiSlot {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  status: string;
  /** Anzahl Features im aktuell ausgewaehlten Scope, die in diesem PI sitzen. */
  featureCount: number;
  /** True wenn dieser PI das aktuelle „jetzt"-PI ist (laut Datum). */
  isCurrent: boolean;
}

export interface CockpitFeature {
  id: string;
  title: string;
  status: FeatureStatus;
  piId: string | null;
  artId: string;
  artName: string;
  /** Parent-Epic-Bezug — Cockpit-Roadmap gruppiert die Features
   *  darunter (Linear/Productboard-Pattern). Null = Orphan-Feature. */
  parentId: string | null;
  parentTitle: string | null;
  ownerId: string | null;
  /** UI loest Owner-Namen separat auf (Auth-Provider) — fuer Avatare /
   *  Inline-Anzeige. Null wenn unbekannt. */
  ownerName: string | null;
  wsjfComputed: number | null;
  /** True wenn das Feature mind. eine eingehende `blocks`-Dependency hat,
   *  die noch nicht abgeschlossen ist — gibt Board-Card das ⚠-Signal. */
  hasBlocker: boolean;
  /** Erste blockierende Quelle, fuer den Karten-Hinweis „blockt durch X". */
  blockerHint: string | null;
}

export interface CockpitPermissions {
  /** ART-scoped `feature.update` — PI-Wechsel + Inline-Edits. */
  canUpdate: boolean;
  /** Tenant-scoped `feature.delivery.set` — Status-Wechsel. */
  canSetDelivery: boolean;
  /** ART-scoped `feature.create`. */
  canCreate: boolean;
  /** ART-scoped `dependency.link` — Dep anlegen / loeschen / Typ wechseln
   *  via Cockpit-Roadmap + Cockpit-Netzplan. */
  canLinkDependency: boolean;
}

export interface CockpitFilters {
  status: FeatureStatus[];
  ownerIds: string[];
  epicIds: string[];
  hasBlocker: boolean;
}

/**
 * PI date-window feeding the Roadmap view. The canonical `PiWindow`
 * (id/name/start/end) lives in the cadence/timeline domain; the cockpit uses
 * it whole under its own name.
 */
export type CockpitPiWindow = PiWindow;

export interface CockpitModel {
  /** Welche ARTs der User sehen darf, ggf. mit aktivem-PI-Feature-Count. */
  availableArts: CockpitArtRef[];
  /** Aktuell ausgewaehlte ART. `null` wenn der User keinen Scope hat. */
  selectedArt: CockpitArtRef | null;
  /** 5 PIs: aktueller + 1 vor + 3 nach (Entscheidung #10). Leer wenn ART
   *  keine Timeline hat oder die Timeline keine PIs. */
  piStrip: CockpitPiSlot[];
  /** Alle PIs der Timeline (oder Direct-ART) — Datumsfenster fuer die
   *  Roadmap-Sicht. Board + Tabelle nutzen nur den piStrip. */
  allPiWindows: CockpitPiWindow[];
  /** Default-Sicht ist „board" (Entscheidung #1); URL-Param ueberschreibt. */
  view: CockpitView;
  /** Features im aktuell ausgewaehlten Scope, ggf. weitergefiltert. */
  features: CockpitFeature[];
  /** Aktive Filter, gespiegelt aus dem URL-State fuer Rendering der Chips. */
  filters: CockpitFilters;
  /** Alle Feature-Feature-Dependencies, die mindestens einen Endpunkt im
   *  aktuellen Scope haben — fuer Roadmap-Pfeile + Netzplan-Sicht.
   *  Edges mit beiden Endpunkten im Scope sind voll renderbar; Edges
   *  mit `offScopeRole != null` werden als Off-Scope-Marker angezeigt. */
  dependencies: CockpitDependency[];
  permissions: CockpitPermissions;
}

export interface CockpitDependency {
  id: string;
  fromId: string;
  toId: string;
  type: "blocks" | "depends_on" | "relates_to";
  /** "from" wenn der Source-Knoten ausserhalb des Scopes liegt
   *  (Predecessor-Ghost); "to" wenn der Target-Knoten ausserhalb liegt
   *  (Successor-Ghost); `null` wenn beide Endpunkte im Scope sind. */
  offScopeRole: "from" | "to" | null;
  /** Titel des Off-Scope-Knotens fuer Tooltip. Bei `offScopeRole === null` null. */
  offScopeLabel: string | null;
}

export interface LoadCockpitInput {
  /** Aktuell ausgewaehlter ART-Scope. Bei `null` waehlt der Loader die
   *  erste verfuegbare ART (oder bleibt scope-los). */
  artId?: string | undefined;
  view?: CockpitView | undefined;
  filters?: Partial<CockpitFilters> | undefined;
}

const DEFAULT_FILTERS: CockpitFilters = {
  status: [],
  ownerIds: [],
  epicIds: [],
  hasBlocker: false,
};

/**
 * Waehlt den „aktuellen" PI aus einer chronologisch sortierten Liste —
 * das erste PI dessen Datum heute enthaelt, sonst das naechstgelegene in
 * der Zukunft, sonst das letzte vergangene.
 */
export function pickCurrentPiIndex(
  pis: ReadonlyArray<{ startDate: Date; endDate: Date }>,
  now: number = Date.now(),
): number {
  if (pis.length === 0) return -1;
  for (let i = 0; i < pis.length; i++) {
    const p = pis[i]!;
    if (p.startDate.getTime() <= now && now <= p.endDate.getTime()) return i;
  }
  for (let i = 0; i < pis.length; i++) {
    if (pis[i]!.startDate.getTime() > now) return i;
  }
  return pis.length - 1;
}

/** Schneidet ein Fenster aus 5 PIs aus: aktueller + 1 vor + 3 nach. */
export function takePiWindow<T>(pis: readonly T[], currentIdx: number): T[] {
  if (currentIdx < 0) return [];
  const start = Math.max(0, currentIdx - 1);
  const end = Math.min(pis.length, currentIdx + 4);
  return pis.slice(start, end);
}

// ---------------------------------------------------------------------------
// Loader/Builder split
//
// `loadCockpitModel` (the exported entry, unchanged signature) is now a thin
// Prisma fan-out: it runs the reads, shapes the raw rows into `CockpitRows`,
// and hands them to the pure `buildCockpitModel`, which does ALL derivation.
//
// The fan-out is inherently sequential (later queries are scoped by earlier
// results), so the loader still resolves the *selected ART id* to scope the
// PI/feature queries. Every other derivation — the active-PI fallback, the
// current-PI window, blocker detection, off-scope classification — lives in
// the builder and is unit-tested off-DB. Where a query would otherwise need a
// derived value to scope itself, the loader over-fetches (all active PIs, all
// strip PIs, the pre-`hasBlocker` feature set) and lets the builder narrow —
// the model output is identical either way.
// ---------------------------------------------------------------------------

/** Raw ART row (query 1). */
export interface CockpitArtRow {
  id: string;
  name: string;
  timelineId: string | null;
  valueStream: { name: string } | null;
}

/** Raw active-PI row (query 2) — feeds the timeline-vs-direct-ART fallback. */
export interface CockpitActivePiRow {
  id: string;
  artId: string | null;
  timelineId: string | null;
}

/** Raw active-PI feature count (query 3), grouped by `artId` × `piId`. */
export interface CockpitActiveFeatureCountRow {
  artId: string | null;
  piId: string | null;
  count: number;
}

/** Raw PI row of the selected ART's timeline (query 4). */
export interface CockpitAllPiRow {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  status: string;
}

/** Raw per-PI feature count for the selected ART (query 5). */
export interface CockpitWindowCountRow {
  piId: string | null;
  count: number;
}

/** Raw feature row of the selected ART (query 6). */
export interface CockpitFeatureRow {
  id: string;
  title: string;
  status: string;
  piId: string | null;
  artId: string | null;
  parentId: string | null;
  ownerId: string | null;
  wsjfComputed: unknown;
  art: { id: string; name: string } | null;
  parent: { id: string; title: string } | null;
  dependenciesIn: ReadonlyArray<{
    id: string;
    from: { id: string; title: string; status: string } | null;
  }>;
}

/** Raw dependency row touching the feature scope (query 7). */
export interface CockpitDepRow {
  id: string;
  fromId: string;
  toId: string;
  type: string;
  from: { id: string; title: string } | null;
  to: { id: string; title: string } | null;
}

/** Everything the pure builder needs — the loader's sole output. */
export interface CockpitRows {
  arts: ReadonlyArray<CockpitArtRow>;
  activePis: ReadonlyArray<CockpitActivePiRow>;
  activeFeatureCounts: ReadonlyArray<CockpitActiveFeatureCountRow>;
  /** Resolved in the loader (scopes queries 4–6); the builder rebuilds the
   *  `selectedArt` ref from it. `null` when the user has no ART scope. */
  selectedArtId: string | null;
  allPis: ReadonlyArray<CockpitAllPiRow>;
  windowCounts: ReadonlyArray<CockpitWindowCountRow>;
  featureRows: ReadonlyArray<CockpitFeatureRow>;
  depRows: ReadonlyArray<CockpitDepRow>;
  permissions: CockpitPermissions;
  view: CockpitView;
  filters: CockpitFilters;
  /** userId → display label; the builder resolves each feature's owner label
   *  from it (loaded in the loader so the builder stays pure). */
  userLabels: Record<string, string>;
  /** Injected so the builder stays pure (no wall-clock read). */
  now: number;
}

/**
 * Active PI per ART: a direct ART-scoped active PI wins, otherwise the active
 * PI on the ART's timeline (the timeline-vs-direct-ART fallback, formerly
 * inline in the loader). Pure.
 */
export function resolveActivePiByArt(
  arts: ReadonlyArray<{ id: string; timelineId: string | null }>,
  activePis: ReadonlyArray<{ id: string; artId: string | null; timelineId: string | null }>,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const a of arts) {
    const direct = activePis.find((p) => p.artId === a.id);
    if (direct) {
      map.set(a.id, direct.id);
      continue;
    }
    if (a.timelineId) {
      const viaTimeline = activePis.find((p) => p.timelineId === a.timelineId);
      if (viaTimeline) map.set(a.id, viaTimeline.id);
    }
  }
  return map;
}

/** The active ART: the requested one if visible, else the first available. Pure. */
export function resolveSelectedArtId(
  arts: ReadonlyArray<{ id: string }>,
  inputArtId: string | undefined,
): string | null {
  if (inputArtId && arts.some((a) => a.id === inputArtId)) return inputArtId;
  return arts[0]?.id ?? null;
}

/** Feature derivation + blocker detection + the `hasBlocker` filter. Pure. */
function buildScopeFeatures(
  rows: ReadonlyArray<CockpitFeatureRow>,
  hasBlockerFilter: boolean,
  userLabels: Record<string, string>,
): CockpitFeature[] {
  return rows
    .map((r) => {
      const openBlocker = r.dependenciesIn.find(
        (d) => d.from && d.from.status !== "completed" && d.from.status !== "cancelled",
      );
      const f: CockpitFeature = {
        id: r.id,
        title: r.title,
        status: r.status as FeatureStatus,
        piId: r.piId,
        artId: r.artId!,
        artName: r.art?.name ?? "",
        parentId: r.parentId ?? null,
        parentTitle: r.parent?.title ?? null,
        ownerId: r.ownerId,
        ownerName: r.ownerId ? (userLabels[r.ownerId] ?? null) : null,
        wsjfComputed: r.wsjfComputed ? Number(r.wsjfComputed) : null,
        hasBlocker: !!openBlocker,
        blockerHint: openBlocker?.from?.title ?? null,
      };
      return f;
    })
    .filter((f) => (hasBlockerFilter ? f.hasBlocker : true));
}

/**
 * Off-scope dependency classification. Reuses the canonical
 * `classifyScopedEdges` (graph-scope) and maps its `{ side }` result into the
 * Cockpit `offScopeRole`/`offScopeLabel` shape. Pure.
 */
function buildScopeDependencies(
  depRows: ReadonlyArray<CockpitDepRow>,
  features: ReadonlyArray<CockpitFeature>,
): CockpitDependency[] {
  if (features.length === 0) return [];
  const scopeIds = new Set(features.map((f) => f.id));
  const out: CockpitDependency[] = [];
  for (const s of classifyScopedEdges(depRows, scopeIds)) {
    const d = s.edge;
    const offScopeRole = s.offScopeEndpoint?.side ?? null;
    const offScopeLabel =
      offScopeRole === "from"
        ? (d.from?.title ?? null)
        : offScopeRole === "to"
          ? (d.to?.title ?? null)
          : null;
    out.push({
      id: d.id,
      fromId: d.fromId,
      toId: d.toId,
      type: d.type as CockpitDependency["type"],
      offScopeRole,
      offScopeLabel,
    });
  }
  return out;
}

/**
 * Pure derivation of the whole Cockpit read-model from raw rows. No I/O, no
 * wall-clock read (uses `rows.now`). Everything testable off-DB lives here.
 */
export function buildCockpitModel(rows: CockpitRows): CockpitModel {
  const {
    arts,
    activePis,
    activeFeatureCounts,
    selectedArtId,
    allPis,
    windowCounts,
    featureRows,
    depRows,
    permissions,
    view,
    filters,
    userLabels,
    now,
  } = rows;

  // availableArts — active-PI fallback + per-ART count (formerly two queries'
  // worth of derivation). Only ARTs that actually resolve an active PI get a
  // count; that count sums features sitting in ANY mapped active PI, matching
  // the original `artId ∈ keys, piId ∈ values` groupBy exactly.
  const activePiByArt = resolveActivePiByArt(arts, activePis);
  const activePiIds = new Set(activePiByArt.values());
  const availableArts: CockpitArtRef[] = arts.map((a) => {
    let activeFeatureCount = 0;
    if (activePiByArt.has(a.id)) {
      for (const r of activeFeatureCounts) {
        if (r.artId === a.id && r.piId != null && activePiIds.has(r.piId)) {
          activeFeatureCount += r.count;
        }
      }
    }
    return {
      id: a.id,
      name: a.name,
      valueStreamName: a.valueStream?.name ?? null,
      activeFeatureCount,
    };
  });

  const selectedArt = selectedArtId
    ? (availableArts.find((a) => a.id === selectedArtId) ?? null)
    : null;

  // PI-Strip — Roadmap braucht alle Fenster, Board/Tabelle nur den Strip.
  const allPiWindows: CockpitPiWindow[] = allPis.map((p) => ({
    id: p.id,
    name: p.name,
    startDate: p.startDate,
    endDate: p.endDate,
  }));
  let piStrip: CockpitPiSlot[] = [];
  if (selectedArt) {
    const currentIdx = pickCurrentPiIndex(allPis, now);
    // Expliziter Id-Vergleich statt `allPis.indexOf(p) === currentIdx`:
    // die Array-Identitaets-Falle (funktionierte nur, weil `slice` die
    // Referenzen erhaelt) faellt damit weg.
    const currentPiId = currentIdx >= 0 ? (allPis[currentIdx]?.id ?? null) : null;
    const windowPis = takePiWindow(allPis, currentIdx);
    const countByPi = new Map(windowCounts.map((c) => [c.piId, c.count]));
    piStrip = windowPis.map((p) => ({
      id: p.id,
      name: p.name,
      startDate: p.startDate,
      endDate: p.endDate,
      status: p.status,
      featureCount: countByPi.get(p.id) ?? 0,
      isCurrent: p.id === currentPiId,
    }));
  }

  const features = buildScopeFeatures(featureRows, filters.hasBlocker, userLabels);
  const dependencies = buildScopeDependencies(depRows, features);

  return {
    availableArts,
    selectedArt,
    piStrip,
    allPiWindows,
    view,
    features,
    filters,
    dependencies,
    permissions,
  };
}

/**
 * Thin Prisma fan-out for the Delivery-Cockpit read-model. Runs the 5 reads,
 * shapes the raw rows, and defers ALL derivation to `buildCockpitModel`.
 * Signature + return type unchanged — callers/pages are untouched.
 */
export async function loadCockpitModel(
  db: PrismaClient,
  principal: Principal,
  input: LoadCockpitInput = {},
): Promise<CockpitModel> {
  const { tenantId, scopes } = principal;
  const scopedArtIds = scopes.artIds;

  // Wave A — zwei voneinander unabhaengige Reads parallel:
  //   1) Welche ARTs darf der User sehen? (tenant + scope)
  //   2) Aktive PIs des Tenants — der Timeline-vs-Direct-ART-Fallback (jetzt im
  //      Builder) leitet daraus den aktiven PI je ART ab. (tenant + status)
  // Keiner konsumiert das Ergebnis des anderen -> ein Round-Trip statt zwei.
  const [arts, activePis, userLabels] = await Promise.all([
    db.art.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(scopedArtIds.length > 0 ? { id: { in: scopedArtIds } } : {}),
      },
      select: {
        id: true,
        name: true,
        timelineId: true,
        valueStream: { select: { name: true } },
      },
      orderBy: { name: "asc" },
    }),
    db.programIncrement.findMany({
      where: { tenantId, status: "active" },
      select: { id: true, artId: true, timelineId: true },
    }),
    // Owner-Labels (userId → Anzeigename) — für die Owner-Avatare auf den
    // Feature-Karten; im Loader geladen, damit der Builder rein bleibt.
    listTenantUserLabels(db, tenantId),
  ]);

  // Selected ART aufloesen — scoped Queries 4–6. (Reine Routing-Entscheidung;
  // der Builder baut die `selectedArt`-Ref daraus neu.) Rein aus `arts`
  // abgeleitet, also ohne Round-Trip; danach kann Wave B fahren.
  const selectedArtId = resolveSelectedArtId(arts, input.artId);
  const selectedArtRow = arts.find((a) => a.id === selectedArtId) ?? null;
  const filters: CockpitFilters = { ...DEFAULT_FILTERS, ...(input.filters ?? {}) };

  // Wave B — drei unabhaengige Zweige parallel. (3) haengt nur an Wave A
  //   (arts × activePis); (4→5) und (6→7) haengen nur an `selectedArtRow`
  //   bzw. dem jeweils vorigen Schritt ihrer eigenen Kette. Zwischen den drei
  //   Zweigen gibt es keine Abhaengigkeit -> parallel; die Ketten-Ordnung
  //   innerhalb (5 braucht `allPis`, 7 braucht `featureRows`) bleibt erhalten.
  const [activeFeatureCounts, pisResult, featuresResult] = await Promise.all([
    // 3) Feature-Count je ART × aktivem PI. Ueber-fetch (alle ARTs × alle
    //    aktiven PIs) statt den Fallback vorwegzunehmen — der Builder engt auf
    //    die gemappten Paare ein.
    (async (): Promise<CockpitActiveFeatureCountRow[]> => {
      if (arts.length === 0 || activePis.length === 0) return [];
      const grouped = await db.initiative.groupBy({
        by: ["artId", "piId"],
        where: {
          tenantId,
          level: InitiativeLevel.FEATURE,
          deletedAt: null,
          artId: { in: arts.map((a) => a.id) },
          piId: { in: activePis.map((p) => p.id) },
        },
        _count: { _all: true },
      });
      return grouped.map((g) => ({
        artId: g.artId,
        piId: g.piId,
        count: g._count._all,
      }));
    })(),
    // 4) PIs der Timeline (oder direkt der ART), chronologisch.
    // 5) Feature-Count je PI im ART-Scope — ueber ALLE Strip-PIs, der Builder
    //    fenstert. So braucht der Loader den `currentIdx` nicht.
    (async (): Promise<{ allPis: CockpitAllPiRow[]; windowCounts: CockpitWindowCountRow[] }> => {
      if (!selectedArtRow) return { allPis: [], windowCounts: [] };
      const allPis = await db.programIncrement.findMany({
        where: {
          tenantId,
          ...(selectedArtRow.timelineId
            ? { timelineId: selectedArtRow.timelineId }
            : { artId: selectedArtRow.id }),
        },
        select: { id: true, name: true, startDate: true, endDate: true, status: true },
        orderBy: { startDate: "asc" },
      });
      let windowCounts: CockpitWindowCountRow[] = [];
      if (allPis.length > 0) {
        const counts = await db.initiative.groupBy({
          by: ["piId"],
          where: {
            tenantId,
            level: InitiativeLevel.FEATURE,
            deletedAt: null,
            artId: selectedArtRow.id,
            piId: { in: allPis.map((p) => p.id) },
          },
          _count: { _all: true },
        });
        windowCounts = counts.map((c) => ({ piId: c.piId, count: c._count._all }));
      }
      return { allPis, windowCounts };
    })(),
    // 6) Features im Scope (SQL-Filter fuer status/owner/epic; der `hasBlocker`-
    //    Filter + Blocker-Erkennung sitzt im Builder).
    // 7) Dependencies mit mind. einem Endpunkt im (ungefilterten) Feature-Scope.
    //    Der Builder klassifiziert gegen den finalen (hasBlocker-gefilterten)
    //    Scope — Off-Scope-Ergebnis bleibt identisch.
    (async (): Promise<{ featureRows: CockpitFeatureRow[]; depRows: CockpitDepRow[] }> => {
      if (!selectedArtRow) return { featureRows: [], depRows: [] };
      const featureRows = await db.initiative.findMany({
        where: {
          tenantId,
          level: InitiativeLevel.FEATURE,
          deletedAt: null,
          artId: selectedArtRow.id,
          ...(filters.status.length > 0 ? { status: { in: filters.status } } : {}),
          ...(filters.ownerIds.length > 0 ? { ownerId: { in: filters.ownerIds } } : {}),
          ...(filters.epicIds.length > 0 ? { parentId: { in: filters.epicIds } } : {}),
        },
        select: {
          id: true,
          title: true,
          status: true,
          piId: true,
          artId: true,
          parentId: true,
          ownerId: true,
          wsjfComputed: true,
          art: { select: { id: true, name: true } },
          parent: { select: { id: true, title: true } },
          dependenciesIn: {
            where: { type: "blocks" },
            select: {
              id: true,
              from: { select: { id: true, title: true, status: true } },
            },
          },
        },
        orderBy: [{ wsjfComputed: "desc" }, { title: "asc" }],
      });
      let depRows: CockpitDepRow[] = [];
      if (featureRows.length > 0) {
        const scopeIds = featureRows.map((f) => f.id);
        depRows = await db.dependency.findMany({
          where: {
            tenantId,
            OR: [{ fromId: { in: scopeIds } }, { toId: { in: scopeIds } }],
          },
          select: {
            id: true,
            fromId: true,
            toId: true,
            type: true,
            from: { select: { id: true, title: true } },
            to: { select: { id: true, title: true } },
          },
        });
      }
      return { featureRows, depRows };
    })(),
  ]);

  const { allPis, windowCounts } = pisResult;
  const { featureRows, depRows } = featuresResult;

  // Permissions — aus dem zentralen Policies-Registry (ADR-0002). UI nutzt die
  // Flags nur fuer Affordances; der echte Gate sitzt serverseitig.
  const resource = selectedArtRow ? { tenantId, artId: selectedArtRow.id } : { tenantId };
  const permissions: CockpitPermissions = {
    canUpdate: hasCapability(principal, "feature.update", resource),
    canSetDelivery: hasCapability(principal, "feature.delivery.set", resource),
    canCreate: hasCapability(principal, "feature.create", resource),
    canLinkDependency: hasCapability(principal, "dependency.link", resource),
  };

  return buildCockpitModel({
    arts,
    activePis,
    activeFeatureCounts,
    selectedArtId,
    allPis,
    windowCounts,
    featureRows,
    depRows,
    permissions,
    view: input.view ?? "board",
    filters,
    userLabels,
    now: Date.now(),
  });
}
