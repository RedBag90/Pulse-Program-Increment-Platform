import type { PrismaClient } from "@/generated/prisma";
import type { Principal } from "@/server/auth/principal";
import { hasCapability } from "@/server/auth/authorize";
import { listTenantUserLabels } from "@/server/services/tenant-users";
import { InitiativeLevel } from "@/modules/core/kernel/domain/types";
import {
  deriveJobSizeTarget,
  type PiDeliveryRecord,
} from "@/modules/drumbeat/domain/pi-job-size-target";
import { classifyScopedEdges } from "@/modules/drumbeat/domain/graph-scope";
import type { PiWindow } from "@/modules/drumbeat/domain/timeline-grid";
import type { PiStatus } from "@/modules/drumbeat/domain/pi-rules";

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

// Board read-model shapes live in `domain/cockpit-types.ts` (so the pure board
// matrix imports down, not up). Imported for local use here and re-exported so
// existing consumers keep importing them from the view.
import type {
  FeatureStatus,
  CockpitPiSlot,
  CockpitFeature,
} from "@/modules/drumbeat/domain/cockpit-types";
import { resolveFeatureSolution } from "@/modules/work/domain/feature-solution";
import { epicFilterWhere, NO_EPIC } from "@/modules/drumbeat/domain/epic-filter";
import { PLANNABLE_GATES } from "@/modules/work/domain/feature-gates";
import { loadArtGraphLayout } from "@/modules/drumbeat/server/services/art-graph-layout";
import type { ArtId, TenantId } from "@/modules/core/kernel/domain/types";
export type { FeatureStatus, CockpitPiSlot, CockpitFeature };

export interface CockpitArtRef {
  id: string;
  name: string;
  valueStreamName: string | null;
  /** Wertstrom-Id — der Anlege-Dialog filtert Epics und Solutions darüber. */
  valueStreamId: string;
  /** Anzahl Features im aktiven PI dieser ART — fuer den Multi-ART-Picker. */
  activeFeatureCount: number;
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
  /** `pi.advance` — Kadenz fortschreiben (aktives PI abschließen + nächstes öffnen). */
  canAdvance: boolean;
  /** `pi.start` — geplantes PI aktivieren (PI-Kontext-Leiste). */
  canStart: boolean;
  /** `pi.delete` — geplantes PI löschen (PI-Kontext-Leiste). */
  canDelete: boolean;
  /**
   * `pi.update` — die Kapazitätszahl des ARTs in einem PI setzen
   * (PI-Kontext-Leiste); aus ihr errechnet sich das Job-Size-Ziel.
   */
  canEditPi: boolean;
  /**
   * `feature.wsjf.set` — der WSJF-Dialog auf der Karte. Dieselbe Capability,
   * die `scoreFeatureAction` prüft; ohne sie bleibt das Badge eine Anzeige.
   */
  canScoreWsjf: boolean;
}

export interface CockpitFilters {
  status: FeatureStatus[];
  ownerIds: string[];
  epicIds: string[];
  hasBlocker: boolean;
  /** Freitext-Suche auf den Feature-Titel (`?q=`). Leer = keine Suche. */
  q: string;
}

/**
 * PI date-window feeding the Roadmap view. The canonical `PiWindow`
 * (id/name/start/end) lives in the cadence/timeline domain; the cockpit uses
 * it whole under its own name.
 */
export type CockpitPiWindow = PiWindow;

/** Zustand der PI-Fenster-Navigation (Vor/Zurück gegenüber dem Anker). */
export interface CockpitPiWindowNav {
  /** Aktuelle Verschiebung gegenüber dem Anker (aktives PI). */
  offset: number;
  /** Gibt es links vom Fenster noch frühere PIs? */
  canBack: boolean;
  /** Gibt es rechts vom Fenster noch spätere PIs? */
  canForward: boolean;
}

export interface CockpitModel {
  /** Welche ARTs der User sehen darf, ggf. mit aktivem-PI-Feature-Count. */
  availableArts: CockpitArtRef[];
  /** Aktuell ausgewaehlte ART. `null` wenn der User keinen Scope hat. */
  selectedArt: CockpitArtRef | null;
  /** 5 PIs: Anker (aktives PI) + Umgebung, ggf. per `piWindow.offset` verschoben.
   *  Leer wenn ART keine Timeline hat oder die Timeline keine PIs. */
  piStrip: CockpitPiSlot[];
  /** Navigations-Zustand des PI-Fensters (Vor/Zurück). */
  piWindow: CockpitPiWindowNav;
  /** Id des aktiven PI (Status `active`) der Timeline, oder `null`. Für „Kadenz
   *  fortschreiben". */
  activePiId: string | null;
  /** Governance-Scope: das aktuell gewählte PI (aus `?pi=`, Default = aktives PI).
   *  Speist die PI-Kontext-Leiste (Fakten + Start/Fortschreiben/Löschen) und die
   *  Strip-Hervorhebung. `null` wenn die Timeline keine PIs hat. */
  selectedPi: CockpitPiSlot | null;
  /** Id des gewählten PI (für die Strip-Hervorhebung), oder `null`. */
  selectedPiId: string | null;
  /** Alle PIs der Timeline (oder Direct-ART) — Datumsfenster fuer die
   *  Roadmap-Sicht. Board + Tabelle nutzen nur den piStrip. */
  allPiWindows: CockpitPiWindow[];
  /** Wie viele Features das L3-Tor ausblendet; 0 = keines (oder Tor aus). */
  hiddenBelowL3: number;
  /**
   * Gezogene Netzplan-Positionen dieser ART (nur Topologie).
   *
   * Ohne sie führte der Netzplan zwei Koordinatensysteme, von denen keines vom
   * anderen wusste — genau der Fall, für den `resolveCollisions` gebaut wurde.
   */
  graphPositions: Record<string, { x: number; y: number }>;
  /** Default-Sicht ist „board" (Entscheidung #1); URL-Param ueberschreibt. */
  view: CockpitView;
  /** Features im aktuell ausgewaehlten Scope, ggf. weitergefiltert. */
  features: CockpitFeature[];
  /** Aktive Filter, gespiegelt aus dem URL-State fuer Rendering der Chips. */
  filters: CockpitFilters;
  /** Auswahl-Universum fuer die Owner-/Epic-Picker — ART-weit und ungefiltert,
   *  damit die Optionen beim Filtern nicht verschwinden. */
  filterOptions: {
    owners: { value: string; label: string }[];
    epics: { value: string; label: string }[];
  };
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
  /** Verschiebung des PI-Fensters gegenüber dem Anker (aktives PI); 0 = am Anker. */
  windowOffset?: number | undefined;
  /** Governance-Scope aus `?pi=`. Wählt das PI für die Kontext-Leiste; ungültige
   *  oder fehlende Werte fallen im Builder auf das aktive PI zurück. */
  piId?: string | undefined;
}

const DEFAULT_FILTERS: CockpitFilters = {
  status: [],
  ownerIds: [],
  epicIds: [],
  hasBlocker: false,
  q: "",
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

/**
 * Der Anker des Cockpit-Fensters: das **aktive** PI (Status `active`) — das ist
 * die manuell fortgeschriebene „Jetzt"-Marke der Kadenz. Ohne aktives PI fällt
 * es auf die uhrbasierte Auswahl zurück (Bestandsverhalten). Rein.
 */
export function resolveAnchorIndex(
  pis: ReadonlyArray<{ startDate: Date; endDate: Date; status: string }>,
  now: number = Date.now(),
): number {
  const activeIdx = pis.findIndex((p) => p.status === "active");
  return activeIdx >= 0 ? activeIdx : pickCurrentPiIndex(pis, now);
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
  /** `Art.valueStreamId` ist NOT NULL — jedes ART gehört zu genau einem Wertstrom. */
  valueStreamId: string;
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
  /** Kapazitätszahl des gewählten ARTs in diesem PI (`ArtPiCapacity`). */
  capacity: number | null;
  /**
   * Σ Job Size der **abgeschlossenen** Features des gewählten ARTs in diesem
   * PI — die Lieferung, aus der die Formel ihre Quote bildet.
   */
  delivered: number;
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
  /** Der Aufwand (WSJF Job Size) — er summiert sich unter dem PI-Titel. */
  wsjfJobSize: number | null;
  /** Die drei Zähler — der WSJF-Dialog auf der Karte belegt sich damit vor. */
  wsjfBusinessValue: number | null;
  wsjfTimeCriticality: number | null;
  wsjfRiskReduction: number | null;
  art: { id: string; name: string } | null;
  /** Eigene Solution des Features; `null` = die des Epics gilt. */
  primarySolution: { name: string } | null;
  parent: { id: string; title: string; primarySolution: { name: string } | null } | null;
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
  featureRows: ReadonlyArray<CockpitFeatureRow>;
  depRows: ReadonlyArray<CockpitDepRow>;
  /** Gezogene Netzplan-Positionen dieser ART. */
  graphPositions: Record<string, { x: number; y: number }>;
  /**
   * Σ Job Size je PI über die **ungefilterte** planbare Menge — der Nenner
   * der Überbuchung darf nicht mit den Oberflächen-Filtern wandern.
   */
  jobSizeByPi: Record<string, number>;
  /**
   * Wie viele Features das L3-Tor gerade ausblendet — Epic ohne Budget.
   *
   * Sie stehen nicht in `featureRows`; ohne diese Zahl verschwänden sie
   * lautlos. Versteckt ist in Ordnung, verschwiegen nicht.
   */
  hiddenBelowL3: number;
  permissions: CockpitPermissions;
  view: CockpitView;
  filters: CockpitFilters;
  /** userId → display label; the builder resolves each feature's owner label
   *  from it (loaded in the loader so the builder stays pure). */
  userLabels: Record<string, string>;
  /** Injected so the builder stays pure (no wall-clock read). */
  now: number;
  /** Verschiebung des PI-Fensters gegenüber dem Anker; 0 = am Anker. */
  windowOffset: number;
  /** Roh-`?pi=` (unvalidiert); der Builder prüft gegen `allPis` und fällt sonst
   *  auf das aktive PI zurück. `null` wenn nicht gesetzt. */
  selectedPiId: string | null;
  /** Distinct Owner-Ids im ART (ungefiltert) — Universum fuer den Owner-Picker.
   *  Optional; fehlt in Alt-Fixtures → leeres Picker-Universum. */
  ownerIdsInArt?: string[];
  /** Distinct Parent-Epics im ART (ungefiltert) — Universum fuer den Epic-Picker.
   *  Optional; fehlt in Alt-Fixtures → leeres Picker-Universum. */
  epicRows?: { id: string; title: string }[];
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
        wsjfJobSize: r.wsjfJobSize ?? null,
        wsjfBusinessValue: r.wsjfBusinessValue ?? null,
        wsjfTimeCriticality: r.wsjfTimeCriticality ?? null,
        wsjfRiskReduction: r.wsjfRiskReduction ?? null,
        hasBlocker: !!openBlocker,
        blockerHint: openBlocker?.from?.title ?? null,
        solutionName: resolveFeatureSolution({
          own: r.primarySolution?.name,
          parent: r.parent?.primarySolution?.name,
        }),
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
    featureRows,
    depRows,
    permissions,
    view,
    filters,
    userLabels,
    now,
    windowOffset,
    selectedPiId: rawSelectedPiId,
    ownerIdsInArt,
    epicRows,
  } = rows;

  // Picker-Universum — ART-weit, ungefiltert. Aus dem Loader gereicht (optional,
  // damit reine Builder-Fixtures ohne diese Rows weiter durchlaufen).
  // **Vor** dem PI-Block: die Kachel-Zähler entstehen aus derselben Menge, die
  // die Zellen füllen. Vorher zählte eine eigene `groupBy`-Abfrage ohne jeden
  // Filter — die Zahl neben einer gefilterten Liste log, sobald ein Filter an
  // war, und niemand konnte sehen, warum.
  const scopeFeatures = buildScopeFeatures(featureRows, filters.hasBlocker, userLabels);
  const countByPi = new Map<string, number>();
  for (const f of scopeFeatures) {
    if (f.piId) countByPi.set(f.piId, (countByPi.get(f.piId) ?? 0) + 1);
  }
  /**
   * **Zwei Zahlen, zwei Mengen — mit Absicht.** Der Zähler folgt den Filtern
   * (das ist die Zahl der sichtbaren Zeilen). Die Job-Size-Summe kommt aus
   * dem Loader über die **ungefilterte** planbare Menge: sie ist der Zähler
   * der Überbuchung, und eine Überbuchung darf sich nicht wegfiltern lassen.
   * Bis September 2026 liefen beide über dieselbe Schleife — ein Filter, und
   * das rote „158 / 79" war weg.
   */
  const jobSizeByPi = new Map(Object.entries(rows.jobSizeByPi));

  /**
   * **Das Ziel je PI aus der Formel** (`deriveJobSizeTarget`): Ø JS je
   * Kapazität der letzten 4 abgeschlossenen PIs × Kapazität × 0,8. Die
   * Vorgänger sind die PIs derselben Taktung, die die Rechnung selbst
   * auswählt — hier wird nur die ganze Reihe übergeben.
   */
  const history: PiDeliveryRecord[] = rows.allPis.map((p) => ({
    piId: p.id,
    name: p.name,
    startDate: p.startDate,
    status: p.status,
    capacity: p.capacity,
    delivered: p.delivered,
  }));
  const targetFields = (p: CockpitAllPiRow) => ({
    capacity: p.capacity,
    jobSizeTarget: deriveJobSizeTarget({
      startDate: p.startDate,
      capacity: p.capacity,
      history,
    }),
    deliveredPerCapacity:
      p.status === "completed" && p.capacity != null && p.capacity > 0
        ? p.delivered / p.capacity
        : null,
  });

  const filterOptions = {
    owners: (ownerIdsInArt ?? [])
      .map((id) => ({ value: id, label: userLabels[id] ?? id }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    // „Ohne Epic" steht **vorn**: es ist keine Alternative unter vielen,
    // sondern die Gegenfrage — „was hängt an gar keinem Vorhaben".
    epics: [
      { value: NO_EPIC, label: "Ohne Epic" },
      ...(epicRows ?? [])
        .map((e) => ({ value: e.id, label: e.title }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    ],
  };

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
      valueStreamId: a.valueStreamId,
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
  let piWindow: CockpitPiWindowNav = { offset: 0, canBack: false, canForward: false };
  let activePiId: string | null = null;
  let selectedPi: CockpitPiSlot | null = null;
  let selectedPiId: string | null = null;
  if (selectedArt) {
    activePiId = allPis.find((p) => p.status === "active")?.id ?? null;
    // Anker = aktives PI (Fallback: Uhr). Das Fenster darf per `windowOffset`
    // gegen den Anker verschoben werden; `isCurrent` markiert weiterhin den Anker.
    const anchorIdx = resolveAnchorIndex(allPis, now);
    const anchorPiId = anchorIdx >= 0 ? (allPis[anchorIdx]?.id ?? null) : null;
    const windowCenter =
      anchorIdx < 0 ? -1 : Math.min(allPis.length - 1, Math.max(0, anchorIdx + windowOffset));
    const windowPis = takePiWindow(allPis, windowCenter);
    const winStart = windowCenter < 0 ? 0 : Math.max(0, windowCenter - 1);
    const winEnd = windowCenter < 0 ? 0 : Math.min(allPis.length, windowCenter + 4);
    piWindow = {
      offset: windowOffset,
      canBack: winStart > 0,
      canForward: winEnd < allPis.length,
    };
    piStrip = windowPis.map((p) => ({
      id: p.id,
      name: p.name,
      startDate: p.startDate,
      endDate: p.endDate,
      status: p.status as PiStatus,
      featureCount: countByPi.get(p.id) ?? 0,
      plannedJobSize: jobSizeByPi.get(p.id) ?? 0,
      ...targetFields(p),
      isCurrent: p.id === anchorPiId,
    }));

    // Governance-Scope: `?pi=` wenn gültig (in dieser Timeline), sonst das aktive
    // PI als Default — so zeigt die Kontext-Leiste beim Laden sofort den Abschluss
    // des laufenden PI. `selectedPi` wird aus `allPis` aufgelöst, damit auch ein
    // außerhalb des Strip-Fensters liegendes PI korrekt dargestellt wird.
    selectedPiId =
      rawSelectedPiId && allPis.some((p) => p.id === rawSelectedPiId)
        ? rawSelectedPiId
        : activePiId;
    const selRow = selectedPiId ? allPis.find((p) => p.id === selectedPiId) : null;
    selectedPi = selRow
      ? {
          id: selRow.id,
          name: selRow.name,
          startDate: selRow.startDate,
          endDate: selRow.endDate,
          status: selRow.status as PiStatus,
          featureCount: countByPi.get(selRow.id) ?? 0,
          plannedJobSize: jobSizeByPi.get(selRow.id) ?? 0,
          ...targetFields(selRow),
          isCurrent: selRow.id === anchorPiId,
        }
      : null;
  }

  /*
    Der PI-Scope, je Sicht verschieden — weil die Sichten verschiedene Fragen
    beantworten:

    - **Board**: vollständig. Dort *sind* die PIs die Spalten; eine Eingrenzung
      dampfte es auf eine einzige ein. Es hebt die gewählte hervor.
    - **Netz**: das **Fenster** (Backlog + die fünf PIs des Streifens). Eine
      Abhängigkeit ist ihrem Wesen nach etwas zwischen Zeiträumen — gemessen
      überquert die Mehrheit eine PI-Grenze. Eine Netzsicht, die nur ein PI
      zeigt, kann genau das nicht darstellen und erst recht nicht anlegen.
    - **Tabelle und Fahrplan**: das gewählte PI. Dort ist die Eingrenzung der
      Zweck.
  */
  const windowPiIds = new Set(piStrip.map((p) => p.id));
  const features =
    view === "network"
      ? scopeFeatures.filter((f) => f.piId === null || windowPiIds.has(f.piId))
      : view !== "board" && selectedPiId !== null
        ? scopeFeatures.filter((f) => f.piId === selectedPiId)
        : scopeFeatures;
  const dependencies = buildScopeDependencies(depRows, features);

  return {
    availableArts,
    selectedArt,
    hiddenBelowL3: rows.hiddenBelowL3,
    graphPositions: rows.graphPositions,
    piStrip,
    piWindow,
    activePiId,
    selectedPi,
    selectedPiId,
    allPiWindows,
    view,
    features,
    filters,
    filterOptions,
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
  /**
   * Ohne Drumbeat gibt es keine PIs — dann gibt es auch nichts einzuplanen,
   * und das Tor darunter wäre eine Regel über eine Fläche, die es nicht gibt.
   * Das Flag hing bisher nicht an dieser Lesesicht; der Route-Wächter über dem
   * Segment `umsetzung` war die einzige Prüfung.
   */
  const drumbeatEnabled = principal.enabledModules.includes("drumbeat");

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
        valueStreamId: true,
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
  const [activeFeatureCounts, pisResult, featuresResult, optionsResult] = await Promise.all([
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
    // 5) Die PIs der Timeline. Die Feature-Zahl je PI zählt der Builder aus der
    //    **gefilterten** Feature-Menge — früher stand hier eine eigene
    //    `groupBy`-Abfrage ohne jeden Filter, deren Zahl neben gefilterten
    //    Zellen stand und log. Eine Datenbankrunde weniger, und die beiden
    //    können nicht mehr auseinanderlaufen.
    (async (): Promise<{ allPis: CockpitAllPiRow[] }> => {
      if (!selectedArtRow) return { allPis: [] };
      const piRows = await db.programIncrement.findMany({
        where: {
          tenantId,
          ...(selectedArtRow.timelineId
            ? { timelineId: selectedArtRow.timelineId }
            : { artId: selectedArtRow.id }),
        },
        select: {
          id: true,
          name: true,
          startDate: true,
          endDate: true,
          status: true,
        },
        orderBy: { startDate: "asc" },
      });
      // Die Eingänge der Ziel-Formel (`deriveJobSizeTarget`): Kapazität und
      // Lieferung **dieses ARTs** je PI. Die Taktung teilen sich mehrere ARTs;
      // Kapazität und Last gehören dem einzelnen.
      const piIds = piRows.map((p) => p.id);
      const [capacities, geliefert] = await Promise.all([
        db.artPiCapacity.findMany({
          where: { tenantId, artId: selectedArtRow.id, piId: { in: piIds } },
          select: { piId: true, capacity: true },
        }),
        db.initiative.groupBy({
          by: ["piId"],
          where: {
            tenantId,
            level: InitiativeLevel.FEATURE,
            deletedAt: null,
            artId: selectedArtRow.id,
            piId: { in: piIds },
            status: "completed",
          },
          _sum: { wsjfJobSize: true },
        }),
      ]);
      const capacityByPi = new Map(capacities.map((c) => [c.piId, Number(c.capacity)]));
      const deliveredByPi = new Map(
        geliefert.map((g) => [g.piId ?? "", g._sum.wsjfJobSize ?? 0] as const),
      );
      const allPis = piRows.map((p) => ({
        ...p,
        capacity: capacityByPi.get(p.id) ?? null,
        delivered: deliveredByPi.get(p.id) ?? 0,
      }));
      return { allPis };
    })(),
    // 6) Features im Scope (SQL-Filter fuer status/owner/epic; der `hasBlocker`-
    //    Filter + Blocker-Erkennung sitzt im Builder).
    // 7) Dependencies mit mind. einem Endpunkt im (ungefilterten) Feature-Scope.
    //    Der Builder klassifiziert gegen den finalen (hasBlocker-gefilterten)
    //    Scope — Off-Scope-Ergebnis bleibt identisch.
    (async (): Promise<{
      featureRows: CockpitFeatureRow[];
      depRows: CockpitDepRow[];
      unterL3: number;
      jobSizeByPi: Record<string, number>;
    }> => {
      if (!selectedArtRow) return { featureRows: [], depRows: [], unterL3: 0, jobSizeByPi: {} };

      const grundWhere = {
        tenantId,
        level: InitiativeLevel.FEATURE,
        deletedAt: null,
        artId: selectedArtRow.id,
        ...(filters.status.length > 0 ? { status: { in: filters.status } } : {}),
        ...(filters.ownerIds.length > 0 ? { ownerId: { in: filters.ownerIds } } : {}),
        ...epicFilterWhere(filters.epicIds),
        ...(filters.q.trim() !== ""
          ? { title: { contains: filters.q.trim(), mode: "insensitive" as const } }
          : {}),
      };

      /**
       * **Geplant wird erst ab L3.**
       *
       * Ein Feature, dessen Epic noch kein Budget hat, gehört nicht in die
       * Planung — dieselbe Schwelle, die `setFeaturePi` serverseitig
       * durchsetzt. Elternlose Features gehen durch: für sie gibt es kein
       * Portfolio-Tor, auf das man warten könnte.
       *
       * **Hier in der `where`, nicht als Filter danach** — sonst zählten die
       * PI-Kacheln Features mit, die in keiner Zelle stehen. Genau davor warnt
       * der Kommentar weiter oben.
       *
       * Unter `AND`, weil `epicFilterWhere` selbst ein `OR` beisteuern kann;
       * zwei `OR` auf derselben Ebene überschrieben einander.
       */
      const torWhere = drumbeatEnabled
        ? {
            AND: [
              { OR: [{ parentId: null }, { parent: { stageGate: { in: [...PLANNABLE_GATES] } } }] },
            ],
          }
        : {};

      /**
       * **Der Nenner steht, der Zähler wandert.** `featureRows` folgt den
       * Filtern (Status, Owner, Epic, Suche) — für „wie viele Zeilen sehe
       * ich" ist das richtig. Für „ist dieses PI überbucht" nicht: ein
       * Filter, und die rote Zahl verschwand. Die Job-Size-Summe je PI kommt
       * deshalb aus der **ungefilterten** planbaren Menge des ARTs — das
       * L3-Tor gilt weiter, die Oberflächen-Filter nicht.
       */
      const planbarWhere = {
        tenantId,
        level: InitiativeLevel.FEATURE,
        deletedAt: null,
        artId: selectedArtRow.id,
        piId: { not: null },
        ...torWhere,
      };

      const [featureRows, unterL3, lastJePi] = await Promise.all([
        db.initiative.findMany({
          where: { ...grundWhere, ...torWhere },
          select: {
            id: true,
            title: true,
            status: true,
            piId: true,
            artId: true,
            parentId: true,
            ownerId: true,
            wsjfComputed: true,
            wsjfJobSize: true,
            wsjfBusinessValue: true,
            wsjfTimeCriticality: true,
            wsjfRiskReduction: true,
            art: { select: { id: true, name: true } },
            // Die eigene Solution des Features — und die seines Epics als
            // Rückfall, über den ohnehin vorhandenen `parent`-Select.
            primarySolution: { select: { name: true } },
            parent: {
              select: { id: true, title: true, primarySolution: { select: { name: true } } },
            },
            dependenciesIn: {
              where: { type: "blocks" },
              select: {
                id: true,
                from: { select: { id: true, title: true, status: true } },
              },
            },
          },
          orderBy: [{ wsjfComputed: "desc" }, { title: "asc" }],
        }),
        // **Versteckt, aber nicht verschwiegen.** Wie viele Features fallen
        // gerade durch das Tor? Ohne diese Zahl verschwände Arbeit lautlos —
        // und eine Arbeit, die niemand sieht, ist schlimmer als eine, die
        // schlecht aussieht (siehe die Spalte „Außerhalb des Fensters").
        drumbeatEnabled
          ? db.initiative.count({
              where: {
                ...grundWhere,
                parent: { stageGate: { notIn: [...PLANNABLE_GATES] } },
              },
            })
          : Promise.resolve(0),
        db.initiative.groupBy({
          by: ["piId"],
          where: planbarWhere,
          _sum: { wsjfJobSize: true },
        }),
      ]);
      const jobSizeByPi: Record<string, number> = {};
      for (const r of lastJePi) if (r.piId) jobSizeByPi[r.piId] = r._sum.wsjfJobSize ?? 0;
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
      return { featureRows, depRows, unterL3, jobSizeByPi };
    })(),
    // Picker-Universum: distinct Owner + Parent-Epic ueber ALLE Features des ARTs
    // (ungefiltert), damit die Filter-Optionen beim Filtern nicht kollabieren.
    (async (): Promise<{ ownerIdsInArt: string[]; epicRows: { id: string; title: string }[] }> => {
      if (!selectedArtRow) return { ownerIdsInArt: [], epicRows: [] };
      const optionRows = await db.initiative.findMany({
        where: {
          tenantId,
          level: InitiativeLevel.FEATURE,
          deletedAt: null,
          artId: selectedArtRow.id,
        },
        select: { ownerId: true, parent: { select: { id: true, title: true } } },
      });
      const owners = new Set<string>();
      const epicMap = new Map<string, string>();
      for (const r of optionRows) {
        if (r.ownerId) owners.add(r.ownerId);
        if (r.parent) epicMap.set(r.parent.id, r.parent.title);
      }
      return {
        ownerIdsInArt: [...owners],
        epicRows: [...epicMap].map(([id, title]) => ({ id, title })),
      };
    })(),
  ]);

  const { allPis } = pisResult;
  const { featureRows, depRows, unterL3, jobSizeByPi } = featuresResult;
  const { ownerIdsInArt, epicRows } = optionsResult;

  // Permissions — aus dem zentralen Policies-Registry (ADR-0002). UI nutzt die
  // Flags nur fuer Affordances; der echte Gate sitzt serverseitig.
  const resource = selectedArtRow ? { tenantId, artId: selectedArtRow.id } : { tenantId };
  /**
   * Die gezogenen Positionen dieser ART — nur für die Topologie.
   *
   * In der Zeitachse ist die Position die Aussage (sie *ist* das PI); dort
   * gespeicherte Koordinaten zu laden hiesse, zwei Wahrheiten über dieselbe
   * Sache zu führen.
   */
  const graphPositions: Record<string, { x: number; y: number }> = {};
  if (selectedArtRow && input.view === "network") {
    for (const [id, pos] of await loadArtGraphLayout(
      db,
      tenantId as TenantId,
      selectedArtRow.id as ArtId,
    )) {
      graphPositions[id] = pos;
    }
  }

  const permissions: CockpitPermissions = {
    canUpdate: hasCapability(principal, "feature.update", resource),
    canSetDelivery: hasCapability(principal, "feature.delivery.set", resource),
    canCreate: hasCapability(principal, "feature.create", resource),
    canLinkDependency: hasCapability(principal, "dependency.link", resource),
    canAdvance: hasCapability(principal, "pi.advance", resource),
    canStart: hasCapability(principal, "pi.start", resource),
    canDelete: hasCapability(principal, "pi.delete", resource),
    canEditPi: hasCapability(principal, "pi.update", resource),
    canScoreWsjf: hasCapability(principal, "feature.wsjf.set", resource),
  };

  return buildCockpitModel({
    arts,
    activePis,
    activeFeatureCounts,
    selectedArtId,
    allPis,
    featureRows,
    depRows,
    hiddenBelowL3: unterL3,
    graphPositions,
    jobSizeByPi,
    permissions,
    view: input.view ?? "board",
    filters,
    userLabels,
    now: Date.now(),
    windowOffset: input.windowOffset ?? 0,
    selectedPiId: input.piId ?? null,
    ownerIdsInArt,
    epicRows,
  });
}
